package controllers

import (
	"LANFileSharingSystem/internal/encryption"
	"LANFileSharingSystem/internal/models"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

type FileController struct {
	App *models.App
}

func NewFileController(app *models.App) *FileController {
	return &FileController{App: app}
}

// handles file uploads.
func (fc *FileController) Upload(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("🔥 Recovered from panic in Upload: %v", r)
			models.RespondError(w, http.StatusInternalServerError, "Internal server error")
		}
	}()

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

	file, handler, err := r.FormFile("file")
	if err != nil {
		models.RespondError(w, http.StatusBadRequest, "Error retrieving the file")
		return
	}
	defer file.Close()

	allowedExtensions := map[string]bool{
		// Word documents
		".doc":  true,
		".docx": true,
		// Excel spreadsheets
		".xls":  true,
		".xlsx": true,
		// PowerPoint presentations
		".ppt":  true,
		".pptx": true,
		// PDF documents
		".pdf": true,
		// Image formats
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".gif":  true,
		".bmp":  true,
		".tiff": true,
		".tif":  true,
	}

	allowedMIMETypes := map[string]bool{
		// Word documents
		"application/msword": true,
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
		// Excel spreadsheets
		"application/vnd.ms-excel": true,
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
		// PowerPoint presentations
		"application/vnd.ms-powerpoint":                                             true,
		"application/vnd.openxmlformats-officedocument.presentationml.presentation": true,
		// PDF documents
		"application/pdf": true,
		// Image formats
		"image/jpeg": true,
		"image/png":  true,
		"image/gif":  true,
		"image/bmp":  true,
		"image/tiff": true,
	}

	ext := strings.ToLower(filepath.Ext(handler.Filename))
	mime := handler.Header.Get("Content-Type")
	log.Printf("Uploaded file: %s, MIME type: %s\n", handler.Filename, mime)

	if !allowedExtensions[ext] || !allowedMIMETypes[mime] {
		models.RespondError(w, http.StatusBadRequest, "Only Word, Excel, PowerPoint, PDF, and image files (JPG, PNG, GIF) with valid MIME types are allowed")
		return
	}

	targetDir := r.FormValue("directory")
	log.Println("🟡 Got upload directory (raw):", targetDir)

	if targetDir != "" {
		// Normalize and sanitize
		cleanTarget := filepath.Clean(targetDir)
		parts := strings.Split(cleanTarget, string(os.PathSeparator))

		// Ensure consistent directory format - always use forward slashes
		// and lowercase for consistent database storage and retrieval
		for i := range parts {
			parts[i] = strings.ToLower(parts[i])
		}

		// Rebuild the path with forward slashes for consistent storage
		targetDir = strings.Join(parts, "/")
		log.Println("📁 Normalized upload directory:", targetDir)

		if strings.HasPrefix(targetDir, "..") {
			models.RespondError(w, http.StatusBadRequest, "Invalid directory path")
			return
		}

		if len(parts) > 0 {
			topFolder := parts[0]
			validTopFolders := map[string]bool{
				"operation": true,
				"research":  true,
				"training":  true,
			}
			if !validTopFolders[topFolder] {
				models.RespondError(w, http.StatusBadRequest, "Invalid top-level folder")
				return
			}
		}
	}

	overwrite := r.FormValue("overwrite") == "true"

	uploadBase := "Cdrrmo"
	rawFileName := handler.Filename
	relativePath := filepath.Join(targetDir, rawFileName)
	finalDiskPath := filepath.Join(uploadBase, relativePath)

	existingFR, getErr := fc.App.GetFileRecordByPath(relativePath)

	skip := r.FormValue("skip") == "true"
	if getErr == nil && skip {
		models.RespondJSON(w, http.StatusOK, map[string]string{
			"message": fmt.Sprintf("File '%s' skipped (already exists)", rawFileName),
		})
		return
	}

	if getErr == nil && !overwrite {
		baseName := strings.TrimSuffix(rawFileName, filepath.Ext(rawFileName))
		ext := filepath.Ext(rawFileName)
		counter := 1
		for {
			uniqueFileName := fmt.Sprintf("%s_%d%s", baseName, counter, ext)
			rel := filepath.Join(targetDir, uniqueFileName)
			if _, err := fc.App.GetFileRecordByPath(rel); err != nil {
				relativePath = rel
				finalDiskPath = filepath.Join(uploadBase, rel)
				break
			}
			counter++
		}
	}

	if err := os.MkdirAll(filepath.Dir(finalDiskPath), 0755); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error creating target directory")
		return
	}

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

	key := []byte(os.Getenv("ENCRYPTION_KEY"))
	log.Printf("🔐 ENCRYPTION_KEY length: %d", len(key))
	if len(key) != 32 {
		log.Println("❌ Invalid ENCRYPTION_KEY length or missing key")
		os.Remove(tempFilePath)
		models.RespondError(w, http.StatusInternalServerError, "Invalid encryption key")
		return
	}

	if err := encryption.EncryptFile(key, tempFilePath, finalDiskPath); err != nil {
		os.Remove(tempFilePath)
		models.RespondError(w, http.StatusInternalServerError, "Error encrypting file")
		return
	}
	os.Remove(tempFilePath)

	metaJSON := r.FormValue("metadata")
	var metaMap map[string]interface{}
	if metaJSON != "" {
		if err := json.Unmarshal([]byte(metaJSON), &metaMap); err != nil {
			models.RespondError(w, http.StatusBadRequest, "Invalid metadata JSON")
			return
		}
	}

	existingFR, getErr = fc.App.GetFileRecordByPath(relativePath)
	if getErr == nil && overwrite {
		fileID := existingFR.ID
		updateErr := fc.App.UpdateFileMetadata(fileID, handler.Size, handler.Header.Get("Content-Type"))
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
		fc.App.LogAudit(user.Username, fileID, "REUPLOAD", fmt.Sprintf("File '%s' re-uploaded as version %d", rawFileName, newVer))

		if fc.App.NotificationHub != nil {
			notification := []byte(fmt.Sprintf(`{"event": "file_uploaded", "file_name": "%s", "version": %d}`, rawFileName, newVer))
			fc.App.NotificationHub.Broadcast(notification)
		}

		models.RespondJSON(w, http.StatusOK, map[string]string{
			"message": fmt.Sprintf("File '%s' updated (version %d) successfully", rawFileName, newVer),
		})
		return
	}

	fr := models.FileRecord{
		FileName:    filepath.Base(relativePath),
		Directory:   targetDir,
		FilePath:    relativePath,
		Size:        handler.Size,
		ContentType: handler.Header.Get("Content-Type"),
		Uploader:    user.Username,
		Metadata:    metaMap,
		CreatedAt:   time.Now(),
	}
	log.Println("📁 File saved to directory:", fr.Directory)

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

	fc.App.LogAudit(user.Username, fileID, "UPLOAD", fmt.Sprintf("File '%s' uploaded (version 1)", rawFileName))
	fc.App.LogActivity(fmt.Sprintf("User '%s' uploaded new file '%s' (version 1).", user.Username, rawFileName))

	if fc.App.NotificationHub != nil {
		notification := []byte(fmt.Sprintf(`{"event": "file_uploaded", "file_name": "%s", "version": 1}`, rawFileName))
		fc.App.NotificationHub.Broadcast(notification)
	}

	// --- File instruction/message logic ---
	messageText := r.FormValue("message")
	receiver := r.FormValue("receiver")
	if messageText != "" && receiver != "" && user.Role == "admin" && fileID > 0 {
		// Get the exact username with correct capitalization from the database
		var exactUsername string
		err := fc.App.DB.QueryRow(`SELECT username FROM users WHERE LOWER(username) = LOWER($1)`, receiver).Scan(&exactUsername)
		if err != nil {
			exactUsername = receiver // fallback
		}
		// Prevent sending to self
		if !strings.EqualFold(user.Username, exactUsername) {
			_, err := fc.App.DB.Exec(`INSERT INTO file_messages (file_id, sender, receiver, message) VALUES ($1, $2, $3, $4)`, fileID, user.Username, exactUsername, messageText)
			if err == nil && fc.App.NotificationHub != nil {
				var filePath string
				_ = fc.App.DB.QueryRow(`SELECT file_path FROM files WHERE id = $1`, fileID).Scan(&filePath)
				notification := map[string]string{
					"type":      "new_instruction",
					"receiver":  exactUsername,
					"message":   messageText,
					"file_id":   fmt.Sprintf("%d", fileID),
					"sender":    user.Username,
					"file_path": filePath,
				}
				notifBytes, _ := json.Marshal(notification)
				fc.App.NotificationHub.SendToUser(exactUsername, notifBytes)
			}
		}
	}

	models.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"message": fmt.Sprintf("File '%s' uploaded (version 1) successfully", rawFileName),
		"file_id": fileID,
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
	oldFullPath := filepath.Join("Cdrrmo", oldFR.FilePath)
	newRelativePath := filepath.Join(filepath.Dir(oldFR.FilePath), req.NewFilename)
	newFullPath := filepath.Join("Cdrrmo", newRelativePath)

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
		Filename  string `json:"filename"`
		Directory string `json:"directory"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Filename = strings.TrimSpace(req.Filename)
	req.Directory = strings.TrimSpace(req.Directory)

	if req.Filename == "" {
		models.RespondError(w, http.StatusBadRequest, "Filename cannot be empty")
		return
	}

	// Normalize the path components
	cleanDir := strings.ToLower(strings.Trim(filepath.Clean(req.Directory), `/\`))
	cleanName := strings.Trim(filepath.Clean(req.Filename), `/\`)
	relativePath := filepath.Join(cleanDir, cleanName)

	log.Printf("🗑 Attempting to delete file: '%s' from directory: '%s' (path: '%s')",
		req.Filename, req.Directory, relativePath)

	fr, err := fc.App.GetFileRecordByPath(relativePath)
	if err != nil {
		log.Printf("❌ Error finding file record for path '%s': %v", relativePath, err)

		// Try to find by filename as a fallback
		rows, queryErr := fc.App.DB.Query("SELECT id, file_name, file_path FROM files WHERE file_name = $1", cleanName)
		if queryErr == nil {
			defer rows.Close()

			var possibleFiles []string
			for rows.Next() {
				var id int
				var name, path string
				if scanErr := rows.Scan(&id, &name, &path); scanErr == nil {
					possibleFiles = append(possibleFiles, fmt.Sprintf("ID: %d, Name: %s, Path: %s", id, name, path))
				}
			}

			if len(possibleFiles) > 0 {
				errorMsg := fmt.Sprintf("File not found at path '%s'. Similar files found: %s",
					relativePath, strings.Join(possibleFiles, "; "))
				models.RespondError(w, http.StatusNotFound, errorMsg)
				return
			}
		}

		models.RespondError(w, http.StatusNotFound, fmt.Sprintf("File '%s' not found in database", req.Filename))
		return
	}

	// Log the audit before deletion
	fc.App.LogAudit(user.Username, fr.ID, "DELETE", fmt.Sprintf("File '%s' deleted", fr.FileName))

	fullPath := filepath.Join("Cdrrmo", fr.FilePath)
	log.Printf("[DeleteFile] Deleting file from disk: '%s' (this is a real delete)", fullPath)

	if removeErr := os.Remove(fullPath); removeErr != nil && !os.IsNotExist(removeErr) {
		log.Printf("❌ Error removing file from disk: %v", removeErr)
		models.RespondError(w, http.StatusInternalServerError, "Error deleting file from local storage")
		return
	}

	log.Printf("🗑 Deleting file record from database: '%s'", fr.FilePath)
	fileID, err := fc.App.DeleteFileRecordByPath(fr.FilePath) // Use the path from the found record
	if err != nil {
		log.Printf("❌ Error deleting file record: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Error deleting file record from database")
		return
	}

	if delVerErr := fc.App.DeleteFileVersions(fileID); delVerErr != nil {
		log.Printf("Warning: could not delete file versions for ID %d: %v\n", fileID, delVerErr)
	}

	fc.App.LogActivity(fmt.Sprintf("User '%s' deleted file '%s'.", user.Username, fr.FileName))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("File '%s' deleted successfully", fr.FileName),
	})
}

// Download handles file download requests by decrypting files before sending.
func (fc *FileController) Download(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	dirRaw := r.URL.Query().Get("directory")
	fileRaw := r.URL.Query().Get("filename")

	if dirRaw == "" || fileRaw == "" {
		models.RespondError(w, http.StatusBadRequest, "Directory and filename are required")
		return
	}

	directory, err := url.QueryUnescape(dirRaw)
	if err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid directory encoding")
		return
	}

	fileName, err := url.QueryUnescape(fileRaw)
	if err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid filename encoding")
		return
	}

	// Normalize directory to lowercase
	cleanDir := strings.ToLower(strings.Trim(filepath.Clean(directory), `/\`))
	cleanName := strings.Trim(filepath.Clean(fileName), `/\`)

	if cleanDir == "" || cleanName == "" ||
		strings.HasPrefix(cleanDir, "..") || strings.HasPrefix(cleanName, "..") ||
		strings.Contains(cleanDir, "/..") || strings.Contains(cleanName, "/..") {
		models.RespondError(w, http.StatusBadRequest, "Invalid path components")
		return
	}

	relativePath := filepath.Join(cleanDir, cleanName)
	log.Println("🔎 Downloading relative path:", relativePath)

	fr, err := fc.App.GetFileRecordByPath(relativePath)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "File not found")
		return
	}

	encryptedFilePath := filepath.Join("Cdrrmo", fr.FilePath)
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
	defer func() {
		if err := os.Remove(tempDecryptedPath); err != nil && !os.IsNotExist(err) {
			log.Printf("Failed to clean up temp file %s: %v", tempDecryptedPath, err)
		}
	}()

	f, err := os.Open(tempDecryptedPath)
	if err != nil {
		log.Printf("Failed to open decrypted file %s: %v", tempDecryptedPath, err)
		models.RespondError(w, http.StatusInternalServerError, "Error opening decrypted file")
		return
	}
	defer f.Close()

	w.Header().Set("Content-Type", fr.ContentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fr.FileName))

	if _, err := io.Copy(w, f); err != nil {
		log.Printf("Streaming error for %s: %v", relativePath, err)
		models.RespondError(w, http.StatusInternalServerError, "Error sending file")
		return
	}

	fc.App.LogActivity(fmt.Sprintf("User '%s' downloaded file '%s' (ID: %d)", user.Username, fr.FileName, fr.ID))
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
		DestinationFolder string `json:"destination_folder"`
		Overwrite         bool   `json:"overwrite"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.SourceFile = strings.TrimSpace(req.SourceFile)
	req.NewFileName = strings.TrimSpace(req.NewFileName)
	req.DestinationFolder = strings.TrimSpace(req.DestinationFolder)

	if req.SourceFile == "" {
		models.RespondError(w, http.StatusBadRequest, "Source file is required")
		return
	}

	oldFR, err := fc.App.GetFileRecord(req.SourceFile)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "Source file not found in database")
		return
	}

	srcPath := filepath.Join("Cdrrmo", oldFR.FilePath)
	log.Printf("[CopyFile] Source file (should not be deleted): %s", srcPath)

	finalName := req.NewFileName
	if finalName == "" {
		finalName = filepath.Base(req.SourceFile)
	}
	destFolder := req.DestinationFolder
	if destFolder == "" {
		destFolder = filepath.Dir(oldFR.FilePath)
	}

	base := strings.TrimSuffix(finalName, filepath.Ext(finalName))
	ext := filepath.Ext(finalName)
	counter := 0
	var newRelativePath string

	for {
		if counter == 0 {
			finalName = fmt.Sprintf("%s%s", base, ext)
		} else {
			finalName = fmt.Sprintf("%s (%d)%s", base, counter, ext)
		}
		newRelativePath = filepath.Join(destFolder, finalName)

		existingFR, err := fc.App.GetFileRecordByPath(newRelativePath)
		if err != nil {
			// No file exists at this path, break and use this name
			break
		}
		if req.Overwrite {
			// Check for self-overwrite (source and destination are the same file)
			if existingFR.FilePath == oldFR.FilePath {
				log.Printf("[CopyFile] ERROR: Attempted to overwrite a file with itself: %s", existingFR.FilePath)
				models.RespondError(w, http.StatusBadRequest, "Cannot overwrite a file with itself. Operation cancelled.")
				return
			}
			// Overwrite: delete destination file and DB record only if different from source
			log.Printf("[CopyFile] Overwriting: deleting destination file on disk: %s", filepath.Join("Cdrrmo", existingFR.FilePath))
			_ = os.Remove(filepath.Join("Cdrrmo", existingFR.FilePath))
			log.Printf("[CopyFile] Deleting DB file versions and record for file ID %d, path %s", existingFR.ID, existingFR.FilePath)
			_ = fc.App.DeleteFileVersions(existingFR.ID)
			_, _ = fc.App.DeleteFileRecordByPath(existingFR.FilePath)
			break
		}
		counter++
	}
	dstPath := filepath.Join("Cdrrmo", newRelativePath)

	in, err := os.Open(srcPath)
	if err != nil {
		log.Printf("[CopyFile] ERROR: Failed to open source file '%s': %v", srcPath, err)
		models.RespondError(w, http.StatusInternalServerError, "Failed to open source file")
		return
	}
	log.Printf("[CopyFile] Opened source file: %s", srcPath)
	defer in.Close()

	if _, err := os.Stat(dstPath); err == nil && !req.Overwrite {
		models.RespondError(w, http.StatusConflict, "Target file already exists on disk")
		return
	}

	out, err := os.Create(dstPath)
	if err != nil {
		log.Printf("[CopyFile] ERROR: Failed to create target file '%s': %v", dstPath, err)
		models.RespondError(w, http.StatusInternalServerError, "Failed to create target file")
		return
	}
	log.Printf("[CopyFile] Created target file: %s", dstPath)
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		log.Printf("[CopyFile] ERROR: Failed to copy file content from '%s' to '%s': %v", srcPath, dstPath, err)
		models.RespondError(w, http.StatusInternalServerError, "Failed to copy file content")
		return
	}
	log.Printf("[CopyFile] Copied content from '%s' to '%s'", srcPath, dstPath)

	newRecord := models.FileRecord{
		FileName:    finalName,
		FilePath:    newRelativePath,
		Directory:   destFolder,
		Size:        oldFR.Size,
		ContentType: oldFR.ContentType,
		Uploader:    user.Username,
	}

	if err := fc.App.CreateFileRecord(newRecord); err != nil {
		os.Remove(dstPath)
		log.Printf("[CopyFile] ERROR: DB insert failed for new file record %+v: %v", newRecord, err)
		models.RespondError(w, http.StatusInternalServerError, "Failed to save file record")
		return
	}
	log.Printf("[CopyFile] Inserted new file record: %+v", newRecord)

	newFileID, err := fc.App.GetFileIDByPath(newRelativePath)
	if err == nil && newFileID > 0 {
		_ = fc.App.CreateFileVersion(newFileID, 1, newRelativePath)
		fc.App.LogAudit(user.Username, newFileID, "COPY", fmt.Sprintf("File copied from '%s' to '%s'", req.SourceFile, newRelativePath))
	}

	fc.App.LogActivity(fmt.Sprintf("User '%s' copied file from '%s' to '%s'", user.Username, req.SourceFile, newRelativePath))

	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message":    fmt.Sprintf("File copied to '%s' successfully", newRelativePath),
		"final_name": finalName,
	})
}

