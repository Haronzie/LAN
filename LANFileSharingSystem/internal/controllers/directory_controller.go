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
// If parent is empty, the directory is assumed to be directly under "uploads".
func getResourcePath(name, parent string) string {
	basePath := "uploads"
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

	// 1) Build the absolute path for disk deletion
	resourcePath := getResourcePath(req.Name, req.Parent)

	// 2) Remove the directory (and its sub-contents) from the filesystem
	if err := os.RemoveAll(resourcePath); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error deleting directory on disk")
		return
	}

	// 3) Build the relative path (for database deletion).
	//    e.g. If parent="Root" and name="FolderA", this becomes "Root/FolderA"
	relativeFolder := filepath.Join(req.Parent, req.Name)

	// *** Delete file_versions for any files in this folder.
	if err := dc.App.DeleteFileVersionsInFolder(relativeFolder); err != nil {
		models.RespondError(w, http.StatusInternalServerError,
			"Error deleting file version records in the folder")
		return
	}

	// 4) Delete the file records in that folder
	if err := dc.App.DeleteFilesWithPrefix(relativeFolder); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error deleting file records in the folder")
		return
	}

	// 5) Delete any subdirectories
	if err := dc.App.DeleteDirectoriesWithPrefix(relativeFolder); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error deleting directory records from database")
		return
	}
	if err := dc.App.DeleteDirectoryAndSubdirectories(req.Parent, req.Name); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error deleting directory records from database")
		return
	}

	dc.App.LogActivity(fmt.Sprintf(
		"User '%s' deleted directory '%s' (parent: '%s') and all its contents.",
		user.Username, req.Name, req.Parent))

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

	// 2) Auto-rename the top-level destination folder if it already exists
	if _, err := os.Stat(dstPath); err == nil {
		uniqueName, _ := generateUniqueFolderName(req.NewName, destParent)
		req.NewName = uniqueName
		destRelPath = filepath.Join(destParent, req.NewName)
		dstPath = getResourcePath(req.NewName, destParent)
	}

	// 3) Recursively copy the folder on disk, capturing any subfolder renames
	renames, err := copyDirAndTrackRenames(srcPath, dstPath)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error copying folder: "+err.Error())
		// Optionally remove the partially copied folder on disk
		return
	}

	// 4) Create the top-level directory record
	if err := dc.App.CreateDirectoryRecord(req.NewName, destParent, user.Username); err != nil {
		os.RemoveAll(dstPath) // rollback if DB fails
		models.RespondError(w, http.StatusInternalServerError, "Error saving folder record to database")
		return
	}

	// 5) Recursively duplicate file & directory records, using the rename map
	if err := duplicateRecordsWithRenames(sourceRelPath, destRelPath, dc, user.Username, renames); err != nil {
		log.Println("Warning: error duplicating nested records:", err)
		// optionally remove the folder or partially inserted records
	}

	dc.App.LogActivity(fmt.Sprintf("User '%s' copied folder from '%s' to '%s'.",
		user.Username, sourceRelPath, destRelPath))

	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Folder copied to '%s' successfully", destRelPath),
	})
}

// copyDirAndTrackRenames recursively copies a directory from src to dst,
// renaming subfolders if collisions occur. It returns a map so we can
// track which subfolders ended up renamed on disk.
func copyDirAndTrackRenames(src, dst string) (map[string]string, error) {
	renames := make(map[string]string) // key = oldFullDstPath, val = newSubfolderName

	entries, err := os.ReadDir(src)
	if err != nil {
		return renames, err
	}

	// Ensure the destination folder exists
	if err := os.MkdirAll(dst, 0755); err != nil {
		return renames, err
	}

	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			// If a subfolder with this name already exists, rename it
			if _, errStat := os.Stat(dstPath); errStat == nil {
				newName, _ := generateUniqueFolderName(entry.Name(), filepath.Base(dst))
				// So now "dst/Subfolder" => "dst/Subfolder_copy"
				dstPath = filepath.Join(dst, newName)
				// Record that this subfolder was renamed
				renames[filepath.Join(dst, entry.Name())] = newName
			}

			subRenames, err := copyDirAndTrackRenames(srcPath, dstPath)
			if err != nil {
				return renames, err
			}
			// Merge subRenames into renames
			for k, v := range subRenames {
				renames[k] = v
			}
		} else {
			// Copy file
			if err := copyFile(srcPath, dstPath); err != nil {
				return renames, err
			}
		}
	}
	return renames, nil
}

