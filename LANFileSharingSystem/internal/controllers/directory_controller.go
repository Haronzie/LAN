package controllers

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"LANFileSharingSystem/internal/models"
)

// DirectoryController handles endpoints related to directory operations.
type DirectoryController struct {
	App *models.App
}

func NewDirectoryController(app *models.App) *DirectoryController {
	return &DirectoryController{App: app}
}

// getResourcePath constructs the full path for a directory based on its name and parent.
func getResourcePath(name, parent string) string {
	basePath := "Cdrrmo"
	if parent != "" {
		return filepath.Join(basePath, parent, name)
	}
	return filepath.Join(basePath, name)
}

// Create handles directory creation in both the filesystem and the database.
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

	req.Name = strings.TrimSpace(req.Name)
	req.Parent = strings.TrimSpace(req.Parent)
	if req.Name == "" {
		models.RespondError(w, http.StatusBadRequest, "Directory name cannot be empty")
		return
	}

	resourcePath := getResourcePath(req.Name, req.Parent)
	if _, err := os.Lstat(resourcePath); err == nil {
		models.RespondError(w, http.StatusConflict, "Directory already exists")
		return
	}

	if err := os.MkdirAll(resourcePath, 0755); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error creating directory on disk")
		return
	}

	if err := dc.App.CreateDirectoryRecord(req.Name, req.Parent, user.Username); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error saving directory record to database")
		return
	}

	dc.App.LogActivity(fmt.Sprintf("User '%s' created directory '%s' (parent: '%s').",
		user.Username, req.Name, req.Parent))

	dc.App.LogAudit(user.Username, 0, "CREATE_FOLDER", fmt.Sprintf("User '%s' created folder '%s' under parent '%s'.", user.Username, req.Name, req.Parent))

	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Directory '%s' created successfully", req.Name),
	})
}

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

	// Log the request details
	log.Printf("Directory delete request: Name='%s', Parent='%s'", req.Name, req.Parent)

	// 1) Build the absolute path for disk deletion
	resourcePath := getResourcePath(req.Name, req.Parent)
	log.Printf("Absolute path for disk deletion: '%s'", resourcePath)

	// Check if the directory exists on disk
	if _, err := os.Stat(resourcePath); os.IsNotExist(err) {
		log.Printf("Warning: Directory '%s' does not exist on disk", resourcePath)
		// Continue with database deletion even if the directory doesn't exist on disk
	} else {
		log.Printf("Directory '%s' exists on disk, proceeding with deletion", resourcePath)
	}

	// 2) Remove the directory (and its sub-contents) from the filesystem
	if err := os.RemoveAll(resourcePath); err != nil {
		log.Printf("Error removing directory from disk: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Error deleting directory on disk")
		return
	}
	log.Printf("Successfully removed directory '%s' from disk", resourcePath)

	// 3) Build the relative path (for database deletion).
	//    e.g. If parent="Root" and name="FolderA", this becomes "Root/FolderA"
	relativeFolder := filepath.Join(req.Parent, req.Name)
	log.Printf("Relative folder path for database operations: '%s'", relativeFolder)

	// Delete the directory and all its contents (files, subdirectories, and file versions)
	// The improved DeleteDirectoryAndSubdirectories function will handle everything
	log.Printf("Deleting directory '%s' and all its contents", relativeFolder)
	if err := dc.App.DeleteDirectoryAndSubdirectories(req.Parent, req.Name); err != nil {
		log.Printf("Error deleting directory and its contents: %v", err)
		models.RespondError(w, http.StatusInternalServerError, "Error deleting directory and its contents from database")
		return
	}
	log.Printf("Successfully deleted directory '%s' and all its contents", relativeFolder)

	dc.App.LogActivity(fmt.Sprintf(
		"User '%s' deleted directory '%s' (parent: '%s') and all its contents.",
		user.Username, req.Name, req.Parent))
	dc.App.LogAudit(user.Username, 0, "DELETE_FOLDER", fmt.Sprintf("User '%s' deleted folder '%s' under parent '%s'.", user.Username, req.Name, req.Parent))

	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Directory '%s' and its contents deleted successfully", req.Name),
	})
}

