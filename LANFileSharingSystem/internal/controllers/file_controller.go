package controllers

import (
	"LANFileSharingSystem/internal/encryption"
	"LANFileSharingSystem/internal/models"
	"LANFileSharingSystem/internal/services"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/exec"
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

	// --- Auto-renaming logic to ensure a unique file name ---
	uniqueFileName := rawFileName
	relativePath := filepath.Join(targetDir, uniqueFileName)
	finalDiskPath := filepath.Join(uploadBase, relativePath)
	counter := 1
	for {
		if _, err := fc.App.GetFileRecordByPath(relativePath); err != nil {
			break
		}
		baseName := strings.TrimSuffix(rawFileName, filepath.Ext(rawFileName))
		ext := filepath.Ext(rawFileName)
		uniqueFileName = fmt.Sprintf("%s_%d%s", baseName, counter, ext)
		relativePath = filepath.Join(targetDir, uniqueFileName)
		finalDiskPath = filepath.Join(uploadBase, relativePath)
		counter++
	}
	// --- End of auto-renaming logic ---

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
		models.RespondError(w, http.StatusBadRequest, fmt.Sprintf("File rejected: %v", scanResult.Description))
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
	os.Remove(tempFilePath)

	// 7) Read the confidential flag from the form.
	// If the value is "true", then isConfidential will be true; otherwise, it is false.
	confidentialStr := r.FormValue("confidential")
	isConfidential := (confidentialStr == "true")

	// Check for an existing record (i.e. re-upload)
	existingFR, getErr := fc.App.GetFileRecordByPath(relativePath)
	if getErr == nil {
		fileID := existingFR.ID

		// Update existing file's metadata
		updateErr := fc.App.UpdateFileMetadata(fileID, handler.Size, handler.Header.Get("Content-Type"), isConfidential)
		if updateErr != nil {
			models.RespondError(w, http.StatusInternalServerError, "Error updating file record")
			return
		}

		latestVer, _ := fc.App.GetLatestVersionNumber(fileID)
		newVer := latestVer + 1
		if verr := fc.App.CreateFileVersion(fileID, newVer, relativePath); verr != nil {
			log.Println("Warning: failed to create file version record:", verr)
		}

		fc.App.LogActivity(fmt.Sprintf("User '%s' re-uploaded file '%s' (version %d).", user.Username, rawFileName, newVer))
		action := "REUPLOAD"
		details := fmt.Sprintf("File '%s' re-uploaded as version %d", rawFileName, newVer)
		fc.App.LogAudit(user.Username, fileID, action, details)

		notification := []byte(fmt.Sprintf(`{"event": "file_uploaded", "file_name": "%s", "version": %d}`, rawFileName, newVer))
		if fc.App.NotificationHub != nil {
			fc.App.NotificationHub.Broadcast(notification)
		}

		models.RespondJSON(w, http.StatusOK, map[string]string{
			"message": fmt.Sprintf("File '%s' updated (version %d) successfully", rawFileName, newVer),
		})
		return
	}

	// New file flow: create a new file record.
	fr := models.FileRecord{
		FileName:     uniqueFileName,
		Directory:    targetDir,
		FilePath:     relativePath,
		Size:         handler.Size,
		ContentType:  handler.Header.Get("Content-Type"),
		Uploader:     user.Username,
		Confidential: isConfidential, // This sets the confidential flag based on form input.
	}

	if err := fc.App.CreateFileRecord(fr); err != nil {
		log.Println("Error saving file record:", err)
		models.RespondError(w, http.StatusInternalServerError, "Error saving file record")
		return
	}

	fileID, _ := fc.App.GetFileIDByPath(fr.FilePath)
	if fileID > 0 {
		if verr := fc.App.CreateFileVersion(fileID, 1, fr.FilePath); verr != nil {
			log.Println("Warning: failed to create version record:", verr)
		}
	}

	action := "UPLOAD"
	details := fmt.Sprintf("File '%s' uploaded (version 1)", rawFileName)
	fc.App.LogAudit(user.Username, fileID, action, details)
	fc.App.LogActivity(fmt.Sprintf("User '%s' uploaded new file '%s' (version 1).", user.Username, rawFileName))

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

	// Retrieve the current user from the session
	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Get file location parameters
	directory := r.URL.Query().Get("directory")
	fileName := r.URL.Query().Get("filename")
	if fileName == "" || directory == "" {
		models.RespondError(w, http.StatusBadRequest, "Directory and filename are required")
		return
	}

	// Sanitize inputs and build full path
	cleanDir := filepath.Clean(directory)
	cleanName := filepath.Clean(fileName)
	if strings.Contains(cleanDir, "..") || strings.Contains(cleanName, "..") {
		models.RespondError(w, http.StatusBadRequest, "Invalid path components")
		return
	}

	relativePath := filepath.Join(cleanDir, cleanName)

	// Fetch the file record by path
	fr, err := fc.App.GetFileRecordByPath(relativePath)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "File not found")
		return
	}

	// Confidentiality Check
	if fr.Confidential {
		// Allow uploader/admin or users with explicit permission
		if fr.Uploader != user.Username && user.Role != "admin" {
			allowed, err := fc.App.HasFileAccess(fr.ID, user.Username)
			if err != nil || !allowed {
				models.RespondError(w, http.StatusForbidden, "Access denied to confidential file")
				return
			}
		}
	}

	// Decryption workflow
	encryptedFilePath := filepath.Join("uploads", fr.FilePath)
	tempDecryptedPath := encryptedFilePath + ".dec"

	key := []byte(os.Getenv("ENCRYPTION_KEY"))
	if len(key) != 32 {
		models.RespondError(w, http.StatusInternalServerError, "Invalid encryption key")
		return
	}

	// Decrypt to temporary file
	if err := encryption.DecryptFile(key, encryptedFilePath, tempDecryptedPath); err != nil {
		os.Remove(tempDecryptedPath)
		log.Printf("Decryption failed for %s: %v", relativePath, err)
		models.RespondError(w, http.StatusInternalServerError,
			"Error decrypting file")
		return
	}

	// Ensure cleanup even if errors occur after this point
	defer func() {
		if err := os.Remove(tempDecryptedPath); err != nil && !os.IsNotExist(err) {
			log.Printf("Failed to clean up temp file %s: %v", tempDecryptedPath, err)
		}
	}()

	// Stream decrypted content
	f, err := os.Open(tempDecryptedPath)
	if err != nil {
		log.Printf("Failed to open decrypted file %s: %v", tempDecryptedPath, err)
		models.RespondError(w, http.StatusInternalServerError,
			"Error opening decrypted file")
		return
	}
	defer f.Close()

	w.Header().Set("Content-Type", fr.ContentType)
	w.Header().Set("Content-Disposition",
		fmt.Sprintf("attachment; filename=\"%s\"", fr.FileName))

	if _, err := io.Copy(w, f); err != nil {
		log.Printf("Streaming error for %s: %v", relativePath, err)
		models.RespondError(w, http.StatusInternalServerError,
			"Error sending file")
		return
	}

	// Audit log
	fc.App.LogActivity(
		fmt.Sprintf("User '%s' downloaded file '%s' (ID: %d)",
			user.Username, fr.FileName, fr.ID))
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
		// Fallback to the same name if not provided
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
		// If no destination_folder is given, copy into the same folder
		newRelativePath = filepath.Join(filepath.Dir(oldFR.FilePath), req.NewFileName)
	} else {
		// Paste into the user-specified folder
		newRelativePath = filepath.Join(req.DestinationFolder, req.NewFileName)
	}

	// ---------------------
	// AUTO-RENAME LOGIC
	// ---------------------
	uniqueFileName := req.NewFileName
	// We'll keep adjusting newRelativePath until it doesn't conflict.
	counter := 1
	for {
		// Check if a file record already exists with that path
		_, err := fc.App.GetFileRecordByPath(newRelativePath)
		if err != nil {
			// Not found => we can use this name
			break
		}
		// File with this name already exists => append a counter
		base := strings.TrimSuffix(uniqueFileName, filepath.Ext(uniqueFileName))
		ext := filepath.Ext(uniqueFileName)
		uniqueFileName = fmt.Sprintf("%s_%d%s", base, counter, ext)

		if req.DestinationFolder == "" {
			newRelativePath = filepath.Join(filepath.Dir(oldFR.FilePath), uniqueFileName)
		} else {
			newRelativePath = filepath.Join(req.DestinationFolder, uniqueFileName)
		}
		counter++
	}
	dstPath := filepath.Join("uploads", newRelativePath)
	// ---------------------

	// 3. Copy the file on disk
	in, err := os.Open(srcPath)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error opening source file on disk")
		return
	}
	defer in.Close()

	// If the destination file already exists on disk, fail for safety
	// (We’ve handled the DB side, but just in case something is out of sync)
	if _, errStat := os.Stat(dstPath); errStat == nil {
		models.RespondError(w, http.StatusConflict, "Destination file already exists on disk")
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
		FileName:    uniqueFileName,  // use the final, possibly renamed, file name
		FilePath:    newRelativePath, // likewise
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
		permissions, err := fc.App.ListFilePermissions(f.ID)
		if err != nil {
			log.Printf("Warning: could not fetch permissions for file ID %d: %v\n", f.ID, err)
			// not fatal, just continue
		}
		// Build an array of permission objects with a "username" property
		var permissionObjects []map[string]string
		for _, p := range permissions {
			permissionObjects = append(permissionObjects, map[string]string{"username": p.Username})
		}
		output = append(output, map[string]interface{}{
			"name":         f.FileName,
			"type":         "file",        // for your frontend to distinguish
			"size":         f.Size,        // in bytes
			"contentType":  f.ContentType, // renamed from content_type
			"uploader":     f.Uploader,
			"id":           f.ID,
			"confidential": f.Confidential,
			"permissions":  permissionObjects,
		})
	}

	// Respond with the JSON array.
	models.RespondJSON(w, http.StatusOK, output)
}