// duplicateRecordsWithRenames is like duplicateRecords, but uses the renames map
// to ensure DB directory records match the final on-disk folder names.
func duplicateRecordsWithRenames(
	srcRelPath, destRelPath string,
	dc *DirectoryController,
	username string,
	renames map[string]string,
) error {
	// 1) Duplicate file records for the current directory
	fileRecords, err := dc.App.ListFilesInDirectory(srcRelPath)
	if err == nil {
		for _, f := range fileRecords {
			newFilePath := filepath.Join(destRelPath, f.FileName)
			newFR := models.FileRecord{
				FileName:    f.FileName,
				FilePath:    newFilePath,
				Size:        f.Size,
				ContentType: f.ContentType,
				Uploader:    username,
			}
			// Attempt to create the file record
			if createErr := dc.App.CreateFileRecord(newFR); createErr != nil {
				// If it's a duplicate key constraint, rename and retry
				if strings.Contains(createErr.Error(), "duplicate key value violates unique constraint") {
					log.Println("Auto-renaming duplicate file:", newFR.FileName)
					newFR.FileName = generateCopyName(newFR.FileName)
					newFR.FilePath = filepath.Join(destRelPath, newFR.FileName)

					if retryErr := dc.App.CreateFileRecord(newFR); retryErr != nil {
						log.Println("Error creating file record even after rename:", retryErr)
					}
				} else {
					log.Println("Error duplicating file record for", f.FileName, ":", createErr)
				}
			}
		}
	} else {
		log.Println("Warning: could not list files in", srcRelPath, ":", err)
	}

	// 2) Look for subdirectories in the source directory
	srcFullPath := filepath.Join("uploads", srcRelPath)
	entries, err := os.ReadDir(srcFullPath)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			srcSubRel := filepath.Join(srcRelPath, entry.Name())
			destSubRel := filepath.Join(destRelPath, entry.Name())

			// Check if we renamed this subfolder on disk
			// The original full path on disk was: "dst + / + entry.Name()"
			// But we only have the *relative* "destRelPath/entry.Name()"
			oldFullDst := filepath.Join("uploads", destRelPath, entry.Name())

			newSubfolderName := entry.Name() // default
			if renameVal, found := renames[oldFullDst]; found {
				newSubfolderName = renameVal
				destSubRel = filepath.Join(destRelPath, newSubfolderName)
			}

			// Create a directory record with the final subfolder name
			if createErr := dc.App.CreateDirectoryRecord(newSubfolderName, destRelPath, username); createErr != nil {
				if strings.Contains(createErr.Error(), "duplicate key value violates unique constraint") {
					log.Println("Auto-renaming duplicate directory:", newSubfolderName)
					renamed := generateCopyName(newSubfolderName)
					if retryErr := dc.App.CreateDirectoryRecord(renamed, destRelPath, username); retryErr != nil {
						log.Println("Error creating directory record even after rename:", retryErr)
						continue
					}
					destSubRel = filepath.Join(destRelPath, renamed)
				} else {
					log.Println("Error creating directory record for", entry.Name(), ":", createErr)
				}
			}

			// Recurse
			if err := duplicateRecordsWithRenames(srcSubRel, destSubRel, dc, username, renames); err != nil {
				log.Println("Error duplicating records for subdirectory", entry.Name(), ":", err)
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
		destExists, err := dc.App.DirectoryExists(req.NewParent, "")
		if err != nil {
			models.RespondError(w, http.StatusInternalServerError, "Error checking destination folder")
			return
		}
		if !destExists {
			models.RespondError(w, http.StatusBadRequest, "Destination folder does not exist")
			return
		}
	}

	oldPath := filepath.Join("uploads", req.OldParent, req.Name)
	newPath := filepath.Join("uploads", req.NewParent, req.Name)

	if _, err := os.Stat(newPath); err == nil {
		models.RespondError(w, http.StatusConflict, "A folder with that name already exists in the destination")
		return
	}

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

	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Directory '%s' moved successfully", req.Name),
	})
}

