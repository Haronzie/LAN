package controllers

import (
	"LANFileSharingSystem/internal/encryption"
	"LANFileSharingSystem/internal/models"
	"LANFileSharingSystem/internal/services"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type FileController struct {
	App *models.App
}

func NewFileController(app *models.App) *FileController {
	return &FileController{App: app}
}

// Upload handles file uploads.
func (fc *FileController) Upload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Error parsing form data")
		return
	}

	// Get the uploaded file.
	file, handler, err := r.FormFile("file")
	if err != nil {
		models.RespondError(w, http.StatusBadRequest, "Error retrieving the file")
		return
	}
	defer file.Close()

	targetDir := r.FormValue("directory")
	if targetDir != "" {
		targetDir = filepath.Clean(targetDir)
		if strings.HasPrefix(targetDir, "..") {
			models.RespondError(w, http.StatusBadRequest, "Invalid directory path")
			return
		}
	}

	uploadBase := "uploads"
	rawFileName := handler.Filename
	relativePath := filepath.Join(targetDir, rawFileName)
	finalDiskPath := filepath.Join(uploadBase, relativePath)

	// Ensure the target directory exists.
	if err := os.MkdirAll(filepath.Dir(finalDiskPath), 0755); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error creating target directory")
		return
	}

	// Save the uploaded file as a temporary plaintext file.
	tempFilePath := finalDiskPath + ".tmp"
	tempFile, err := os.Create(tempFilePath)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error creating temporary file")
		return
	}
	if _, err := io.Copy(tempFile, file); err != nil {
		tempFile.Close()
		os.Remove(tempFilePath)
		models.RespondError(w, http.StatusInternalServerError, "Error saving temporary file")
		return
	}
	tempFile.Close()

	// --- New: Virus Scanning via services package ---
	scanResult, err := services.ScanFile(tempFilePath)
	if err != nil || !scanResult.Clean {
		os.Remove(tempFilePath)
		models.RespondError(w, http.StatusBadRequest, fmt.Sprintf("File rejected: %v", scanResult.Description))
		return
	}
	// --------------------------------------------------

	// Load the encryption key (must be 32 bytes for AES-256).
	key := []byte(os.Getenv("ENCRYPTION_KEY"))
	if len(key) != 32 {
		models.RespondError(w, http.StatusInternalServerError, "Invalid encryption key")
		return
	}

	// Encrypt the temporary file and write to finalDiskPath.
	if err := encryption.EncryptFile(key, tempFilePath, finalDiskPath); err != nil {
		os.Remove(tempFilePath)
		models.RespondError(w, http.StatusInternalServerError, "Error encrypting file")
		return
	}
	// Remove the temporary plaintext file.
	os.Remove(tempFilePath)

	// Save file metadata in the database.
	fr := models.FileRecord{
		FileName:    rawFileName,
		FilePath:    relativePath,
		Size:        handler.Size,
		ContentType: handler.Header.Get("Content-Type"),
		Uploader:    user.Username,
	}
	if err := fc.App.CreateFileRecord(fr); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error saving file record")
		return
	}

	fc.App.LogActivity(fmt.Sprintf("User '%s' uploaded and encrypted file '%s'.", user.Username, rawFileName))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("File '%s' uploaded and encrypted successfully", rawFileName),
	})
}

