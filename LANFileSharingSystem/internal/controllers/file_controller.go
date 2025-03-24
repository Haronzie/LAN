package controllers

import (
	"LANFileSharingSystem/internal/encryption"
	"LANFileSharingSystem/internal/models"
	"LANFileSharingSystem/internal/services"
	"encoding/json"
	"fmt"
	"io"
	"log"
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

	// 1) Retrieve the uploaded file from the form
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

	// 2) Ensure the target directory exists on disk
	if err := os.MkdirAll(filepath.Dir(finalDiskPath), 0755); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error creating target directory")
		return
	}

	// 3) Save the uploaded file to a temp path (plaintext) before encryption
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

	// 4) Virus scan (if integrated)
	scanResult, err := services.ScanFile(tempFilePath)
	if err != nil || !scanResult.Clean {
		os.Remove(tempFilePath)
		models.RespondError(w, http.StatusBadRequest,
			fmt.Sprintf("File rejected: %v", scanResult.Description))
		return
	}

	// 5) Load the encryption key (must be 32 bytes for AES-256).
	key := []byte(os.Getenv("ENCRYPTION_KEY"))
	if len(key) != 32 {
		os.Remove(tempFilePath)
		models.RespondError(w, http.StatusInternalServerError, "Invalid encryption key")
		return
	}

	// 6) Encrypt the file into finalDiskPath
	if err := encryption.EncryptFile(key, tempFilePath, finalDiskPath); err != nil {
		os.Remove(tempFilePath)
		models.RespondError(w, http.StatusInternalServerError, "Error encrypting file")
		return
	}
	// Remove the temp plaintext
	os.Remove(tempFilePath)

	// 7) Determine if this is a brand-new file or an existing one
	confidentialStr := r.FormValue("confidential")
	isConfidential := (confidentialStr == "true")

	// Check for existing record
	existingFR, getErr := fc.App.GetFileRecordByPath(relativePath)
	if getErr == nil {
		// 🎯 **Re-upload flow**
		fileID := existingFR.ID

		// 7a) Update the existing file's metadata
		updateErr := fc.App.UpdateFileMetadata(fileID, handler.Size, handler.Header.Get("Content-Type"), isConfidential)
		if updateErr != nil {
			models.RespondError(w, http.StatusInternalServerError, "Error updating file record")
			return
		}

		// 7b) Insert a new version record
		latestVer, _ := fc.App.GetLatestVersionNumber(fileID)
		newVer := latestVer + 1
		if verr := fc.App.CreateFileVersion(fileID, newVer, relativePath); verr != nil {
			log.Println("Warning: failed to create file version record:", verr)
		}

		// 7c) Log activity
		fc.App.LogActivity(fmt.Sprintf("User '%s' re-uploaded file '%s' (version %d).", user.Username, rawFileName, newVer))

		// ✅ **Audit log for re-upload**
		action := "REUPLOAD"
		details := fmt.Sprintf("File '%s' re-uploaded as version %d", rawFileName, newVer)
		fc.App.LogAudit(user.Username, fileID, action, details)

		// 7d) Broadcast the re-upload notification
		notification := []byte(fmt.Sprintf(`{"event": "file_uploaded", "file_name": "%s", "version": %d}`, rawFileName, newVer))
		if fc.App.NotificationHub != nil {
			fc.App.NotificationHub.Broadcast(notification)
		}

		models.RespondJSON(w, http.StatusOK, map[string]string{
			"message": fmt.Sprintf("File '%s' updated (version %d) successfully", rawFileName, newVer),
		})
		return
	}

	// 🎯 **Brand-new file flow**
	// 8) Create a new file record
	fr := models.FileRecord{
		FileName:     rawFileName,
		Directory:    targetDir,
		FilePath:     relativePath,
		Size:         handler.Size,
		ContentType:  handler.Header.Get("Content-Type"),
		Uploader:     user.Username,
		Confidential: isConfidential,
	}

	if err := fc.App.CreateFileRecord(fr); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error saving file record")
		return
	}

	// 8a) Insert version=1 for the new file
	fileID, _ := fc.App.GetFileIDByPath(fr.FilePath)
	if fileID > 0 {
		if verr := fc.App.CreateFileVersion(fileID, 1, fr.FilePath); verr != nil {
			log.Println("Warning: failed to create version record:", verr)
		}
	}

	// ✅ **Audit log for new upload**
	action := "UPLOAD"
	details := fmt.Sprintf("File '%s' uploaded (version 1)", rawFileName)
	fc.App.LogAudit(user.Username, fileID, action, details)

	// 8b) Log activity
	fc.App.LogActivity(fmt.Sprintf("User '%s' uploaded new file '%s' (version 1).", user.Username, rawFileName))

	// 8c) Broadcast the new file upload notification
	notification := []byte(fmt.Sprintf(`{"event": "file_uploaded", "file_name": "%s", "version": %d}`, rawFileName, 1))
	if fc.App.NotificationHub != nil {
		fc.App.NotificationHub.Broadcast(notification)
	}

	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("File '%s' uploaded (version 1) successfully", rawFileName),
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

	// Retrieve fileID for the new file path
	fileID, err := fc.App.GetFileIDByPath(newRelativePath)
	if err == nil && fileID > 0 {
		// If we found the file ID, figure out the next version
		latestVer, _ := fc.App.GetLatestVersionNumber(fileID)
		newVer := latestVer + 1

		// Insert a version record for the new name/path
		if verr := fc.App.CreateFileVersion(fileID, newVer, newRelativePath); verr != nil {
			log.Println("Warning: failed to create file version record:", verr)
		}

		// ✅ Log the audit event as a RENAME action (not UPLOAD)
		action := "RENAME"
		details := fmt.Sprintf("File renamed from '%s' to '%s'", req.OldFilename, req.NewFilename)
		fc.App.LogAudit(user.Username, fileID, action, details)
		log.Println("Audit log added:", details)
	} else {
		log.Println("Error: File ID not found for path", newRelativePath)
	}

	// Log activity and respond
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

	fr, err := fc.App.GetFileRecord(req.Filename)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "File not found in database")
		return
	}

	// ✅ Log the audit entry BEFORE deletion
	fc.App.LogAudit(user.Username, fr.ID, "DELETE", fmt.Sprintf("File '%s' deleted", fr.FileName))

	fullPath := filepath.Join("uploads", fr.FilePath)
	if removeErr := os.Remove(fullPath); removeErr != nil && !os.IsNotExist(removeErr) {
		models.RespondError(w, http.StatusInternalServerError, "Error deleting file from local storage")
		return
	}

	// Correct usage: Delete the file record after logging the audit
	fileID, err := fc.App.DeleteFileRecord(req.Filename)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error deleting file record from database")
		return
	}

	if delVerErr := fc.App.DeleteFileVersions(fileID); delVerErr != nil {
		log.Printf("Warning: could not delete file versions for ID %d: %v\n", fileID, delVerErr)
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
		SourceFile        string `json:"source_file"`
		NewFileName       string `json:"new_file_name"`
		DestinationFolder string `json:"destination_folder"` // optional
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Trim input values
	req.SourceFile = strings.TrimSpace(req.SourceFile)
	req.NewFileName = strings.TrimSpace(req.NewFileName)
	req.DestinationFolder = strings.TrimSpace(req.DestinationFolder)

	// Validate input
	if req.SourceFile == "" {
		models.RespondError(w, http.StatusBadRequest, "Source file is required")
		return
	}
	if req.NewFileName == "" {
		// fallback to same name if not provided
		parts := strings.Split(req.SourceFile, "/")
		originalName := parts[len(parts)-1]
		req.NewFileName = originalName
	}

	// 1. Retrieve the source file record
	oldFR, err := fc.App.GetFileRecord(req.SourceFile)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "Source file not found in database")
		return
	}

	// 2. Build the disk path for the source
	srcPath := filepath.Join("uploads", oldFR.FilePath)

	// Decide where the new file goes
	var newRelativePath string
	if req.DestinationFolder == "" {
		// If no destination_folder given, copy into the same folder
		newRelativePath = filepath.Join(filepath.Dir(oldFR.FilePath), req.NewFileName)
	} else {
		// Paste into the user-specified folder
		newRelativePath = filepath.Join(req.DestinationFolder, req.NewFileName)
	}
	dstPath := filepath.Join("uploads", newRelativePath)

	// 3. Copy the file on disk
	in, err := os.Open(srcPath)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error opening source file on disk")
		return
	}
	defer in.Close()

	// If the destination file already exists, fail for safety
	if _, errStat := os.Stat(dstPath); errStat == nil {
		models.RespondError(w, http.StatusConflict, "Destination file already exists")
		return
	}

	out, err := os.Create(dstPath)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error creating destination file on disk")
		return
	}
	defer out.Close()

	if _, err = io.Copy(out, in); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error copying file content")
		return
	}

	// 4. Insert new DB record for the copied file
	newRecord := models.FileRecord{
		FileName:    req.NewFileName,
		FilePath:    newRelativePath,
		Size:        oldFR.Size,
		ContentType: oldFR.ContentType,
		Uploader:    user.Username, // or oldFR.Uploader, depending on your policy
	}
	if err := fc.App.CreateFileRecord(newRecord); err != nil {
		// Optionally remove the newly-copied file from disk if DB insert fails
		os.Remove(dstPath)
		models.RespondError(w, http.StatusInternalServerError, "Error creating file record in database")
		return
	}

	// Retrieve the new file ID
	newFileID, err := fc.App.GetFileIDByPath(newRelativePath)
	if err == nil && newFileID > 0 {
		// Optionally create a version record for the new file
		if verr := fc.App.CreateFileVersion(newFileID, 1, newRelativePath); verr != nil {
			log.Println("Warning: failed to create version record:", verr)
		}

		// ✅ Log the audit event for copying with action "COPY"
		action := "COPY"
		details := fmt.Sprintf("File copied from '%s' to '%s'", req.SourceFile, newRelativePath)
		fc.App.LogAudit(user.Username, newFileID, action, details)
		log.Println("Audit log added:", details)
	} else {
		log.Println("Error: File ID not found for path", newRelativePath)
	}

	// Log activity and respond
	fc.App.LogActivity(fmt.Sprintf("User '%s' copied file from '%s' to '%s'.", user.Username, req.SourceFile, newRelativePath))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("File copied to '%s' successfully", newRelativePath),
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