// ListAllFiles handles retrieving all file records from the database.
func (fc *FileController) ListAllFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	// Check if user is authenticated
	if _, err := fc.App.GetUserFromSession(r); err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Query all file records from the database.
	files, err := fc.App.ListAllFiles()
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error retrieving files")
		return
	}

	// Convert FileRecord objects into JSON-friendly maps.
	var output []map[string]interface{}
	for _, f := range files {
		output = append(output, map[string]interface{}{
			"name":         f.FileName,
			"type":         "file",
			"size":         f.Size,
			"contentType":  f.ContentType,
			"uploader":     f.Uploader,
			"id":           f.ID,
			"confidential": f.Confidential,
		})
	}

	// Respond with the JSON array.
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

// MoveFile handles moving a file from one folder to another.
func (fc *FileController) MoveFile(w http.ResponseWriter, r *http.Request) {
	// Only allow POST requests
	if r.Method != http.MethodPost {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	// Ensure the user is authenticated
	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Expected JSON body: {"filename": "example.txt", "old_parent": "OldFolder", "new_parent": "NewFolder"}
	var req models.MoveFileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Trim spaces from inputs
	req.Filename = strings.TrimSpace(req.Filename)
	req.OldParent = strings.TrimSpace(req.OldParent)
	req.NewParent = strings.TrimSpace(req.NewParent)
	if req.Filename == "" || req.NewParent == "" {
		models.RespondError(w, http.StatusBadRequest, "Filename and new parent folder are required")
		return
	}

	// Retrieve the file record by filename.
	fr, err := fc.App.GetFileRecord(req.Filename)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "File not found")
		return
	}

	// Get the current directory from the DB record.
	currentDir := filepath.Dir(fr.FilePath)
	if req.OldParent != currentDir {
		// Log a warning and use the DB value.
		log.Printf("Warning: Provided old_parent (%s) does not match file's current directory (%s). Using DB value.", req.OldParent, currentDir)
		req.OldParent = currentDir
	}

	uploadBase := "uploads"
	oldFullPath := filepath.Join(uploadBase, fr.FilePath)
	newRelativePath := filepath.Join(req.NewParent, fr.FileName)
	newFullPath := filepath.Join(uploadBase, newRelativePath)

	// Check if the source file exists on disk.
	if _, err := os.Stat(oldFullPath); os.IsNotExist(err) {
		models.RespondError(w, http.StatusNotFound, "Source file does not exist on disk")
		return
	}

	// Ensure the target directory exists.
	if err := os.MkdirAll(filepath.Dir(newFullPath), 0755); err != nil {
		log.Printf("Error creating destination directory: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Error creating destination directory")
		return
	}

	log.Printf("Moving file from %s to %s", oldFullPath, newFullPath)
	// Move the file on disk.
	if err := os.Rename(oldFullPath, newFullPath); err != nil {
		log.Printf("os.Rename error: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Error moving file on disk")
		return
	}

	// Update the file record in the database.
	if err := fc.App.RenameFileRecord(req.Filename, fr.FileName, newRelativePath); err != nil {
		// Attempt to roll back the move if the DB update fails.
		os.Rename(newFullPath, oldFullPath)
		log.Printf("Database update error: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Error updating file record in database")
		return
	}

	// Log audit activity for the move.
	action := "MOVE"
	details := fmt.Sprintf("File '%s' moved from '%s' to '%s'", fr.FileName, req.OldParent, req.NewParent)
	fc.App.LogAudit(user.Username, fr.ID, action, details)
	fc.App.LogActivity(fmt.Sprintf("User '%s' moved file '%s' from '%s' to '%s'", user.Username, fr.FileName, req.OldParent, req.NewParent))

	// Respond with success.
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("File '%s' moved successfully to folder '%s'", fr.FileName, req.NewParent),
	})
}