// RenameFile renames a file both in local storage and in the database.
func (fc *FileController) RenameFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var req struct {
		OldFilename string `json:"old_filename"`
		NewFilename string `json:"new_filename"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.OldFilename = strings.TrimSpace(req.OldFilename)
	req.NewFilename = strings.TrimSpace(req.NewFilename)
	if req.OldFilename == "" || req.NewFilename == "" {
		models.RespondError(w, http.StatusBadRequest, "Old and new filenames are required")
		return
	}

	// 1) Get the old file record to see the old path
	oldFR, err := fc.App.GetFileRecord(req.OldFilename)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "Old file not found in database")
		return
	}

	// 2) Build the new relative path (keep the same folder, just change the file name)
	oldFullPath := filepath.Join("uploads", oldFR.FilePath)
	newRelativePath := filepath.Join(filepath.Dir(oldFR.FilePath), req.NewFilename)
	newFullPath := filepath.Join("uploads", newRelativePath)

	// 3) Rename on disk
	if err := os.Rename(oldFullPath, newFullPath); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error renaming file in storage")
		return
	}

	// 4) Update DB record to reflect new file_name and new file_path
	if err := fc.App.RenameFileRecord(req.OldFilename, req.NewFilename, newRelativePath); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error updating file record")
		return
	}

	fc.App.LogActivity(fmt.Sprintf("User '%s' renamed file from '%s' to '%s'.", user.Username, req.OldFilename, req.NewFilename))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("File renamed from '%s' to '%s' successfully", req.OldFilename, req.NewFilename),
	})
}

// DeleteFile handles file deletion requests.
func (fc *FileController) DeleteFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var req struct {
		Filename string `json:"filename"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Filename = strings.TrimSpace(req.Filename)
	if req.Filename == "" {
		models.RespondError(w, http.StatusBadRequest, "Filename cannot be empty")
		return
	}

	// 1. Retrieve the file record from DB to get its relative path.
	fr, err := fc.App.GetFileRecord(req.Filename)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "File not found in database")
		return
	}

	// 2. Remove the file from disk using the stored path.
	fullPath := filepath.Join("uploads", fr.FilePath)
	if err := os.Remove(fullPath); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error deleting file from local storage")
		return
	}

	// 3. Delete the file record from the database.
	if err := fc.App.DeleteFileRecord(req.Filename); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error deleting file record from database")
		return
	}

	fc.App.LogActivity(fmt.Sprintf("User '%s' deleted file '%s'.", user.Username, req.Filename))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("File '%s' deleted successfully", req.Filename),
	})
}

// Download handles file download requests by decrypting files before sending.
func (fc *FileController) Download(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	_, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	fileName := r.URL.Query().Get("filename")
	if fileName == "" {
		models.RespondError(w, http.StatusBadRequest, "Filename is required")
		return
	}

	fr, err := fc.App.GetFileRecord(fileName)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "File not found")
		return
	}

	encryptedFilePath := filepath.Join("uploads", fr.FilePath)
	// Create a temporary file path for the decrypted file.
	tempDecryptedPath := encryptedFilePath + ".dec"

	key := []byte(os.Getenv("ENCRYPTION_KEY"))
	if len(key) != 32 {
		models.RespondError(w, http.StatusInternalServerError, "Invalid encryption key")
		return
	}

	// Decrypt the file into the temporary decrypted file.
	if err := encryption.DecryptFile(key, encryptedFilePath, tempDecryptedPath); err != nil {
		os.Remove(tempDecryptedPath)
		models.RespondError(w, http.StatusInternalServerError, "Error decrypting file")
		return
	}

	// Open the decrypted file.
	f, err := os.Open(tempDecryptedPath)
	if err != nil {
		os.Remove(tempDecryptedPath)
		models.RespondError(w, http.StatusInternalServerError, "Error opening decrypted file")
		return
	}
	defer f.Close()
	// Remove the temporary decrypted file after streaming.
	defer os.Remove(tempDecryptedPath)

	w.Header().Set("Content-Type", fr.ContentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fr.FileName))
	if _, err := io.Copy(w, f); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error sending file")
		return
	}

	fc.App.LogActivity(fmt.Sprintf("User downloaded and decrypted file '%s'.", fileName))
}