// DownloadFolder handles zipping and downloading a folder.
func (dc *DirectoryController) DownloadFolder(w http.ResponseWriter, r *http.Request) {
	// Only allow GET requests.
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	// Authenticate the user.
	user, err := dc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Retrieve and validate the 'directory' query parameter.
	folder := strings.TrimSpace(r.URL.Query().Get("directory"))
	if folder == "" {
		models.RespondError(w, http.StatusBadRequest, "Missing directory parameter")
		return
	}

	absFolder := filepath.Join("uploads", folder)
	info, err := os.Stat(absFolder)
	if err != nil || !info.IsDir() {
		models.RespondError(w, http.StatusNotFound, "Folder not found")
		return
	}

	// Create a temporary file for the ZIP archive.
	zipFile, err := os.CreateTemp("", "folder-*.zip")
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Could not create temporary file")
		return
	}
	defer os.Remove(zipFile.Name())
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)

	// Keep track of how many files were allowed vs. filtered.
	var allowedCount, filteredCount int

	// Walk through the folder recursively.
	err = filepath.Walk(absFolder, func(filePath string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		// Compute the relative path within the folder.
		relPath, err := filepath.Rel(absFolder, filePath)
		if err != nil {
			return err
		}
		relPath = filepath.ToSlash(relPath)

		// Create a ZIP header.
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		header.Name = relPath
		if info.IsDir() {
			// Ensure directory names end with "/".
			header.Name += "/"
		} else {
			header.Method = zip.Deflate
		}

		// Only apply confidential checks if it's a file (not a directory).
		if !info.IsDir() {
			includeFile := true
			// Build the file record path as stored in the DB.
			fileRecordPath := filepath.ToSlash(filepath.Join(folder, relPath))
			fr, err := dc.App.GetFileRecordByPath(fileRecordPath)
			if err == nil {
				// If the file is confidential, check if the user is permitted.
				if fr.Confidential {
					if fr.Uploader != user.Username && user.Role != "admin" {
						allowed, perr := dc.App.HasFileAccess(fr.ID, user.Username)
						if perr != nil || !allowed {
							includeFile = false
						}
					}
				}
			}
			if includeFile {
				allowedCount++
				// Use a helper function (models.AddFileToArchive) or inline logic:
				if err := models.AddFileToArchive(zipWriter, filePath, relPath); err != nil {
					log.Printf("Error adding file %s to archive: %v", filePath, err)
					return err
				}
			} else {
				filteredCount++
				// Add a placeholder file indicating restricted access.
				placeholderName := relPath + ".restricted.txt"
				placeholderContent := "This file is confidential and you are not authorized to download it."
				writer, err := zipWriter.Create(placeholderName)
				if err != nil {
					log.Printf("Error creating placeholder for %s: %v", relPath, err)
					return err
				}
				if _, err := writer.Write([]byte(placeholderContent)); err != nil {
					log.Printf("Error writing placeholder content for %s: %v", relPath, err)
					return err
				}
			}
			return nil
		}

		// For directories, just create the header (no file copy).
		_, err = zipWriter.CreateHeader(header)
		return err
	})
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error zipping folder: "+err.Error())
		return
	}

	// Finalize the ZIP archive.
	if err := zipWriter.Close(); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error finalizing zip archive")
		return
	}

	dc.App.LogAudit(
		user.Username,
		nil, // fileID is nil because this is a folder-level event
		"DOWNLOAD_FOLDER",
		fmt.Sprintf("User '%s' downloaded folder '%s'. Allowed files: %d, filtered: %d",
			user.Username, folder, allowedCount, filteredCount),
	)

	// Open the ZIP file for reading.
	zipFileForRead, err := os.Open(zipFile.Name())
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error opening zipped folder")
		return
	}
	defer zipFileForRead.Close()

	// Set response headers and stream the ZIP archive.
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.zip\"", info.Name()))
	if _, err := io.Copy(w, zipFileForRead); err != nil {
		log.Println("Error sending zip file:", err)
	}
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