func (fc *FileController) ListFiles(w http.ResponseWriter, r *http.Request) {
	// Ensure method is GET
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	// Check if user is authenticated
	if _, err := fc.App.GetUserFromSession(r); err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Normalize the requested directory
	dirRaw := r.URL.Query().Get("directory")
	dir := strings.ToLower(strings.TrimSpace(dirRaw))

	log.Println("📂 Requested directory:", dir)

	// Fetch files in the directory
	files, err := fc.App.ListFilesInDirectory(dir)
	if err != nil {
		log.Printf("❌ Error listing files in directory '%s': %v\n", dir, err)
		models.RespondError(w, http.StatusInternalServerError, "Error retrieving files")
		return
	}

	// Prepare output format
	output := make([]map[string]interface{}, 0, len(files))
	for _, f := range files {
		output = append(output, map[string]interface{}{
			"id":          f.ID,
			"name":        f.FileName,
			"type":        "file",
			"size":        f.Size,
			"contentType": f.ContentType,
			"uploader":    f.Uploader,
			"created_at":  f.CreatedAt.Format(time.RFC3339),
		})
	}

	// Return file list
	models.RespondJSON(w, http.StatusOK, output)
}

// ListAllFiles handles retrieving all file records from the database.
func (fc *FileController) ListAllFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	if _, err := fc.App.GetUserFromSession(r); err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	files, err := fc.App.ListAllFiles()
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error retrieving files")
		return
	}

	var output []map[string]interface{}
	for _, f := range files {
		output = append(output, map[string]interface{}{
			"name":        f.FileName,
			"type":        "file",
			"size":        f.Size,
			"contentType": f.ContentType,
			"uploader":    f.Uploader,
			"id":          f.ID,
			"created_at":  f.CreatedAt.Format(time.RFC3339),
			"directory":   f.Directory,
		})
	}

	models.RespondJSON(w, http.StatusOK, output)
}

