package controllers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"LANFileSharingSystem/internal/models"
)

// DirectoryController handles endpoints related to directory operations.
type DirectoryController struct {
	App *models.App
}

// NewDirectoryController creates a new DirectoryController.
func NewDirectoryController(app *models.App) *DirectoryController {
	return &DirectoryController{App: app}
}

// getResourcePath constructs the full path for a directory based on its name and parent.
// If parent is empty, the directory is assumed to be directly under "uploads".
func getResourcePath(name, parent string) string {
	basePath := "uploads"
	if parent != "" {
		return filepath.Join(basePath, parent, name)
	}
	return filepath.Join(basePath, name)
}

// Create handles directory creation in both the filesystem and the database.
// It expects a JSON payload with "name" and an optional "parent".
func (dc *DirectoryController) Create(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	user, err := dc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var req struct {
		Name   string `json:"name"`
		Parent string `json:"parent"` // Optional parent directory.
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Parent = strings.TrimSpace(req.Parent)
	if req.Name == "" {
		models.RespondError(w, http.StatusBadRequest, "Directory name cannot be empty")
		return
	}

	// Check in the database if a directory with the same name under the same parent already exists.
	exists, err := dc.App.DirectoryExists(req.Name, req.Parent)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error checking directory existence in database")
		return
	}
	if exists {
		models.RespondError(w, http.StatusConflict,
			fmt.Sprintf("Directory '%s' already exists under parent '%s'", req.Name, req.Parent))
		return
	}

	// Build the path and create the directory on the filesystem.
	resourcePath := getResourcePath(req.Name, req.Parent)
	if err := os.MkdirAll(resourcePath, 0755); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error creating directory on disk")
		return
	}

	// Insert a record into your 'directories' table.
	if err := dc.App.CreateDirectoryRecord(req.Name, req.Parent, user.Username); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error saving directory record to database")
		return
	}

	dc.App.LogActivity(fmt.Sprintf("User '%s' created directory '%s' (parent: '%s').",
		user.Username, req.Name, req.Parent))

	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Directory '%s' created successfully", req.Name),
	})
}

// Delete handles directory deletion from both the filesystem and the database.
// It expects a JSON payload with "name" and an optional "parent".
func (dc *DirectoryController) Delete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	user, err := dc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var req struct {
		Name   string `json:"name"`
		Parent string `json:"parent"` // Optional parent directory.
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Parent = strings.TrimSpace(req.Parent)
	if req.Name == "" {
		models.RespondError(w, http.StatusBadRequest, "Directory name cannot be empty")
		return
	}

	resourcePath := getResourcePath(req.Name, req.Parent)

	// Delete the directory on the filesystem.
	if err := os.RemoveAll(resourcePath); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error deleting directory on disk")
		return
	}

	// Delete the directory record from the database.
	if err := dc.App.DeleteDirectoryRecord(req.Name); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error deleting directory record from database")
		return
	}
	if err := dc.App.DeleteFilesInFolder(resourcePath); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error deleting file records in the folder")
		return
	}

	dc.App.LogActivity(fmt.Sprintf("User '%s' deleted directory '%s' (parent: '%s').",
		user.Username, req.Name, req.Parent))

	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Directory '%s' deleted successfully", req.Name),
	})
}

// Rename handles renaming of directories in both the filesystem and the database.
// It expects a JSON payload with "old_name", "new_name", and an optional "parent".
func (dc *DirectoryController) Rename(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	user, err := dc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var req struct {
		OldName string `json:"old_name"`
		NewName string `json:"new_name"`
		Parent  string `json:"parent"` // Optional parent directory.
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate input
	req.OldName = strings.TrimSpace(req.OldName)
	req.NewName = strings.TrimSpace(req.NewName)
	req.Parent = strings.TrimSpace(req.Parent)
	if req.OldName == "" || req.NewName == "" {
		models.RespondError(w, http.StatusBadRequest, "Old and new directory names are required")
		return
	}

	// Check in the database if a directory with the new name already exists under the same parent.
	exists, err := dc.App.DirectoryExists(req.NewName, req.Parent)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error checking directory existence in database")
		return
	}
	if exists {
		models.RespondError(w, http.StatusConflict,
			fmt.Sprintf("Directory '%s' already exists under parent '%s'", req.NewName, req.Parent))
		return
	}

	// Build the old and new absolute disk paths
	oldPath := filepath.Join("uploads", req.Parent, req.OldName)
	newPath := filepath.Join("uploads", req.Parent, req.NewName)

	// Rename on disk
	if err := os.Rename(oldPath, newPath); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error renaming directory on disk")
		return
	}

	// Update the directory record in the database
	if err := dc.App.UpdateDirectoryRecord(req.OldName, req.NewName); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error updating directory record in database")
		return
	}

	// **IMPORTANT**: Now update file paths in the 'files' table
	// Example: oldFolderPath = "MyFolder" -> newFolderPath = "RenamedFolder"
	// If parent is not empty, oldFolderPath might be "Parent/OldName"
	oldFolderPath := filepath.Join(req.Parent, req.OldName)
	newFolderPath := filepath.Join(req.Parent, req.NewName)

	// This updates any file_path that starts with oldFolderPath
	if err := dc.App.UpdateFilePathsForRenamedFolder(oldFolderPath, newFolderPath); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error updating file paths in database")
		return
	}

	dc.App.LogActivity(fmt.Sprintf(
		"User '%s' renamed directory from '%s' to '%s' (parent: '%s').",
		user.Username, req.OldName, req.NewName, req.Parent))

	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Directory renamed from '%s' to '%s' successfully",
			req.OldName, req.NewName),
	})
}