// RevokeFileAccess handles revoking access to a confidential file.
func (fc *FileController) RevokeFileAccess(w http.ResponseWriter, r *http.Request) {
	// Ensure the user is authenticated.
	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Parse JSON input.
	var req struct {
		FileID     int    `json:"file_id"`
		TargetUser string `json:"target_user"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate input.
	if strings.TrimSpace(req.TargetUser) == "" {
		models.RespondError(w, http.StatusBadRequest, "Target username cannot be empty")
		return
	}

	// ✅ Check if target user exists (optional but recommended).
	if _, err := fc.App.GetUserByUsername(req.TargetUser); err != nil {
		models.RespondError(w, http.StatusNotFound, "Target user not found")
		return
	}

	// Retrieve the file record.
	fileRecord, err := fc.App.GetFileRecordByID(req.FileID)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "File not found")
		return
	}

	// Validate file confidentiality.
	if !fileRecord.Confidential {
		models.RespondError(w, http.StatusBadRequest, "File is not confidential")
		return
	}

	// Authorization check.
	if fileRecord.Uploader != user.Username && user.Role != "admin" {
		models.RespondError(w, http.StatusForbidden, "Not authorized to revoke access")
		return
	}

	// Check if the user has access (optional but improves feedback).
	hasAccess, err := fc.App.HasFileAccess(req.FileID, req.TargetUser)
	if err != nil || !hasAccess {
		models.RespondError(w, http.StatusBadRequest, "User does not have access to this file")
		return
	}

	// Revoke access.
	if err := fc.App.RevokeFileAccess(req.FileID, req.TargetUser); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error revoking access")
		return
	}
	fc.App.LogAudit(user.Username, req.FileID, "REVOKE_ACCESS", fmt.Sprintf("Access revoked for user '%s' for file '%d'", req.TargetUser, req.FileID))

	// Log and respond.
	fc.App.LogActivity(fmt.Sprintf("User '%s' revoked access to file '%d' for user '%s'.", user.Username, req.FileID, req.TargetUser))
	models.RespondJSON(w, http.StatusOK, map[string]string{"message": "Access revoked"})
}

// GrantFileAccess handles granting access to a confidential file.
func (fc *FileController) GrantFileAccess(w http.ResponseWriter, r *http.Request) {
	// Ensure the user is authenticated.
	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Parse JSON input.
	var req struct {
		FileID     int    `json:"file_id"`
		TargetUser string `json:"target_user"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Optional: Check that the target username is not empty.
	if strings.TrimSpace(req.TargetUser) == "" {
		models.RespondError(w, http.StatusBadRequest, "Target username cannot be empty")
		return
	}
	if _, err := fc.App.GetUserByUsername(req.TargetUser); err != nil {
		models.RespondError(w, http.StatusNotFound, "Target user not found")
		return
	}

	log.Printf("GrantFileAccess called with fileID: %d", req.FileID)

	// Retrieve the file record by its ID.
	fileRecord, err := fc.App.GetFileRecordByID(req.FileID)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "File not found")
		return
	}

	// Ensure the file is marked confidential.
	if !fileRecord.Confidential {
		models.RespondError(w, http.StatusBadRequest, "File is not confidential")
		return
	}

	// Allow only the uploader or an admin to grant permission.
	if fileRecord.Uploader != user.Username && user.Role != "admin" {
		models.RespondError(w, http.StatusForbidden, "Not authorized to grant access to this file")
		return
	}

	// Grant access.
	if err := fc.App.GrantFileAccess(req.FileID, req.TargetUser, user.Username); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error granting access")
		return
	}
	fc.App.LogAudit(user.Username, req.FileID, "GRANT_ACCESS", fmt.Sprintf("Access granted to user '%s' for file '%d'", req.TargetUser, req.FileID))

	// Log activity and return success.
	fc.App.LogActivity(fmt.Sprintf("User '%s' granted access to file '%d' for user '%s'.", user.Username, req.FileID, req.TargetUser))
	models.RespondJSON(w, http.StatusOK, map[string]string{"message": "Access granted"})
}

