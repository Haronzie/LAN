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

	// Trim whitespace
	req.Name = strings.TrimSpace(req.Name)
	req.Parent = strings.TrimSpace(req.Parent)
	if req.Name == "" {
		models.RespondError(w, http.StatusBadRequest, "Directory name cannot be empty")
		return
	}

	basePath := "uploads"
	var resourcePath string
	if req.Parent != "" {
		resourcePath = filepath.Join(basePath, req.Parent, req.Name)
	} else {
		resourcePath = filepath.Join(basePath, req.Name)
	}

	// --- Check if the directory path already exists ---
	if info, err := os.Stat(resourcePath); err == nil {
		// err == nil => the path already exists on disk
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
		// If we get an error that's not "does not exist," it's a different I/O error
		models.RespondError(w, http.StatusInternalServerError,
			fmt.Sprintf("Error checking directory path: %v", err))
		return
	}

	// --- If we reach here, the path does NOT exist; create it ---
	if err := os.MkdirAll(resourcePath, 0755); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error creating directory on disk")
		return
	}

	// Insert a record into your 'directories' table
	if err := dc.App.CreateDirectoryRecord(req.Name, req.Parent, user.Username); err != nil {
		// If your DB schema requires unique (name + parent), you can catch DB constraint errors here
		models.RespondError(w, http.StatusInternalServerError, "Error saving directory record")
		return
	}

	// Log the activity and respond success
	dc.App.LogActivity(fmt.Sprintf("User '%s' created directory '%s' (parent='%s').", user.Username, req.Name, req.Parent))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Directory created successfully",
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
		models.RespondError(w, http.StatusInternalServerError, "Error deleting directory")
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
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.OldName = strings.TrimSpace(req.OldName)
	req.NewName = strings.TrimSpace(req.NewName)
	if req.OldName == "" || req.NewName == "" {
		models.RespondError(w, http.StatusBadRequest, "Old and new directory names are required")
		return
	}

	basePath := "uploads"
	oldPath := filepath.Join(basePath, req.OldName)
	newPath := filepath.Join(basePath, req.NewName)
	if err := os.Rename(oldPath, newPath); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error renaming directory")
		return
	}

	if err := dc.App.UpdateDirectoryRecord(req.OldName, req.NewName); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error updating directory record")
		return
	}

	dc.App.LogActivity(fmt.Sprintf("User '%s' renamed directory from '%s' to '%s'.", user.Username, req.OldName, req.NewName))
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