// Rename handles renaming of directories in both the filesystem and the database.
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

	// Check in the DB if a directory with the new name already exists under the same parent.
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
	oldPath := filepath.Join("Cdrrmo", req.Parent, req.OldName)
	newPath := filepath.Join("Cdrrmo", req.Parent, req.NewName)

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

	// Update file paths in 'files' table (if they start with oldFolderPath)
	oldFolderPath := filepath.Join(req.Parent, req.OldName)
	newFolderPath := filepath.Join(req.Parent, req.NewName)
	if err := dc.App.UpdateFilePathsForRenamedFolder(oldFolderPath, newFolderPath); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error updating file paths in database")
		return
	}

	dc.App.LogActivity(fmt.Sprintf(
		"User '%s' renamed directory from '%s' to '%s' (parent: '%s').",
		user.Username, req.OldName, req.NewName, req.Parent))
	dc.App.LogAudit(user.Username, 0, "RENAME_FOLDER", fmt.Sprintf("User '%s' renamed folder from '%s' to '%s' under parent '%s'.", user.Username, req.OldName, req.NewName, req.Parent))

	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Directory renamed from '%s' to '%s' successfully",
			req.OldName, req.NewName),
	})
}

// List handles listing directories (and optionally files) under a given parent.
func (dc *DirectoryController) List(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	// Check authentication if you want only logged-in users to list directories.
	_, err := dc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Read the parent folder from a query param called "directory".
	parentParam := strings.TrimSpace(r.URL.Query().Get("directory"))

	// Retrieve directories/files from the DB.
	items, err := dc.App.ListDirectory(parentParam)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error listing directory")
		return
	}

	models.RespondJSON(w, http.StatusOK, items)
}

// Copy handles copying a folder (directory) along with its files and subdirectories.
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
		Overwrite         bool   `json:"overwrite"`
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

	// Validate: source must be provided; fallback to same name if NewName is empty
	if req.SourceName == "" {
		models.RespondError(w, http.StatusBadRequest, "Source folder name is required")
		return
	}
	if req.NewName == "" {
		req.NewName = req.SourceName
	}

	// If no destination parent is provided, copy within the same parent
	destParent := req.DestinationParent
	if destParent == "" {
		destParent = req.SourceParent
	}

	// Build relative paths for source/destination
	sourceRelPath := filepath.Join(req.SourceParent, req.SourceName)
	destRelPath := filepath.Join(destParent, req.NewName)

	// Build full disk paths
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

	// 2) Check if destination folder already exists
	destExists := false
	if _, err := os.Stat(dstPath); err == nil {
		// Destination folder exists, we'll merge contents instead of renaming
		destExists = true
		log.Printf("Destination folder '%s' already exists, will merge contents", dstPath)

		// Ensure the destination folder has the correct permissions
		if err := os.Chmod(dstPath, 0755); err != nil {
			log.Printf("Warning: could not update permissions on destination folder: %v", err)
		}
	}

	// 3) Recursively copy the folder on disk, capturing any subfolder renames
	// Always set overwrite to true for directories to ensure they merge
	renames, err := copyDirAndTrackRenames(srcPath, dstPath, true)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error copying folder: "+err.Error())
		// Optionally remove the partially copied folder on disk
		return
	}

	// 4) Create the top-level directory record if it doesn't exist
	// Check if directory record already exists
	exists, err := dc.App.DirectoryExists(req.NewName, destParent)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error checking directory existence")
		return
	}

	// Only create directory record if it doesn't exist
	if !exists {
		if err := dc.App.CreateDirectoryRecord(req.NewName, destParent, user.Username); err != nil {
			os.RemoveAll(dstPath) // rollback if DB fails
			models.RespondError(w, http.StatusInternalServerError, "Error saving folder record to database")
			return
		}
	}

	// 5) Recursively duplicate file & directory records, using the rename map
	if err := duplicateRecordsWithRenames(sourceRelPath, destRelPath, dc, user.Username, renames); err != nil {
		log.Println("Warning: error duplicating nested records:", err)
		// optionally remove the folder or partially inserted records
	}

	// Determine if we merged or created a new folder
	isMergeOperation := destExists

	// Log appropriate message based on operation type
	if isMergeOperation {
		dc.App.LogActivity(fmt.Sprintf("User '%s' merged folder from '%s' into '%s'.",
			user.Username, sourceRelPath, destRelPath))
		dc.App.LogAudit(user.Username, 0, "MERGE_FOLDER", fmt.Sprintf("User '%s' merged folder from '%s' into '%s'.", user.Username, sourceRelPath, destRelPath))
	} else {
		dc.App.LogActivity(fmt.Sprintf("User '%s' copied folder from '%s' to '%s'.",
			user.Username, sourceRelPath, destRelPath))
		dc.App.LogAudit(user.Username, 0, "COPY_FOLDER", fmt.Sprintf("User '%s' copied folder from '%s' to '%s'.", user.Username, sourceRelPath, destRelPath))
	}

	// Send response based on operation type
	if isMergeOperation {
		models.RespondJSON(w, http.StatusOK, map[string]string{
			"message": fmt.Sprintf("Folder contents merged into '%s' successfully", destRelPath),
		})
	} else {
		models.RespondJSON(w, http.StatusOK, map[string]string{
			"message": fmt.Sprintf("Folder copied to '%s' successfully", destRelPath),
		})
	}
}