// CopyFile creates a copy of an existing file in the storage and inserts a new record in the database.
func (fc *FileController) CopyFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var req struct {
		SourceFile  string `json:"source_file"`
		NewFileName string `json:"new_file_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.SourceFile = strings.TrimSpace(req.SourceFile)
	req.NewFileName = strings.TrimSpace(req.NewFileName)
	if req.SourceFile == "" || req.NewFileName == "" {
		models.RespondError(w, http.StatusBadRequest, "Source file and new file name are required")
		return
	}

	// 1. Retrieve the source file record from DB to get the relative path.
	oldFR, err := fc.App.GetFileRecord(req.SourceFile)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "Source file not found in database")
		return
	}

	// 2. Build the disk paths for source and destination.
	srcPath := filepath.Join("uploads", oldFR.FilePath)

	// We'll store the new copy in the same folder as the source, just with a new file name:
	newRelativePath := filepath.Join(filepath.Dir(oldFR.FilePath), req.NewFileName)
	dstPath := filepath.Join("uploads", newRelativePath)

	// 3. Copy the file on disk.
	in, err := os.Open(srcPath)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error opening source file")
		return
	}
	defer in.Close()

	out, err := os.Create(dstPath)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error creating destination file")
		return
	}
	defer out.Close()

	if _, err = io.Copy(out, in); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error copying file content")
		return
	}

	// 4. Build a new record for the copied file.
	//    We can copy the content type and other metadata from the old record.
	newRecord := models.FileRecord{
		FileName:    req.NewFileName,
		FilePath:    newRelativePath,
		Size:        oldFR.Size, // or you can re-check with os.Stat(dstPath) for exact size
		ContentType: oldFR.ContentType,
		Uploader:    user.Username, // or oldFR.Uploader, depending on your policy
	}

	if err := fc.App.CreateFileRecord(newRecord); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error creating file record for copied file")
		return
	}

	fc.App.LogActivity(fmt.Sprintf("User '%s' copied file from '%s' to '%s'.", user.Username, req.SourceFile, req.NewFileName))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("File copied to '%s' successfully", req.NewFileName),
	})
}

func (fc *FileController) ListFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	// Check if user is authenticated
	if _, err := fc.App.GetUserFromSession(r); err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Read the 'directory' query param, e.g. ?directory=Tata
	dir := r.URL.Query().Get("directory")

	// Query only files that belong to this folder (or root if dir == "")
	files, err := fc.App.ListFilesInDirectory(dir)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error retrieving files")
		return
	}

	// Convert FileRecord objects into JSON-friendly maps
	var output []map[string]interface{}
	for _, f := range files {
		output = append(output, map[string]interface{}{
			"name":        f.FileName,
			"type":        "file",        // for your frontend to distinguish
			"size":        f.Size,        // in bytes
			"contentType": f.ContentType, // renamed from content_type
			"uploader":    f.Uploader,
		})
	}

	// Respond with the JSON array
	models.RespondJSON(w, http.StatusOK, output)
}

// ShareFile generates a shareable URL for a file.
func (fc *FileController) ShareFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var req struct {
		FileName string `json:"file_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.FileName = strings.TrimSpace(req.FileName)
	if req.FileName == "" {
		models.RespondError(w, http.StatusBadRequest, "File name cannot be empty")
		return
	}

	// 1. Check if the file record exists and if the user can share it.
	fr, err := fc.App.GetFileRecord(req.FileName)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "File does not exist")
		return
	}
	if user.Role != "admin" && fr.Uploader != user.Username {
		models.RespondError(w, http.StatusForbidden, "Forbidden: You can only share files you uploaded")
		return
	}

	// 2. Generate a token for sharing.
	token, err := fc.App.GenerateToken()
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error generating share token")
		return
	}
	fc.App.FileShareTokens[token] = req.FileName

	shareURL := fmt.Sprintf("http://%s/download-share?token=%s", r.Host, token)
	models.RespondJSON(w, http.StatusOK, map[string]string{"share_url": shareURL})
}

// DownloadShare handles downloads via share tokens.
func (fc *FileController) DownloadShare(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		models.RespondError(w, http.StatusBadRequest, "Missing token")
		return
	}

	fileName, exists := fc.App.FileShareTokens[token]
	if !exists {
		models.RespondError(w, http.StatusBadRequest, "Invalid or expired token")
		return
	}

	// 1. Retrieve the file record from DB to get its relative path.
	fr, err := fc.App.GetFileRecord(fileName)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "File not found")
		return
	}

	// 2. Open the file from disk.
	filePath := filepath.Join("uploads", fr.FilePath)
	f, err := os.Open(filePath)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error opening file")
		return
	}
	defer f.Close()

	w.Header().Set("Content-Type", fr.ContentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fr.FileName))
	io.Copy(w, f)
}
