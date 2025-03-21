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
// It recursively deletes the folder, its subfolders, and files.
// Delete handles directory deletion from both the filesystem and the database.
// It recursively deletes the folder, its subfolders, and files.
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

	// 1) Build the absolute path for disk deletion
	resourcePath := getResourcePath(req.Name, req.Parent)

	// 2) Remove the directory (and its sub-contents) from the filesystem
	if err := os.RemoveAll(resourcePath); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error deleting directory on disk")
		return
	}

	// 3) Build the relative path (for database deletion)
	//    e.g. If parent is "Root" and name is "FolderA", this becomes "Root/FolderA"
	relativeFolder := filepath.Join(req.Parent, req.Name)

	// -- SNIPPET STARTS HERE --
	// 4) Delete files whose file_path starts with relativeFolder
	if err := dc.App.DeleteFilesWithPrefix(relativeFolder); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error deleting file records in the folder")
		return
	}

	// 5) Delete directories whose (parent||'/'||name) starts with relativeFolder
	if err := dc.App.DeleteDirectoriesWithPrefix(relativeFolder); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error deleting directory records from database")
		return
	}
	if err := dc.App.DeleteDirectoryAndSubdirectories(req.Parent, req.Name); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error deleting directory records from database")
		return
	}
	// -- SNIPPET ENDS HERE --

	dc.App.LogActivity(fmt.Sprintf("User '%s' deleted directory '%s' (parent: '%s') and all its contents.",
		user.Username, req.Name, req.Parent))

	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Directory '%s' and its contents deleted successfully", req.Name),
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

	// Validate
	if req.SourceName == "" {
		models.RespondError(w, http.StatusBadRequest, "Source folder name is required")
		return
	}
	if req.NewName == "" {
		// If the user didn’t provide a new_name, fallback to using the same as source
		req.NewName = req.SourceName
	}

	// If user didn’t specify a destination, fallback to copying within the same parent
	destParent := req.DestinationParent
	if destParent == "" {
		destParent = req.SourceParent
	}

	// Build full disk paths for source and destination
	srcPath := getResourcePath(req.SourceName, req.SourceParent)
	dstPath := getResourcePath(req.NewName, destParent)

	// 1) Verify the source folder exists
	srcInfo, err := os.Stat(srcPath)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, fmt.Sprintf("Source folder '%s' not found on disk", srcPath))
		return
	}
	if !srcInfo.IsDir() {
		models.RespondError(w, http.StatusBadRequest, "Source path is not a directory")
		return
	}

	// 2) Ensure the destination folder does not already exist
	if _, err := os.Stat(dstPath); err == nil {
		models.RespondError(w, http.StatusConflict, fmt.Sprintf("Destination folder '%s' already exists", dstPath))
		return
	}

	// 3) Recursively copy the folder on disk
	if err := copyDir(srcPath, dstPath); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error copying folder: "+err.Error())
		return
	}

	// 4) Create a new directory record in the DB
	if err := dc.App.CreateDirectoryRecord(req.NewName, destParent, user.Username); err != nil {
		// Optionally rollback by removing the copied folder on disk
		os.RemoveAll(dstPath)
		models.RespondError(w, http.StatusInternalServerError, "Error saving folder record to database")
		return
	}

	// 5) Duplicate file records for items directly in the source folder
	sourceFolderPath := filepath.Join(req.SourceParent, req.SourceName)
	fileRecords, err := dc.App.ListFilesInDirectory(sourceFolderPath)
	if err == nil {
		for _, f := range fileRecords {
			// Build the new file path under the destination
			newFilePath := filepath.Join(destParent, req.NewName, f.FileName)
			newFR := models.FileRecord{
				FileName:    f.FileName,
				FilePath:    newFilePath,
				Size:        f.Size,
				ContentType: f.ContentType,
				Uploader:    user.Username,
			}
			if err := dc.App.CreateFileRecord(newFR); err != nil {
				log.Println("Error duplicating file record:", err)
			}
		}
	} else {
		log.Println("Warning: could not list source folder files:", err)
	}

	dc.App.LogActivity(fmt.Sprintf("User '%s' copied folder from '%s/%s' to '%s/%s'.",
		user.Username, req.SourceParent, req.SourceName, destParent, req.NewName))

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
func (dc *DirectoryController) Tree(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	// (Optional) check user session if only authenticated users can see the tree.
	_, err := dc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// 1) Query all directories from your database
	dirs, err := dc.getAllDirectories()
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error fetching directories from DB")
		return
	}

	// 2) Build a map of parent -> []child
	//    e.g. map[""] = [FolderA, FolderB], map["FolderA"] = [SubFolder1], etc.
	parentMap := make(map[string][]string)
	for _, d := range dirs {
		parentMap[d.Parent] = append(parentMap[d.Parent], d.Name)
	}

	// 3) Recursively build a tree from parent = "" (root).
	tree := buildTree("", parentMap)

	// 4) Return the tree as JSON
	models.RespondJSON(w, http.StatusOK, tree)
}

// buildTree recursively builds a slice of TreeNode for the given parent.
func buildTree(parent string, parentMap map[string][]string) []TreeNode {
	var result []TreeNode
	// Get children of this parent
	children := parentMap[parent]

	for _, childName := range children {
		// For the 'title' and 'value' fields, we combine parent+childName
		// If parent is empty, it's just childName. Otherwise, parent/childName
		var fullPath string
		if parent == "" {
			fullPath = childName
		} else {
			fullPath = filepath.Join(parent, childName)
		}

		// Recursively build children
		childNodes := buildTree(fullPath, parentMap)

		node := TreeNode{
			Title:    childName,
			Value:    fullPath, // or some logic if you want a different path
			Children: childNodes,
		}
		result = append(result, node)
	}

	return result
}

// getAllDirectories fetches all rows from the 'directories' table into []DirectoryData
func (dc *DirectoryController) getAllDirectories() ([]DirectoryData, error) {
	rows, err := dc.App.DB.Query(`
        SELECT directory_name, parent_directory
        FROM directories
        ORDER BY directory_name
    `)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []DirectoryData
	for rows.Next() {
		var d DirectoryData
		if err := rows.Scan(&d.Name, &d.Parent); err != nil {
			return nil, err
		}
		results = append(results, d)
	}
	return results, rows.Err()
}

type TreeNode struct {
	Title    string     `json:"title"`
	Value    string     `json:"value"`
	Children []TreeNode `json:"children"`
}

// DirectoryData is a simple struct to hold a row from your 'directories' table.
type DirectoryData struct {
	Name   string
	Parent string
}