// copyDirAndTrackRenames recursively copies a directory from src to dst,
// merging contents when folders with the same name exist. It returns a map
// that tracks any renames that might still occur in special cases.
// If overwrite is true, existing files will be overwritten.
func copyDirAndTrackRenames(src, dst string, overwrite bool) (map[string]string, error) {
	renames := make(map[string]string) // key = oldFullDstPath, val = newSubfolderName

	// Check if source directory exists
	srcInfo, err := os.Stat(src)
	if err != nil {
		return renames, fmt.Errorf("source directory does not exist: %v", err)
	}
	if !srcInfo.IsDir() {
		return renames, fmt.Errorf("source path is not a directory")
	}

	// Check if destination directory exists
	dstExists := false
	if dstInfo, err := os.Stat(dst); err == nil {
		if !dstInfo.IsDir() {
			return renames, fmt.Errorf("destination exists but is not a directory")
		}
		dstExists = true
		log.Printf("Destination folder '%s' exists, merging contents", dst)
	}

	// Create destination directory if it doesn't exist
	if !dstExists {
		if err := os.MkdirAll(dst, 0755); err != nil {
			return renames, fmt.Errorf("failed to create destination directory: %v", err)
		}
		log.Printf("Created destination folder '%s'", dst)
	}

	// Read source directory entries
	entries, err := os.ReadDir(src)
	if err != nil {
		return renames, fmt.Errorf("failed to read source directory: %v", err)
	}

	// Process each entry in the source directory
	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			// Handle subdirectory
			log.Printf("Processing subdirectory: %s", entry.Name())

			// Check if destination subdirectory already exists
			if _, errStat := os.Stat(dstPath); errStat == nil {
				log.Printf("Subdirectory '%s' already exists at destination, merging", entry.Name())

				// Ensure the destination subdirectory has the correct permissions
				if err := os.Chmod(dstPath, 0755); err != nil {
					log.Printf("Warning: could not update permissions on destination subdirectory: %v", err)
				}
			} else {
				// Create the subdirectory if it doesn't exist
				if err := os.MkdirAll(dstPath, 0755); err != nil {
					return renames, fmt.Errorf("failed to create subdirectory '%s': %v", entry.Name(), err)
				}
				log.Printf("Created subdirectory '%s' at destination", entry.Name())
			}

			// Recursively copy/merge the subdirectory contents
			subRenames, err := copyDirAndTrackRenames(srcPath, dstPath, overwrite)
			if err != nil {
				return renames, fmt.Errorf("error processing subdirectory '%s': %v", entry.Name(), err)
			}

			// Merge subRenames into renames
			for k, v := range subRenames {
				renames[k] = v
			}
		} else {
			// Handle file
			log.Printf("Processing file: %s", entry.Name())

			// Check if destination file already exists
			fileExists := false
			if _, errStat := os.Stat(dstPath); errStat == nil {
				fileExists = true
				log.Printf("File '%s' already exists at destination", entry.Name())
			}

			// For directories, we always want to merge files
			// Copy the file if it doesn't exist or if overwrite is true
			if !fileExists {
				// File doesn't exist, copy it
				if err := copyFile(srcPath, dstPath); err != nil {
					return renames, fmt.Errorf("failed to copy file '%s': %v", entry.Name(), err)
				}
				log.Printf("Copied file '%s' to destination", entry.Name())
			} else if overwrite {
				// File exists and overwrite is true
				log.Printf("Overwriting existing file '%s'", entry.Name())
				if err := copyFile(srcPath, dstPath); err != nil {
					return renames, fmt.Errorf("failed to overwrite file '%s': %v", entry.Name(), err)
				}
				log.Printf("Overwritten file '%s' at destination", entry.Name())
			} else {
				// File exists and overwrite is false, skip it
				log.Printf("Keeping existing file '%s' (not overwriting)", entry.Name())
			}
		}
	}

	return renames, nil
}