// MoveFile handles moving a file from one folder to another.
func (fc *FileController) MoveFile(w http.ResponseWriter, r *http.Request) {
	log.Printf("[MoveFile] Handler called. Method: %s", r.Method)
	if r.Method != http.MethodPost {
		log.Printf("[MoveFile] Invalid method: %s", r.Method)
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	log.Printf("[MoveFile] Attempting to get user from session")
	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		log.Printf("[MoveFile] Not authenticated: %v", err)
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var req struct {
		ID        string `json:"id"`
		NewParent string `json:"new_parent"`
		OldParent string `json:"old_parent"`
		Filename  string `json:"filename"`
		Overwrite bool   `json:"overwrite"`
	}

	log.Printf("[MoveFile] Decoding request body")
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[MoveFile] Invalid request body: %v", err)
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Filename = strings.TrimSpace(req.Filename)
	req.OldParent = strings.TrimSpace(req.OldParent)
	req.NewParent = strings.TrimSpace(req.NewParent)

	log.Printf("[MoveFile] Parsed request: id=%s, filename=%s, old_parent=%s, new_parent=%s, overwrite=%v", req.ID, req.Filename, req.OldParent, req.NewParent, req.Overwrite)

	if req.Filename == "" || req.NewParent == "" {
		log.Printf("[MoveFile] Missing filename or new_parent")
		models.RespondError(w, http.StatusBadRequest, "Filename and new parent folder are required")
		return
	}

	id, err := strconv.Atoi(req.ID)
	if err != nil {
		log.Printf("[MoveFile] Invalid ID format: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid ID format"})
		return
	}

	log.Printf("[MoveFile] Getting file record by ID: %d", id)
	fr, err := fc.App.GetFileRecordByID(id)
	if err != nil {
		log.Printf("[MoveFile] File not found in database for id %d: %v", id, err)
		models.RespondError(w, http.StatusNotFound, "File not found in database")
		return
	}

	oldRelativePath := fr.FilePath
	oldFullPath := filepath.Join("Cdrrmo", oldRelativePath)

	base := strings.TrimSuffix(fr.FileName, filepath.Ext(fr.FileName))
	ext := filepath.Ext(fr.FileName)
	finalName := fr.FileName
	newRelativePath := filepath.Join(req.NewParent, finalName)
	newFullPath := filepath.Join("Cdrrmo", newRelativePath)

	log.Printf("[MoveFile] Checking for existing file at new location: %s", newRelativePath)
	existingFR, err := fc.App.GetFileRecordByPath(newRelativePath)
	if err == nil {
		if req.Overwrite {
			log.Printf("[MoveFile] Overwriting existing file: %s", existingFR.FilePath)
			_ = os.Remove(filepath.Join("Cdrrmo", existingFR.FilePath))
			_ = fc.App.DeleteFileVersions(existingFR.ID)

			_, deleteErr := fc.App.DeleteFileRecordByPath(existingFR.FilePath)
			if deleteErr != nil {
				log.Printf("[MoveFile] Warning: failed to delete existing file record: %v", deleteErr)
			}
		} else {
			attempt := 1
			for {
				tempName := fmt.Sprintf("%s (%d)%s", base, attempt, ext)
				tempRelPath := filepath.Join(req.NewParent, tempName)
				full := filepath.Join("Cdrrmo", tempRelPath)
				if _, err := os.Stat(full); os.IsNotExist(err) {
					finalName = tempName
					newRelativePath = tempRelPath
					newFullPath = full
					log.Printf("[MoveFile] Using new filename to avoid conflict: %s", finalName)
					break
				}
				attempt++
			}
		}
	}

	log.Printf("[MoveFile] Checking if original file exists: %s", oldFullPath)
	if _, err := os.Stat(oldFullPath); os.IsNotExist(err) {
		log.Printf("[MoveFile] Source file does not exist on disk: %s", oldFullPath)
		models.RespondError(w, http.StatusNotFound, "Source file does not exist on disk")
		return
	}

	log.Printf("[MoveFile] Ensuring destination folder exists: %s", filepath.Dir(newFullPath))
	if err := os.MkdirAll(filepath.Dir(newFullPath), 0755); err != nil {
		log.Printf("[MoveFile] Failed to create destination folder: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Failed to create destination folder")
		return
	}

	log.Printf("[MoveFile] Moving file from %s to %s", oldFullPath, newFullPath)
	if err := os.Rename(oldFullPath, newFullPath); err != nil {
		log.Printf("[MoveFile] Failed to move file on disk: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Failed to move file on disk")
		return
	}

	log.Printf("[MoveFile] Removing old file record: %s", oldRelativePath)
	_, _ = fc.App.DeleteFileRecordByPath(oldRelativePath)

	log.Printf("[MoveFile] Creating new file record for: %s", newRelativePath)
	newRecord := models.FileRecord{
		FileName:    finalName,
		FilePath:    newRelativePath,
		Directory:   req.NewParent,
		Size:        fr.Size,
		ContentType: fr.ContentType,
		Uploader:    user.Username,
	}

	if err := fc.App.CreateFileRecord(newRecord); err != nil {
		log.Printf("[MoveFile] Error saving new file record: %v", err)
		// Rollback
		_ = os.Rename(newFullPath, oldFullPath)
		models.RespondError(w, http.StatusInternalServerError, "Error saving new file record")
		return
	}

	newID, _ := fc.App.GetFileIDByPath(newRelativePath)
	fc.App.CreateFileVersion(newID, 1, newRelativePath)
	fc.App.LogAudit(user.Username, newID, "MOVE", fmt.Sprintf("Moved file from '%s' to '%s'", oldRelativePath, newRelativePath))
	fc.App.LogActivity(fmt.Sprintf("User '%s' moved file from '%s' to '%s'", user.Username, oldRelativePath, newRelativePath))

	log.Printf("[MoveFile] Successfully moved '%s' to folder '%s' (final name: %s)", fr.FileName, req.NewParent, finalName)
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message":    fmt.Sprintf("Moved '%s' to folder '%s'", finalName, req.NewParent),
		"final_name": finalName,
	})
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

	dirRaw := r.URL.Query().Get("directory")
	fileRaw := r.URL.Query().Get("filename")
	if dirRaw == "" || fileRaw == "" {
		models.RespondError(w, http.StatusBadRequest, "Directory and filename are required")
		return
	}

	directory, err := url.QueryUnescape(dirRaw)
	if err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid directory encoding")
		return
	}
	fileName, err := url.QueryUnescape(fileRaw)
	if err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid filename encoding")
		return
	}

	// Normalize directory to lowercase
	cleanDir := strings.ToLower(strings.Trim(filepath.Clean(directory), `/\`))
	cleanName := strings.Trim(filepath.Clean(fileName), `/\`)

	if cleanDir == "" || cleanName == "" ||
		strings.HasPrefix(cleanDir, "..") || strings.HasPrefix(cleanName, "..") ||
		strings.Contains(cleanDir, "/..") || strings.Contains(cleanName, "/..") {
		models.RespondError(w, http.StatusBadRequest, "Invalid path components")
		return
	}

	relativePath := filepath.Join(cleanDir, cleanName)
	log.Println("🔎 Previewing relative path:", relativePath)

	fr, err := fc.App.GetFileRecordByPath(relativePath)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "File not found")
		return
	}

	encryptedFilePath := filepath.Join("Cdrrmo", fr.FilePath)
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

	// Determine if conversion to PDF is needed
	ext := strings.ToLower(filepath.Ext(fr.FileName))
	// Files that can be directly displayed in the browser
	supported := map[string]bool{
		".pdf": true,
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true,
		".bmp": true, ".tiff": true, ".tif": true,
		".svg": true, ".webp": true,
	}
	// Store the path to final file we'll serve and its content type
	finalPath, contentType := tempDecryptedPath, fr.ContentType

	if !supported[ext] {
		// Convert non-supported files to PDF using LibreOffice
		convertibleExts := map[string]bool{
			".doc": true, ".docx": true, // Word documents
			".xls": true, ".xlsx": true, // Excel spreadsheets
			".ppt": true, ".pptx": true, // PowerPoint presentations
			".odt": true, ".ods": true, ".odp": true, // OpenDocument formats
			".txt": true, ".rtf": true, // Text formats
		}

		if convertibleExts[ext] {
			// Create a temporary directory for the conversion
			tempDir, err := os.MkdirTemp("", "libreoffice-convert-*")
			if err != nil {
				log.Printf("Failed to create temp directory for conversion: %v", err)
				// If conversion fails, fall back to download behavior
				w.Header().Set("Content-Type", contentType)
				w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fr.FileName))
				f, _ := os.Open(tempDecryptedPath)
				defer f.Close()
				io.Copy(w, f)
				return
			}
			defer os.RemoveAll(tempDir)

			// Copy the decrypted file to the temp directory
			tempFilePath := filepath.Join(tempDir, fr.FileName)
			// Copy the file manually using io operations
			srcFile, err := os.Open(tempDecryptedPath)
			if err != nil {
				log.Printf("Failed to open source file for conversion: %v", err)
				// If conversion fails, fall back to download behavior
				w.Header().Set("Content-Type", contentType)
				w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fr.FileName))
				f, _ := os.Open(tempDecryptedPath)
				if f != nil {
					defer f.Close()
					io.Copy(w, f)
				} else {
					models.RespondError(w, http.StatusInternalServerError, "Error opening file for download")
				}
				return
			}
			defer srcFile.Close()

			dstFile, err := os.Create(tempFilePath)
			if err != nil {
				log.Printf("Failed to create destination file for conversion: %v", err)
				// If conversion fails, fall back to download behavior
				w.Header().Set("Content-Type", contentType)
				w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fr.FileName))
				f, _ := os.Open(tempDecryptedPath)
				if f != nil {
					defer f.Close()
					io.Copy(w, f)
				} else {
					models.RespondError(w, http.StatusInternalServerError, "Error opening file for download")
				}
				return
			}
			defer dstFile.Close()

			// Copy contents
			if _, err := io.Copy(dstFile, srcFile); err != nil {
				log.Printf("Failed to copy file contents for conversion: %v", err)
				// If conversion fails, fall back to download behavior
				w.Header().Set("Content-Type", contentType)
				w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fr.FileName))
				f, _ := os.Open(tempDecryptedPath)
				if f != nil {
					defer f.Close()
					io.Copy(w, f)
				} else {
					models.RespondError(w, http.StatusInternalServerError, "Error opening file for download")
				}
				return
			}

			// Run LibreOffice to convert to PDF
			// Use default installations paths for LibreOffice on Windows
			libreOfficePaths := []string{
				`C:\Program Files\LibreOffice\program\soffice.exe`,
				`C:\Program Files (x86)\LibreOffice\program\soffice.exe`,
				"soffice", // Try the command directly if in PATH
			}

			var cmd *exec.Cmd
			var execErr error
			var output []byte

			// Try each possible LibreOffice path
			for _, path := range libreOfficePaths {
				log.Printf("Attempting to use LibreOffice at: %s", path)
				cmd = exec.Command(path, "--headless", "--convert-to", "pdf", "--outdir", tempDir, tempFilePath)
				output, execErr = cmd.CombinedOutput()
				if execErr == nil {
					// Successfully executed
					log.Printf("Successfully executed LibreOffice conversion using: %s", path)
					break
				}
				log.Printf("Failed with path %s: %v", path, execErr)
			}

			// Check if any of the attempts succeeded
			if execErr != nil {
				log.Printf("LibreOffice conversion failed: %v, Output: %s", execErr, output)
				// If conversion fails, fall back to download behavior
				w.Header().Set("Content-Type", contentType)
				w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fr.FileName))
				f, _ := os.Open(tempDecryptedPath)
				defer f.Close()
				io.Copy(w, f)
				return
			}

			// Get the generated PDF file path
			baseName := strings.TrimSuffix(fr.FileName, ext)
			pdfFilePath := filepath.Join(tempDir, baseName+".pdf")

			// Check if PDF was created
			if _, err := os.Stat(pdfFilePath); err != nil {
				log.Printf("PDF file not created: %v", err)
				// If conversion fails, fall back to download behavior
				w.Header().Set("Content-Type", contentType)
				w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fr.FileName))
				f, _ := os.Open(tempDecryptedPath)
				defer f.Close()
				io.Copy(w, f)
				return
			}

			// Update the path and content type to the converted PDF
			finalPath = pdfFilePath
			contentType = "application/pdf"
			log.Printf("Successfully converted %s to PDF for preview", fr.FileName)
		} else {
			// For other file types that can't be converted, fall back to download behavior
			w.Header().Set("Content-Type", contentType)
			w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fr.FileName))
			f, _ := os.Open(tempDecryptedPath)
			defer f.Close()
			io.Copy(w, f)
			return
		}
	}

	// Stream out inline
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

// Note: copyFile is already defined in directory_controller.go

// inside SendFileMessage, add filePath before building the notification

func (fc *FileController) SendFileMessage(w http.ResponseWriter, r *http.Request) {
	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	if user.Role != "admin" {
		models.RespondError(w, http.StatusForbidden, "Only admins can send file instructions")
		return
	}

	var msg models.FileMessage
	if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid message format")
		return
	}

	if msg.FileID == 0 || msg.Receiver == "" || msg.Message == "" {
		models.RespondError(w, http.StatusBadRequest, "Missing file ID, receiver, or message content")
		return
	}

	msg.Sender = user.Username

	// 🛑 Prevent sending to self (case-insensitive check)
	if strings.EqualFold(msg.Sender, msg.Receiver) {
		models.RespondError(w, http.StatusBadRequest, "You cannot send instructions to yourself")
		return
	}

	// Check if the receiver exists in the database
	var receiverExists bool
	err = fc.App.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER($1))`, msg.Receiver).Scan(&receiverExists)
	if err != nil {
		log.Printf("❌ Error checking if receiver exists: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Failed to verify receiver")
		return
	}

	if !receiverExists {
		log.Printf("❌ Receiver '%s' does not exist in the database", msg.Receiver)
		models.RespondError(w, http.StatusBadRequest, "Receiver does not exist")
		return
	}

	// Get the exact username with correct capitalization from the database
	var exactUsername string
	err = fc.App.DB.QueryRow(`SELECT username FROM users WHERE LOWER(username) = LOWER($1)`, msg.Receiver).Scan(&exactUsername)
	if err != nil {
		log.Printf("❌ Error getting exact username: %v", err)
		// Continue with the provided username if we can't get the exact one
	} else {
		// Use the exact username from the database to ensure correct capitalization
		msg.Receiver = exactUsername
		log.Printf("📨 Using exact username from database: '%s'", exactUsername)
	}

	// retrieve file path for this file ID
	var filePath string
	err = fc.App.DB.QueryRow(`SELECT file_path FROM files WHERE id = $1`, msg.FileID).Scan(&filePath)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "File path not found for given ID")
		return
	}

	log.Printf("📨 Sending message to user '%s' for file ID %d", msg.Receiver, msg.FileID)

	_, err = fc.App.DB.Exec(
		`INSERT INTO file_messages (file_id, sender, receiver, message) VALUES ($1, $2, $3, $4)`,
		msg.FileID, msg.Sender, msg.Receiver, msg.Message,
	)
	if err != nil {
		log.Printf("❌ Error inserting message into database: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Failed to send message")
		return
	}

	log.Printf("✅ Message successfully inserted into database for user '%s'", msg.Receiver)

	if fc.App.NotificationHub != nil {
		notification := map[string]string{
			"type":      "new_instruction",
			"receiver":  msg.Receiver,
			"message":   msg.Message,
			"file_id":   fmt.Sprintf("%d", msg.FileID),
			"sender":    msg.Sender,
			"file_path": filePath,
		}

		notifBytes, _ := json.Marshal(notification)
		fc.App.NotificationHub.SendToUser(msg.Receiver, notifBytes)
		log.Printf("📨 Notification sent to user '%s'", msg.Receiver)
	}

	models.RespondJSON(w, http.StatusOK, map[string]string{"message": "Instruction sent"})
}