// MoveFileRequest represents the payload for moving a file.
type MoveFileRequest struct {
	Filename  string `json:"filename"`
	OldParent string `json:"old_parent"`
	NewParent string `json:"new_parent"`
}

// MoveFile handles moving a file from one directory to another.
func (fc *FileController) MoveFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var req MoveFileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Filename = strings.TrimSpace(req.Filename)
	req.OldParent = strings.TrimSpace(req.OldParent)
	req.NewParent = strings.TrimSpace(req.NewParent)

	if req.Filename == "" {
		models.RespondError(w, http.StatusBadRequest, "Filename is required")
		return
	}
	if req.OldParent == req.NewParent {
		models.RespondError(w, http.StatusBadRequest, "Old parent and new parent are the same")
		return
	}

	// 1) Retrieve the file record from the database.
	fr, err := fc.App.GetFileRecord(req.Filename)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "File not found in database")
		return
	}

	// 2) Check that the file is located in the specified old parent.
	expectedOldPath := filepath.Join(req.OldParent, req.Filename)
	if fr.FilePath != expectedOldPath {
		models.RespondError(w, http.StatusBadRequest, "File is not in the specified old parent")
		return
	}

	// 3) Check that the destination folder exists on disk.
	newParentDiskPath := filepath.Join("uploads", req.NewParent)
	if _, err := os.Stat(newParentDiskPath); os.IsNotExist(err) {
		models.RespondError(w, http.StatusBadRequest, "Destination folder does not exist on disk")
		return
	}

	// 4) Move the file on disk.
	oldDiskPath := filepath.Join("uploads", fr.FilePath)
	newRelativePath := filepath.Join(req.NewParent, req.Filename)
	newDiskPath := filepath.Join("uploads", newRelativePath)
	if err := os.Rename(oldDiskPath, newDiskPath); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error moving file on disk")
		return
	}

	// 5) Update the file record in the database.
	if err := fc.App.RenameFileRecord(fr.FileName, fr.FileName, newRelativePath); err != nil {
		// Attempt rollback on disk move.
		os.Rename(newDiskPath, oldDiskPath)
		models.RespondError(w, http.StatusInternalServerError, "Error updating file record in DB")
		return
	}

	fc.App.LogActivity(fmt.Sprintf("User '%s' moved file '%s' from '%s' to '%s'.",
		user.Username, req.Filename, req.OldParent, req.NewParent))

	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("File '%s' moved successfully", req.Filename),
	})
}