// List handles listing directories (and optionally files) under a given parent.
// It expects a query parameter "directory" (or "parent") to specify the folder to list.
func (dc *DirectoryController) List(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	// (Optional) Check authentication if you want only logged-in users to list directories.
	user, err := dc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Example: We read the parent folder from a query param called "directory" or "parent".
	parentParam := r.URL.Query().Get("directory")
	parentParam = strings.TrimSpace(parentParam)

	// Use a method in your App to retrieve directories/files from the DB (and/or filesystem).
	items, err := dc.App.ListDirectory(parentParam)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error listing directory")
		return
	}

	dc.App.LogActivity(fmt.Sprintf("User '%s' listed contents of directory '%s'.",
		user.Username, parentParam))

	models.RespondJSON(w, http.StatusOK, items)
}

// Copy handles copying a folder (directory) along with its files.
// It expects a JSON payload with:
//   - source_name: the name of the folder to copy
//   - source_parent: the parent folder of the source (can be empty)
//   - new_name: the new name for the copied folder
//   - destination_parent: (optional) parent folder for the new folder; if empty, source_parent is used.
func (dc *DirectoryController) Copy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	user, err := dc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var req struct {
		SourceName        string `json:"source_name"`
		SourceParent      string `json:"source_parent"`
		NewName           string `json:"new_name"`
		DestinationParent string `json:"destination_parent"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Trim inputs
	req.SourceName = strings.TrimSpace(req.SourceName)
	req.SourceParent = strings.TrimSpace(req.SourceParent)
	req.NewName = strings.TrimSpace(req.NewName)
	req.DestinationParent = strings.TrimSpace(req.DestinationParent)
	if req.SourceName == "" || req.NewName == "" {
		models.RespondError(w, http.StatusBadRequest, "Source folder and new folder names are required")
		return
	}

	// Use source_parent as destination if none provided.
	destParent := req.DestinationParent
	if destParent == "" {
		destParent = req.SourceParent
	}

	// Build full paths for source and destination.
	srcPath := getResourcePath(req.SourceName, req.SourceParent)
	dstPath := getResourcePath(req.NewName, destParent)

	// Verify the source folder exists and is a directory.
	srcInfo, err := os.Stat(srcPath)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "Source folder not found")
		return
	}
	if !srcInfo.IsDir() {
		models.RespondError(w, http.StatusBadRequest, "Source path is not a directory")
		return
	}

	// Ensure the destination folder does not already exist.
	if _, err := os.Stat(dstPath); err == nil {
		models.RespondError(w, http.StatusConflict, "Destination folder already exists")
		return
	}

	// Recursively copy the source folder to the destination.
	if err := copyDir(srcPath, dstPath); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error copying folder: "+err.Error())
		return
	}

	// Create the new folder record in the database.
	if err := dc.App.CreateDirectoryRecord(req.NewName, destParent, user.Username); err != nil {
		// Optionally, remove the copied folder to rollback if DB insert fails
		os.RemoveAll(dstPath)
		models.RespondError(w, http.StatusInternalServerError, "Error saving folder record to database")
		return
	}

	// Duplicate file records for files directly inside the source folder.
	sourceFolderPath := filepath.Join(req.SourceParent, req.SourceName)
	fileRecords, err := dc.App.ListFilesInDirectory(sourceFolderPath)
	if err == nil {
		for _, f := range fileRecords {
			// Build the new file path by replacing the source folder with the destination folder.
			newFilePath := filepath.Join(destParent, req.NewName, f.FileName)
			newFR := models.FileRecord{
				FileName:    f.FileName,
				FilePath:    newFilePath,
				Size:        f.Size,
				ContentType: f.ContentType,
				Uploader:    user.Username,
			}
			if err := dc.App.CreateFileRecord(newFR); err != nil {
				// Log the error and continue copying other records.
				log.Println("Error duplicating file record:", err)
			}
		}
	} else {
		log.Println("Warning: could not list source folder files:", err)
	}

	dc.App.LogActivity(fmt.Sprintf(
		"User '%s' copied folder from '%s' to '%s'.",
		user.Username,
		filepath.Join(req.SourceParent, req.SourceName),
		filepath.Join(destParent, req.NewName),
	))

	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Folder copied to '%s' successfully", filepath.Join(destParent, req.NewName)),
	})
}

// copyDir recursively copies a directory from src to dst.
func copyDir(src string, dst string) error {
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}

	// Create the destination directory.
	if err := os.MkdirAll(dst, 0755); err != nil {
		return err
	}

	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			if err := copyDir(srcPath, dstPath); err != nil {
				return err
			}
		} else {
			if err := copyFile(srcPath, dstPath); err != nil {
				return err
			}
		}
	}
	return nil
}

// copyFile copies a file from src to dst.
func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := out.Close(); cerr != nil && err == nil {
			err = cerr
		}
	}()

	if _, err = io.Copy(out, in); err != nil {
		return err
	}
	return nil
}