// Preview handles file preview requests by decrypting files and sending them with inline disposition.
func (fc *FileController) Preview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	directory := r.URL.Query().Get("directory")
	fileName := r.URL.Query().Get("filename")
	if fileName == "" || directory == "" {
		models.RespondError(w, http.StatusBadRequest, "Directory and filename are required")
		return
	}

	cleanDir := filepath.Clean(directory)
	cleanName := filepath.Clean(fileName)
	if strings.Contains(cleanDir, "..") || strings.Contains(cleanName, "..") {
		models.RespondError(w, http.StatusBadRequest, "Invalid path components")
		return
	}

	relativePath := filepath.Join(cleanDir, cleanName)

	fr, err := fc.App.GetFileRecordByPath(relativePath)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "File not found")
		return
	}

	if fr.Confidential && fr.Uploader != user.Username && user.Role != "admin" {
		allowed, err := fc.App.HasFileAccess(fr.ID, user.Username)
		if err != nil || !allowed {
			models.RespondError(w, http.StatusForbidden, "Access denied to confidential file")
			return
		}
	}

	encryptedFilePath := filepath.Join("uploads", fr.FilePath)
	tempDecryptedPath := encryptedFilePath + ".dec"

	key := []byte(os.Getenv("ENCRYPTION_KEY"))
	if len(key) != 32 {
		models.RespondError(w, http.StatusInternalServerError, "Invalid encryption key")
		return
	}

	if err := encryption.DecryptFile(key, encryptedFilePath, tempDecryptedPath); err != nil {
		os.Remove(tempDecryptedPath)
		log.Printf("Decryption failed for %s: %v", relativePath, err)
		models.RespondError(w, http.StatusInternalServerError, "Error decrypting file")
		return
	}
	defer os.Remove(tempDecryptedPath)

	ext := strings.ToLower(filepath.Ext(fr.FileName))
	supportedDirectly := []string{".pdf", ".jpg", ".jpeg", ".png", ".gif"}
	needsConversion := true
	for _, s := range supportedDirectly {
		if ext == s {
			needsConversion = false
			break
		}
	}

	finalPath := tempDecryptedPath
	contentType := fr.ContentType

	if needsConversion {
		tempDir, err := ioutil.TempDir("", "libreoffice_convert")
		if err != nil {
			models.RespondError(w, http.StatusInternalServerError, "Error creating temp dir for conversion")
			return
		}
		defer os.RemoveAll(tempDir)

		cmd := exec.Command("/Applications/LibreOffice.app/Contents/MacOS/soffice",
			"--headless", "--convert-to", "pdf",
			"--outdir", tempDir,
			tempDecryptedPath)

		out, err := cmd.CombinedOutput()
		log.Printf("LibreOffice conversion command output:\n%s", string(out))
		if err != nil {
			log.Printf("LibreOffice conversion failed: %v", err)
			models.RespondError(w, http.StatusInternalServerError, "Failed to convert file for preview")
			return
		}

		// Dynamically find the first PDF in tempDir
		files, err := ioutil.ReadDir(tempDir)
		if err != nil {
			models.RespondError(w, http.StatusInternalServerError, "Could not list converted files")
			return
		}

		var convertedPDF string
		for _, f := range files {
			if !f.IsDir() && strings.HasSuffix(f.Name(), ".pdf") {
				convertedPDF = filepath.Join(tempDir, f.Name())
				break
			}
		}

		if convertedPDF == "" {
			log.Printf("No PDF found in conversion output: %v", files)
			models.RespondError(w, http.StatusInternalServerError, "Converted PDF not found after conversion")
			return
		}

		finalPath = convertedPDF
		contentType = "application/pdf"
	}

	f, err := os.Open(finalPath)
	if err != nil {
		log.Printf("Failed to open preview file: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Error opening file for preview")
		return
	}
	defer f.Close()

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fr.FileName))

	if _, err := io.Copy(w, f); err != nil {
		log.Printf("Preview streaming error: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Error sending preview")
		return
	}

	fc.App.LogActivity(fmt.Sprintf("User '%s' previewed file '%s' (ID: %d)", user.Username, fr.FileName, fr.ID))
}