func (fc *FileController) GetFileMessages(w http.ResponseWriter, r *http.Request) {
	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	fileIDStr := r.URL.Query().Get("file_id")
	fileID, err := strconv.Atoi(fileIDStr)
	if err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid file ID")
		return
	}

	log.Printf("📨 Fetching messages for file ID %d by user '%s'", fileID, user.Username)

	var rows *sql.Rows
	if user.Role == "admin" {
		// Admin can see all messages for this file
		rows, err = fc.App.DB.Query(`
			SELECT id, file_id, sender, receiver, message, is_done, created_at
			FROM file_messages
			WHERE file_id = $1
			ORDER BY created_at DESC
		`, fileID)
	} else {
		// Regular users only see messages addressed to them - using case-insensitive comparison
		rows, err = fc.App.DB.Query(`
			SELECT id, file_id, sender, receiver, message, is_done, created_at
			FROM file_messages
			WHERE file_id = $1 AND LOWER(receiver) = LOWER($2)
			ORDER BY created_at DESC
		`, fileID, user.Username)
	}

	if err != nil {
		log.Printf("❌ Error fetching messages for file %d: %v", fileID, err)
		models.RespondError(w, http.StatusInternalServerError, "Failed to fetch messages")
		return
	}
	defer rows.Close()

	var messages []models.FileMessage
	for rows.Next() {
		var msg models.FileMessage
		if err := rows.Scan(&msg.ID, &msg.FileID, &msg.Sender, &msg.Receiver, &msg.Message, &msg.IsDone, &msg.CreatedAt); err != nil {
			log.Printf("❌ Error scanning message: %v", err)
			continue
		}
		messages = append(messages, msg)
	}

	log.Printf("📨 Found %d messages for file ID %d", len(messages), fileID)
	models.RespondJSON(w, http.StatusOK, messages)
}

