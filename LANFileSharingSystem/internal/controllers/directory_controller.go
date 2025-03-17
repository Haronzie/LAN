package controllers

import (
	"encoding/json"
	"fmt"
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

// Create handles directory creation.
// It checks both the file system and the database to enforce that a directory
// with the same name under the same parent does not already exist.
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
		Parent string `json:"parent"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Trim whitespace.
	req.Name = strings.TrimSpace(req.Name)
	req.Parent = strings.TrimSpace(req.Parent)
	if req.Name == "" {
		models.RespondError(w, http.StatusBadRequest, "Directory name cannot be empty")
		return
	}

	// Check in the database if a directory with the same name exists under the same parent.
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

	// Build the path for the new directory.
	basePath := "uploads"
	var resourcePath string
	if req.Parent != "" {
		resourcePath = filepath.Join(basePath, req.Parent, req.Name)
	} else {
		resourcePath = filepath.Join(basePath, req.Name)
	}

	// Check on disk if the directory already exists.
	if info, err := os.Stat(resourcePath); err == nil {
		if info.IsDir() {
			models.RespondError(w, http.StatusConflict,
				fmt.Sprintf("Directory '%s' already exists under parent '%s'", req.Name, req.Parent))
			return
		} else {
			models.RespondError(w, http.StatusConflict,
				fmt.Sprintf("A file with the same name '%s' already exists under parent '%s'", req.Name, req.Parent))
			return
		}
	} else if !os.IsNotExist(err) {
		models.RespondError(w, http.StatusInternalServerError,
			fmt.Sprintf("Error checking directory path: %v", err))
		return
	}

	// Create the directory on disk.
	if err := os.MkdirAll(resourcePath, 0755); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error creating directory on disk")
		return
	}

	// Insert a record into your 'directories' table.
	if err := dc.App.CreateDirectoryRecord(req.Name, req.Parent, user.Username); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error saving directory record")
		return
	}

	dc.App.LogActivity(fmt.Sprintf("User '%s' created directory '%s' (parent='%s').", user.Username, req.Name, req.Parent))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Directory created successfully",
	})
}

// CreateDefaultFolders creates three default folders ("Operation", "Research", and "Training")
// in the uploads directory (at the root) and inserts records for them in the database.
func (dc *DirectoryController) CreateDefaultFolders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	// Optionally, require authentication
	user, err := dc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	basePath := "uploads"
	// These folders will be created in the root (i.e. no parent)
	defaultFolders := []string{"Operation", "Research", "Training"}

	for _, folderName := range defaultFolders {
		folderPath := filepath.Join(basePath, folderName)
		// Check if folder exists on disk; if not, create it.
		if _, err := os.Stat(folderPath); os.IsNotExist(err) {
			if err := os.MkdirAll(folderPath, 0755); err != nil {
				models.RespondError(w, http.StatusInternalServerError, fmt.Sprintf("Error creating folder: %s", folderName))
				return
			}
			// Insert a record in the database.
			// Here the parent is empty (i.e. root level).
			if err := dc.App.CreateDirectoryRecord(folderName, "", user.Username); err != nil {
				models.RespondError(w, http.StatusInternalServerError, fmt.Sprintf("Error saving folder record: %s", folderName))
				return
			}
		}
	}

	dc.App.LogActivity(fmt.Sprintf("User '%s' created default folders: Operation, Research, Training.", user.Username))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Default folders (Operation, Research, Training) created successfully",
	})
}

// Delete handles directory deletion.
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
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		models.RespondError(w, http.StatusBadRequest, "Directory name cannot be empty")
		return
	}

	basePath := "uploads"
	resourcePath := filepath.Join(basePath, req.Name)
	if err := os.RemoveAll(resourcePath); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error deleting directory on disk")
		return
	}

	if err := dc.App.DeleteDirectoryRecord(req.Name); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error deleting directory record")
		return
	}

	dc.App.LogActivity(fmt.Sprintf("User '%s' deleted directory '%s'.", user.Username, req.Name))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Directory '%s' deleted successfully", req.Name),
	})
}

// Rename handles renaming of directories.
// It renames the folder on disk and updates the corresponding record in the database.
// It also checks that the new name does not conflict with an existing directory under the same parent.
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
		Parent  string `json:"parent"` // Parent directory context.
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.OldName = strings.TrimSpace(req.OldName)
	req.NewName = strings.TrimSpace(req.NewName)
	req.Parent = strings.TrimSpace(req.Parent)
	if req.OldName == "" || req.NewName == "" {
		models.RespondError(w, http.StatusBadRequest, "Old and new directory names are required")
		return
	}

	// Check if a directory with the new name already exists under the same parent.
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

	basePath := "uploads"
	oldPath := filepath.Join(basePath, req.Parent, req.OldName)
	newPath := filepath.Join(basePath, req.Parent, req.NewName)
	if err := os.Rename(oldPath, newPath); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error renaming directory on disk")
		return
	}

	if err := dc.App.UpdateDirectoryRecord(req.OldName, req.NewName); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error updating directory record")
		return
	}

	dc.App.LogActivity(fmt.Sprintf("User '%s' renamed directory from '%s' to '%s' in parent '%s'.", user.Username, req.OldName, req.NewName, req.Parent))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Directory renamed from '%s' to '%s' successfully", req.OldName, req.NewName),
	})
}

// List returns the contents of a directory.
func (dc *DirectoryController) List(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	directoryParam := r.URL.Query().Get("directory")
	items, err := dc.App.ListDirectory(directoryParam) // Assumes ListDirectory() is implemented.
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error listing directory")
		return
	}
	models.RespondJSON(w, http.StatusOK, items)
}