// duplicateRecordsWithRenames creates database records for copied files and directories,
// skipping existing files and directories when merging folders.
func duplicateRecordsWithRenames(
	srcRelPath, destRelPath string,
	dc *DirectoryController,
	username string,
	renames map[string]string,
) error {
	// 1) Duplicate file records for the current directory
	log.Printf("Creating database records for files in '%s' to '%s'", srcRelPath, destRelPath)

	fileRecords, err := dc.App.ListFilesInDirectory(srcRelPath)
	if err == nil {
		// Get existing files in destination directory to avoid duplicates
		destFiles, destErr := dc.App.ListFilesInDirectory(destRelPath)
		destFileNames := make(map[string]bool)
		if destErr == nil {
			for _, df := range destFiles {
				destFileNames[df.FileName] = true
				log.Printf("Found existing file in destination: %s", df.FileName)
			}
		} else {
			log.Printf("Warning: could not list files in destination directory '%s': %v", destRelPath, destErr)
		}

		for _, f := range fileRecords {
			// Skip if file already exists in destination (for merging)
			if destFileNames[f.FileName] {
				log.Printf("Skipping existing file during merge: %s", f.FileName)
				continue
			}

			newFilePath := filepath.Join(destRelPath, f.FileName)
			newFR := models.FileRecord{
				FileName:    f.FileName,
				FilePath:    newFilePath,
				Directory:   destRelPath,
				Size:        f.Size,
				ContentType: f.ContentType,
				Uploader:    username,
			}

			// Create the file record
			if createErr := dc.App.CreateFileRecord(newFR); createErr != nil {
				log.Printf("Error creating database record for file '%s': %v", f.FileName, createErr)
			} else {
				log.Printf("Created database record for file '%s' in '%s'", f.FileName, destRelPath)
			}
		}
	} else {
		log.Printf("Warning: could not list files in source directory '%s': %v", srcRelPath, err)
	}

	// 2) Look for subdirectories in the source directory
	log.Printf("Processing subdirectories in '%s'", srcRelPath)

	srcFullPath := filepath.Join("Cdrrmo", srcRelPath)
	entries, err := os.ReadDir(srcFullPath)
	if err != nil {
		log.Printf("Error reading source directory '%s': %v", srcFullPath, err)
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			subfolderName := entry.Name()
			log.Printf("Processing subdirectory '%s'", subfolderName)

			srcSubRel := filepath.Join(srcRelPath, subfolderName)
			destSubRel := filepath.Join(destRelPath, subfolderName)

			// Check if directory record already exists
			exists, checkErr := dc.App.DirectoryExists(subfolderName, destRelPath)
			if checkErr != nil {
				log.Printf("Error checking if directory '%s' exists in '%s': %v",
					subfolderName, destRelPath, checkErr)
				continue
			}

			// Only create directory record if it doesn't exist
			if !exists {
				log.Printf("Creating directory record for '%s' in '%s'", subfolderName, destRelPath)
				if createErr := dc.App.CreateDirectoryRecord(subfolderName, destRelPath, username); createErr != nil {
					log.Printf("Error creating directory record for '%s': %v", subfolderName, createErr)
				} else {
					log.Printf("Created directory record for '%s' in '%s'", subfolderName, destRelPath)
				}
			} else {
				log.Printf("Directory record for '%s' already exists in '%s', merging contents",
					subfolderName, destRelPath)

				// Log that we're merging the directory contents
				log.Printf("Merging directory contents for '%s' in '%s'", subfolderName, destRelPath)
			}

			// Recurse to handle subdirectory contents
			if err := duplicateRecordsWithRenames(srcSubRel, destSubRel, dc, username, renames); err != nil {
				log.Printf("Error processing subdirectory '%s': %v", subfolderName, err)
			} else {
				log.Printf("Successfully processed subdirectory '%s'", subfolderName)
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

// Tree, Move, DownloadFolder, etc. remain unchanged below...
func (dc *DirectoryController) Tree(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	_, err := dc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	dirs, err := dc.getAllDirectories()
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error fetching directories from DB")
		return
	}

	parentMap := make(map[string][]string)
	for _, d := range dirs {
		parentMap[d.Parent] = append(parentMap[d.Parent], d.Name)
	}
	tree := buildTree("", parentMap)
	models.RespondJSON(w, http.StatusOK, tree)
}

func buildTree(parent string, parentMap map[string][]string) []TreeNode {
	var result []TreeNode
	children := parentMap[parent]
	for _, childName := range children {
		var fullPath string
		if parent == "" {
			fullPath = childName
		} else {
			fullPath = filepath.Join(parent, childName)
		}
		childNodes := buildTree(fullPath, parentMap)
		node := TreeNode{
			Title:    childName,
			Value:    fullPath,
			Children: childNodes,
		}
		result = append(result, node)
	}
	return result
}

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

type DirectoryData struct {
	Name   string
	Parent string
}

// MoveDirectoryRequest represents the payload for moving a directory.
type MoveDirectoryRequest struct {
	Name      string `json:"name"`       // Directory name to move.
	OldParent string `json:"old_parent"` // Current parent folder (can be empty for root).
	NewParent string `json:"new_parent"` // Destination parent folder (must exist).
}

// Move handles moving a directory (folder) from one parent to another.
func (dc *DirectoryController) Move(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	user, err := dc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var req MoveDirectoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.OldParent = strings.TrimSpace(req.OldParent)
	req.NewParent = strings.TrimSpace(req.NewParent)

	if req.Name == "" {
		models.RespondError(w, http.StatusBadRequest, "Directory name is required")
		return
	}
	if req.OldParent == req.NewParent {
		models.RespondError(w, http.StatusBadRequest, "Old parent and new parent are the same")
		return
	}

	exists, err := dc.App.DirectoryExists(req.Name, req.OldParent)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error checking directory existence")
		return
	}
	if !exists {
		models.RespondError(w, http.StatusNotFound, "Source directory not found")
		return
	}

	if req.NewParent != "" {
		// Use the new DirectoryExistsByPath function to check if the destination path exists
		destExists, err := dc.App.DirectoryExistsByPath(req.NewParent)
		if err != nil {
			models.RespondError(w, http.StatusInternalServerError, "Error checking destination folder")
			return
		}
		if !destExists {
			models.RespondError(w, http.StatusBadRequest, "Destination folder does not exist")
			return
		}
	}

	oldPath := filepath.Join("Cdrrmo", req.OldParent, req.Name)
	newPath := filepath.Join("Cdrrmo", req.NewParent, req.Name)

	// Build relative paths for source/destination
	sourceRelPath := filepath.Join(req.OldParent, req.Name)
	destRelPath := filepath.Join(req.NewParent, req.Name)

	// Check if destination folder already exists
	if _, err := os.Stat(newPath); err == nil {
		// Destination folder exists, we'll merge contents instead of moving directly
		log.Printf("Destination folder '%s' already exists, will merge contents", newPath)

		// Ensure the destination folder has the correct permissions
		if err := os.Chmod(newPath, 0755); err != nil {
			log.Printf("Warning: could not update permissions on destination folder: %v", err)
		}

		// Use the copyDirAndTrackRenames function to merge the folders
		renames, err := copyDirAndTrackRenames(oldPath, newPath, true)
		if err != nil {
			models.RespondError(w, http.StatusInternalServerError, "Error merging folder contents: "+err.Error())
			return
		}

		// Duplicate records in the database
		if err := duplicateRecordsWithRenames(sourceRelPath, destRelPath, dc, user.Username, renames); err != nil {
			log.Println("Warning: error duplicating nested records:", err)
		}

		// Delete file_versions for any files in the source folder
		if err := dc.App.DeleteFileVersionsInFolder(sourceRelPath); err != nil {
			log.Printf("Warning: could not delete file versions in source folder: %v", err)
		}

		// Delete the file records in the source folder
		if err := dc.App.DeleteFilesWithPrefix(sourceRelPath); err != nil {
			log.Printf("Warning: could not delete file records in source folder: %v", err)
		}

		// Delete any subdirectories in the source folder
		if err := dc.App.DeleteDirectoriesWithPrefix(sourceRelPath); err != nil {
			log.Printf("Warning: could not delete subdirectory records: %v", err)
		}

		// Delete the source directory record
		if err := dc.App.DeleteDirectoryAndSubdirectories(req.OldParent, req.Name); err != nil {
			log.Printf("Warning: could not delete source directory record: %v", err)
		}

		// Delete the source folder after successful merge
		if err := os.RemoveAll(oldPath); err != nil {
			log.Printf("Warning: could not remove source folder after merge: %v", err)
			// Continue anyway as the content has been copied
		}

		dc.App.LogActivity(fmt.Sprintf("User '%s' merged directory '%s' from '%s' into '%s'.",
			user.Username, req.Name, req.OldParent, req.NewParent))
		dc.App.LogAudit(user.Username, 0, "MERGE_FOLDER", fmt.Sprintf("User '%s' merged folder '%s' from '%s' into '%s'.", user.Username, req.Name, req.OldParent, req.NewParent))

		models.RespondJSON(w, http.StatusOK, map[string]string{
			"message": fmt.Sprintf("Directory '%s' merged successfully", req.Name),
		})
	} else {
		// Simple move operation - no folder with the same name exists at the destination
		if err := os.Rename(oldPath, newPath); err != nil {
			models.RespondError(w, http.StatusInternalServerError, "Error moving directory on disk")
			return
		}

		if err := dc.App.MoveDirectoryRecord(req.Name, req.OldParent, req.NewParent); err != nil {
			os.Rename(newPath, oldPath) // rollback
			models.RespondError(w, http.StatusInternalServerError, "Error updating directory records")
			return
		}

		dc.App.LogActivity(fmt.Sprintf("User '%s' moved directory '%s' from '%s' to '%s'.",
			user.Username, req.Name, req.OldParent, req.NewParent))
		dc.App.LogAudit(user.Username, 0, "MOVE_FOLDER", fmt.Sprintf("User '%s' moved folder '%s' from '%s' to '%s'.", user.Username, req.Name, req.OldParent, req.NewParent))

		models.RespondJSON(w, http.StatusOK, map[string]string{
			"message": fmt.Sprintf("Directory '%s' moved successfully", req.Name),
		})
	}
}

// DownloadFolder handles zipping and downloading a folder.
func (dc *DirectoryController) DownloadFolder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	user, err := dc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	folder := strings.TrimSpace(r.URL.Query().Get("directory"))
	if folder == "" {
		models.RespondError(w, http.StatusBadRequest, "Missing directory parameter")
		return
	}

	absFolder := filepath.Join("Cdrrmo", folder)
	info, err := os.Stat(absFolder)
	if err != nil || !info.IsDir() {
		models.RespondError(w, http.StatusNotFound, "Folder not found")
		return
	}

	zipFile, err := os.CreateTemp("", "folder-*.zip")
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Could not create temporary file")
		return
	}
	defer os.Remove(zipFile.Name())
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)

	// Walk and zip all files and subfolders
	err = filepath.Walk(absFolder, func(filePath string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		relPath, err := filepath.Rel(absFolder, filePath)
		if err != nil {
			return err
		}
		relPath = filepath.ToSlash(relPath)

		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		header.Name = relPath
		if info.IsDir() {
			header.Name += "/"
		} else {
			header.Method = zip.Deflate
		}

		writer, err := zipWriter.CreateHeader(header)
		if err != nil {
			return err
		}

		if !info.IsDir() {
			file, err := os.Open(filePath)
			if err != nil {
				return err
			}
			defer file.Close()

			if _, err := io.Copy(writer, file); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error creating ZIP archive: "+err.Error())
		return
	}

	if err := zipWriter.Close(); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error finalizing zip archive")
		return
	}

	dc.App.LogAudit(
		user.Username,
		0,
		"DOWNLOAD_FOLDER",
		fmt.Sprintf("User '%s' downloaded folder '%s'.", user.Username, folder),
	)

	zipFileForRead, err := os.Open(zipFile.Name())
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error opening zipped folder")
		return
	}
	defer zipFileForRead.Close()

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.zip\"", info.Name()))
	io.Copy(w, zipFileForRead)
}

// generateUniqueFolderName & generateCopyName remain the same...
func generateUniqueFolderName(baseName, parent string) (string, error) {
	uniqueName := baseName
	folderPath := getResourcePath(uniqueName, parent)
	for {
		if _, err := os.Stat(folderPath); os.IsNotExist(err) {
			break
		}
		uniqueName = generateCopyName(uniqueName)
		folderPath = getResourcePath(uniqueName, parent)
	}
	return uniqueName, nil
}

func generateCopyName(original string) string {
	if strings.HasSuffix(original, "_copy") {
		return original + "_1"
	}
	if idx := strings.LastIndex(original, "_copy_"); idx != -1 {
		base := original[:idx+len("_copy_")]
		suffix := original[idx+len("_copy_"):]
		if num, err := strconv.Atoi(suffix); err == nil {
			num++
			return fmt.Sprintf("%s%d", base, num)
		}
	}
	return original + "_copy"
}