func (fc *FileController) GetFileVersions(w http.ResponseWriter, r *http.Request) {
	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	fileIDStr := r.URL.Query().Get("file_id")
	fileID, err := strconv.Atoi(fileIDStr)
	if err != nil || fileID <= 0 {
		models.RespondError(w, http.StatusBadRequest, "Invalid file ID")
		return
	}

	rows, err := fc.App.DB.Query(`
		SELECT version_number, file_path, created_at
		FROM file_versions
		WHERE file_id = $1
		ORDER BY version_number ASC
	`, fileID)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error retrieving file versions")
		return
	}
	defer rows.Close()

	type VersionInfo struct {
		Version   int       `json:"version"`
		Path      string    `json:"file_path"`
		Timestamp time.Time `json:"timestamp"`
	}

	var versions []VersionInfo
	for rows.Next() {
		var v VersionInfo
		if err := rows.Scan(&v.Version, &v.Path, &v.Timestamp); err != nil {
			continue
		}
		versions = append(versions, v)
	}

	// Optional: log the access
	fc.App.LogActivity(fmt.Sprintf("User '%s' viewed version history for file ID %d.", user.Username, fileID))

	models.RespondJSON(w, http.StatusOK, versions)
}
func (fc *FileController) MarkFileMessageAsDone(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	vars := mux.Vars(r)
	messageIDStr := vars["id"]
	if messageIDStr == "" {
		models.RespondError(w, http.StatusBadRequest, "Missing message ID")
		return
	}

	messageID, err := strconv.Atoi(messageIDStr)
	if err != nil || messageID <= 0 {
		models.RespondError(w, http.StatusBadRequest, "Invalid message ID")
		return
	}

	log.Printf("🔄 Attempting to mark message %d as done by user '%s'", messageID, user.Username)

	var receiver string
	err = fc.App.DB.QueryRow(`SELECT receiver FROM file_messages WHERE id = $1`, messageID).Scan(&receiver)
	if err != nil {
		log.Printf("❌ Message %d not found: %v", messageID, err)
		models.RespondError(w, http.StatusNotFound, "Message not found")
		return
	}

	// Case-insensitive comparison for receiver
	if !strings.EqualFold(user.Username, receiver) && user.Role != "admin" {
		log.Printf("❌ User '%s' not authorized to update message %d (receiver: '%s')", user.Username, messageID, receiver)
		models.RespondError(w, http.StatusForbidden, "You are not authorized to update this message")
		return
	}

	_, err = fc.App.DB.Exec(`UPDATE file_messages SET is_done = TRUE WHERE id = $1`, messageID)
	if err != nil {
		log.Printf("❌ Failed to update message %d status: %v", messageID, err)
		models.RespondError(w, http.StatusInternalServerError, "Failed to update message status")
		return
	}

	log.Printf("✅ User '%s' successfully marked message %d as done", user.Username, messageID)
	fc.App.LogActivity(fmt.Sprintf("User '%s' marked message %d as done.", user.Username, messageID))

	models.RespondJSON(w, http.StatusOK, map[string]string{"message": "Marked as done"})
}
func (fc *FileController) BulkUpload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(200 << 20); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Failed to parse form")
		return
	}

	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	targetDir := r.FormValue("directory")
	container := r.FormValue("container")
	overwrite := r.FormValue("overwrite") == "true"
	skip := r.FormValue("skip") == "true"
	instruction := r.FormValue("message")
	receiver := r.FormValue("receiver")
	metaJSON := r.FormValue("metadata")

	var metaMap map[string]interface{}
	if metaJSON != "" {
		if err := json.Unmarshal([]byte(metaJSON), &metaMap); err != nil {
			models.RespondError(w, http.StatusBadRequest, "Invalid metadata JSON")
			return
		}
	}

	if targetDir == "" || container == "" {
		models.RespondError(w, http.StatusBadRequest, "Directory and container are required")
		return
	}

	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		models.RespondError(w, http.StatusBadRequest, "No files provided")
		return
	}

	allowedExtensions := map[string]bool{
		// Word documents
		".doc":  true,
		".docx": true,
		// Excel spreadsheets
		".xls":  true,
		".xlsx": true,
		// PowerPoint presentations
		".ppt":  true,
		".pptx": true,
		// PDF documents
		".pdf": true,
		// Image formats
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".gif":  true,
		".bmp":  true,
		".tiff": true,
		".tif":  true,
	}

	allowedMIMETypes := map[string]bool{
		// Word documents
		"application/msword": true,
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
		// Excel spreadsheets
		"application/vnd.ms-excel": true,
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
		// PowerPoint presentations
		"application/vnd.ms-powerpoint":                                             true,
		"application/vnd.openxmlformats-officedocument.presentationml.presentation": true,
		// PDF documents
		"application/pdf": true,
		// Image formats
		"image/jpeg": true,
		"image/png":  true,
		"image/gif":  true,
		"image/bmp":  true,
		"image/tiff": true,
	}

	results := []map[string]string{}

	for _, fileHeader := range files {
		rawFileName := fileHeader.Filename
		ext := strings.ToLower(filepath.Ext(rawFileName))
		mime := fileHeader.Header.Get("Content-Type")

		if !allowedExtensions[ext] || !allowedMIMETypes[mime] {
			results = append(results, map[string]string{
				"file":   rawFileName,
				"status": "rejected: invalid file type or MIME",
			})
			continue
		}

		status := "unknown"
		var fileID int
		var finalDiskPath string
		var relativePath string

		func() {
			file, err := fileHeader.Open()
			if err != nil {
				status = "error: failed to open"
				return
			}
			defer file.Close()

			relativePath = filepath.Join(targetDir, rawFileName)
			finalDiskPath = filepath.Join("Cdrrmo", relativePath)

			existingFR, getErr := fc.App.GetFileRecordByPath(relativePath)

			if getErr == nil {
				if skip {
					status = "skipped"
					return
				}
				if !overwrite {
					base := strings.TrimSuffix(rawFileName, filepath.Ext(rawFileName))
					ext := filepath.Ext(rawFileName)
					counter := 1
					for {
						altName := fmt.Sprintf("%s_%d%s", base, counter, ext)
						altPath := filepath.Join(targetDir, altName)
						if _, err := fc.App.GetFileRecordByPath(altPath); err != nil {
							relativePath = altPath
							finalDiskPath = filepath.Join("Cdrrmo", altPath)
							break
						}
						counter++
					}
					status = "renamed"
				} else {
					fileID = existingFR.ID
					updateErr := fc.App.UpdateFileMetadata(fileID, fileHeader.Size, mime)
					if updateErr == nil {
						latestVer, _ := fc.App.GetLatestVersionNumber(fileID)
						_ = fc.App.CreateFileVersion(fileID, latestVer+1, relativePath)
						status = "overwritten"
					}
				}
			}

			if err := os.MkdirAll(filepath.Dir(finalDiskPath), 0755); err != nil {
				status = "error: mkdir failed"
				return
			}

			tempFilePath := finalDiskPath + ".tmp"
			tempFile, err := os.Create(tempFilePath)
			if err != nil {
				status = "error: cannot create temp file"
				return
			}

			if _, err := io.Copy(tempFile, file); err != nil {
				tempFile.Close()
				os.Remove(tempFilePath)
				status = "error: write failed"
				return
			}
			tempFile.Close()

			key := []byte(os.Getenv("ENCRYPTION_KEY"))
			if err := encryption.EncryptFile(key, tempFilePath, finalDiskPath); err != nil {
				os.Remove(tempFilePath)
				status = "error: encryption failed"
				return
			}
			os.Remove(tempFilePath)

			if getErr != nil || !overwrite {
				fr := models.FileRecord{
					FileName:    filepath.Base(relativePath),
					FilePath:    relativePath,
					Directory:   targetDir,
					Size:        fileHeader.Size,
					ContentType: mime,
					Uploader:    user.Username,
					Metadata:    metaMap,
				}
				if err := fc.App.CreateFileRecord(fr); err != nil {
					status = "error: DB insert failed"
					return
				}
				fileID, _ = fc.App.GetFileIDByPath(fr.FilePath)
				_ = fc.App.CreateFileVersion(fileID, 1, fr.FilePath)
				status = "uploaded"
			}
		}()

		if status == "uploaded" || status == "overwritten" {
			if instruction != "" && receiver != "" && fileID > 0 {
				// Get the exact username with correct capitalization from the database
				var exactUsername string
				err := fc.App.DB.QueryRow(`SELECT username FROM users WHERE LOWER(username) = LOWER($1)`, receiver).Scan(&exactUsername)
				if err != nil {
					log.Printf("❌ Error getting exact username for '%s': %v", receiver, err)
					// Continue with the provided username if we can't get the exact one
				} else {
					// Use the exact username from the database to ensure correct capitalization
					receiver = exactUsername
					log.Printf("📨 Using exact username from database: '%s'", exactUsername)
				}

				_, err = fc.App.DB.Exec(`INSERT INTO file_messages (file_id, sender, receiver, message) VALUES ($1, $2, $3, $4)`,
					fileID, user.Username, receiver, instruction)

				if err != nil {
					log.Printf("❌ Error inserting message for bulk upload: %v", err)
				} else {
					log.Printf("✅ Message successfully inserted for user '%s' during bulk upload", receiver)
				}

				if fc.App.NotificationHub != nil {
					var filePath string
					_ = fc.App.DB.QueryRow(`SELECT file_path FROM files WHERE id = $1`, fileID).Scan(&filePath)
					notification := map[string]string{
						"type":      "new_instruction",
						"receiver":  receiver,
						"message":   instruction,
						"file_id":   fmt.Sprintf("%d", fileID),
						"sender":    user.Username,
						"file_path": filePath,
					}
					notifBytes, _ := json.Marshal(notification)
					fc.App.NotificationHub.SendToUser(receiver, notifBytes)
					log.Printf("📨 Notification sent to user '%s' during bulk upload", receiver)
				}
			}
		}

		results = append(results, map[string]string{
			"file":   rawFileName,
			"status": status,
		})
	}

	models.RespondJSON(w, http.StatusOK, results)
}

// CountFilesInMainFolders counts all files in Operation, Research, and Training directories.
func (fc *FileController) CountFilesInMainFolders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	if _, err := fc.App.GetUserFromSession(r); err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	counts := make(map[string]int)

	folders := []string{"Operation", "Research", "Training"}
	for _, folder := range folders {
		rows, err := fc.App.DB.Query(`
            SELECT COUNT(*) FROM files
            WHERE directory = $1
        `, folder)
		if err != nil {
			models.RespondError(w, http.StatusInternalServerError, "Database error")
			return
		}
		defer rows.Close()

		var count int
		if rows.Next() {
			_ = rows.Scan(&count)
		}
		counts[folder] = count
	}

	models.RespondJSON(w, http.StatusOK, counts)
}

// GetFilesWithMessagesForUser retrieves all files that have messages assigned to the current user
func (fc *FileController) GetFilesWithMessagesForUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	log.Printf("📨 Fetching files with messages for user: '%s'", user.Username)

	// Query to get all files that have messages for this user - using ILIKE for case-insensitive matching
	rows, err := fc.App.DB.Query(`
		SELECT f.id, f.file_name, f.directory, f.file_path, f.size, f.content_type, f.uploader, f.created_at
		FROM files f
		JOIN file_messages fm ON f.id = fm.file_id
		WHERE LOWER(fm.receiver) = LOWER($1)
		GROUP BY f.id
		ORDER BY f.directory, f.file_name
	`, user.Username)

	if err != nil {
		log.Printf("❌ Error fetching files with messages: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Error retrieving files with messages")
		return
	}
	defer rows.Close()

	var files []map[string]interface{}
	for rows.Next() {
		var file models.FileRecord
		if err := rows.Scan(
			&file.ID,
			&file.FileName,
			&file.Directory,
			&file.FilePath,
			&file.Size,
			&file.ContentType,
			&file.Uploader,
			&file.CreatedAt,
		); err != nil {
			log.Printf("❌ Error scanning file record: %v", err)
			continue
		}

		// Get messages for this file - using ILIKE for case-insensitive matching
		msgRows, err := fc.App.DB.Query(`
			SELECT id, file_id, sender, receiver, message, is_done, created_at
			FROM file_messages
			WHERE file_id = $1 AND LOWER(receiver) = LOWER($2)
			ORDER BY created_at DESC
		`, file.ID, user.Username)

		if err != nil {
			log.Printf("❌ Error fetching messages for file %d: %v", file.ID, err)
			continue
		}

		var messages []models.FileMessage
		for msgRows.Next() {
			var msg models.FileMessage
			if err := msgRows.Scan(
				&msg.ID,
				&msg.FileID,
				&msg.Sender,
				&msg.Receiver,
				&msg.Message,
				&msg.IsDone,
				&msg.CreatedAt,
			); err != nil {
				log.Printf("❌ Error scanning message: %v", err)
				continue
			}
			messages = append(messages, msg)
		}
		msgRows.Close()

		files = append(files, map[string]interface{}{
			"id":          file.ID,
			"name":        file.FileName,
			"directory":   file.Directory,
			"file_path":   file.FilePath,
			"size":        file.Size,
			"contentType": file.ContentType,
			"uploader":    file.Uploader,
			"created_at":  file.CreatedAt.Format("2006-01-02 15:04:05"),
			"messages":    messages,
		})
	}

	log.Printf("📨 Found %d files with messages for user '%s'", len(files), user.Username)

	// Debug: Check if there are any messages for this user in the database
	var messageCount int
	countErr := fc.App.DB.QueryRow(`
		SELECT COUNT(*) FROM file_messages WHERE LOWER(receiver) = LOWER($1)
	`, user.Username).Scan(&messageCount)

	if countErr != nil {
		log.Printf("❌ Error counting messages: %v", countErr)
	} else {
		log.Printf("📨 Total message count for user '%s': %d", user.Username, messageCount)
	}

	models.RespondJSON(w, http.StatusOK, files)
}

// DeleteFileMessages deletes all messages associated with a specific file ID
func (fc *FileController) DeleteFileMessages(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers for API requests
	if origin := r.Header.Get("Origin"); origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
	}

	// Handle preflight OPTIONS request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodDelete {
		models.RespondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Get user from session
	user, err := fc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Extract file ID from URL path
	vars := mux.Vars(r)
	fileID := vars["id"]

	if fileID == "" {
		models.RespondError(w, http.StatusBadRequest, "Missing file ID")
		return
	}

	// Convert fileID to integer
	fileIDInt, err := strconv.Atoi(fileID)
	if err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid file ID format")
		return
	}

	// First check if the file exists
	var fileExists bool
	err = fc.App.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM files WHERE id = $1)", fileIDInt).Scan(&fileExists)
	if err != nil {
		log.Printf("Error checking if file exists: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Database error")
		return
	}

	// Get the number of rows affected
	var rowsAffected int64
	result, err := fc.App.DB.Exec("DELETE FROM file_messages WHERE file_id = $1", fileIDInt)
	if err != nil {
		log.Printf("Error deleting file messages: %v", err)

		// Continue with file deletion even if message deletion fails
	}
	rowsAffected, err = result.RowsAffected()
	if err != nil {
		log.Printf("Error getting rows affected: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Database error")
		return
	}

	// Log the number of messages deleted
	log.Printf("Deleted %d messages for file ID %s", rowsAffected, fileID)

	// Start a transaction
	tx, err := fc.App.DB.Begin()
	if err != nil {
		log.Printf("Error starting transaction: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Database error")
		return
	}

	// Set up transaction rollback in case of errors
	defer func() {
		if err != nil {
			tx.Rollback()
			return
		}
	}()

	// First, delete any messages associated with this file
	log.Printf("Cleaning up messages for file ID %s", fileID)
	msgResult, err := tx.Exec("DELETE FROM file_messages WHERE file_id = $1", fileID)
	if err != nil {
		log.Printf("Error deleting file messages: %v", err)
		// Continue with file deletion even if message deletion fails
	}

	// Get number of messages deleted (for logging)
	msgRowsAffected := int64(0)
	if msgResult != nil {
		if count, err := msgResult.RowsAffected(); err == nil {
			msgRowsAffected = count
			log.Printf("Deleted %d messages for file ID %s", msgRowsAffected, fileID)
		}
	}

	// Delete the file record from the database
	_, err = tx.Exec("DELETE FROM files WHERE id = $1", fileID)
	if err != nil {
		log.Printf("Error deleting file record: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Error deleting file record")
		return
	}

	// Commit the transaction
	err = tx.Commit()
	if err != nil {
		log.Printf("Error committing transaction: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Database error")
		return
	}

	// Log the successful deletion and message cleanup
	fc.App.LogActivity(fmt.Sprintf("User '%s' deleted file ID %s and cleaned up %d associated messages",
		user.Username, fileID, msgRowsAffected))

	// Send success response
	models.RespondJSON(w, http.StatusOK, map[string]interface{}{
		"message":       "File messages deleted successfully",
		"rows_affected": rowsAffected,
	})
}

func (fc *FileController) SearchFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}
	if _, err := fc.App.GetUserFromSession(r); err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Get search query and preserve numbers (don't convert numbers to lowercase)
	rawQ := strings.TrimSpace(r.URL.Query().Get("q"))
	if rawQ == "" {
		log.Printf("❌ Search query is empty after trimming: '%s'", r.URL.Query().Get("q"))
		models.RespondError(w, http.StatusBadRequest, "Search query is required")
		return
	}
	log.Printf("🔍 Incoming search query: '%s' (raw), '%s' (trimmed)", r.URL.Query().Get("q"), rawQ)

	// Create a case-insensitive version for text matching but preserve the original value
	// This ensures numbers are not affected by lowercase conversion
	q := strings.ToLower(rawQ)

	// Get the main folder to search in (if specified)
	mainFolder := strings.TrimSpace(r.URL.Query().Get("main_folder"))

	// Build SQL filter
	// Create pattern for both the lowercase version (for text) and the raw version (for numbers)
	pattern := "%" + q + "%"
	rawPattern := "%" + rawQ + "%"
	log.Printf("🧪 DEBUG - SQL LIKE patterns: lowercase='%s', raw='%s'", pattern, rawPattern)

	var rows *sql.Rows
	var err error

	if mainFolder != "" {
		// Search in a specific main folder and all its subfolders
		log.Printf("🔍 Searching for '%s' in main folder '%s' and all its subfolders", q, mainFolder)

		// Use LIKE pattern to match the main folder and any subdirectory
		folderPattern := mainFolder + "%"

		rows, err = fc.App.DB.Query(
			`SELECT id, file_name, directory, content_type, size, file_path
             FROM files
             WHERE (
                 -- Match the directory exactly or any subdirectory
                 directory = $1 OR
                 directory LIKE $2 OR
                 file_path LIKE $2
             ) AND (
                 -- Match the search term in filename or path (both lowercase and raw for numbers)
                 LOWER(file_name) LIKE $3 OR
                 LOWER(file_path) LIKE $3 OR
                 file_name LIKE $4 OR
                 file_path LIKE $4
             )
             ORDER BY directory, file_name`,
			mainFolder, folderPattern, pattern, rawPattern,
		)
	} else {
		// Search everywhere
		log.Printf("🔍 Searching for '%s' across all folders", q)
		rows, err = fc.App.DB.Query(
			`SELECT id, file_name, directory, content_type, size, file_path
             FROM files
             WHERE LOWER(file_name) LIKE $1 OR
                   LOWER(file_path) LIKE $1 OR
                   file_name LIKE $2 OR
                   file_path LIKE $2
             ORDER BY directory, file_name`,
			pattern, rawPattern,
		)

		// Debug log for troubleshooting
		log.Printf("🧪 DEBUG - Search parameters: lowercase='%s', raw='%s'", pattern, rawPattern)
	}

	if err != nil {
		log.Printf("❌ Search query failed: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Search failed")
		return
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var (
			id          int
			name, d, ct string
			size        int64
			path        string
		)
		if err := rows.Scan(&id, &name, &d, &ct, &size, &path); err != nil {
			continue
		}

		// Extract parent folder for better organization in results
		parentFolder := d
		if parentFolder == "" && path != "" {
			// If directory is empty but we have a path, extract the directory from the path
			parentFolder = filepath.Dir(path)
			if parentFolder == "." {
				parentFolder = ""
			}
		}

		results = append(results, map[string]interface{}{
			"id":           id,
			"name":         name,
			"directory":    d,
			"parentFolder": parentFolder,
			"contentType":  ct,
			"size":         size,
			"path":         path,
			"type":         "file", // Add type to distinguish from directories in frontend
		})
	}

	log.Printf("🔍 Search found %d results", len(results))
	models.RespondJSON(w, http.StatusOK, results)
}

// DeleteFolder handles folder deletion requests.
func (fc *FileController) DeleteFolder(w http.ResponseWriter, r *http.Request) {
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
		Name      string `json:"name"`
		Parent    string `json:"parent"`
		Container string `json:"container"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Build the folder path
	folderPath := filepath.Join(req.Parent, req.Name)
	diskPath := filepath.Join("Cdrrmo", folderPath)

	// Remove the folder and all its contents
	if err := os.RemoveAll(diskPath); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Failed to delete folder")
		return
	}

	// Optionally: Remove folder records from your DB if you track folders

	fc.App.LogActivity(fmt.Sprintf("User '%s' deleted folder '%s'", user.Username, folderPath))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Folder '%s' deleted successfully", folderPath),
	})
}
