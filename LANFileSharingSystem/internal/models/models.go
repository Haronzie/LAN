package models

import (
	"archive/zip"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"LANFileSharingSystem/internal/ws"

	"github.com/gorilla/sessions"
	"golang.org/x/crypto/bcrypt"
)

// App holds shared resources across the application.
type App struct {
	DB              *sql.DB
	Store           sessions.Store
	FileCache       map[string]FileRecord
	FileShareTokens map[string]string
	NotificationHub *ws.Hub
}

// NewApp creates a new App instance.
func NewApp(db *sql.DB, store sessions.Store) *App {
	return &App{
		DB:              db,
		Store:           store,
		FileCache:       make(map[string]FileRecord),
		FileShareTokens: make(map[string]string),
	}
}

// -------------------------------------
//  Data Structures
// -------------------------------------

// User represents an application user.
type User struct {
	Username  string    `json:"username"`
	Password  string    `json:"password"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type FileMessage struct {
	ID        int       `json:"id"`
	FileID    int       `json:"file_id"`
	Sender    string    `json:"sender"`
	Receiver  string    `json:"receiver"`
	Message   string    `json:"message"`
	IsDone    bool      `json:"is_done"`
	CreatedAt time.Time `json:"created_at"`
}

type AuditLog struct {
	ID               int       `json:"id"`
	UserUsername     *string   `json:"user_username"`
	UsernameAtAction *string   `json:"username_at_action"` // <-- NEW FIELD
	FileID           *int      `json:"file_id"`
	Action           string    `json:"action"`
	Details          string    `json:"details"`
	CreatedAt        time.Time `json:"created_at"`
}

// MoveFileRequest represents the payload for moving a file.
type MoveFileRequest struct {
	Filename  string `json:"filename"`
	OldParent string `json:"old_parent"`
	NewParent string `json:"new_parent"`
}

// FileRecord represents a file stored in the system.
type FileRecord struct {
	ID          int                    `json:"id"`
	FileName    string                 `json:"file_name"`
	Directory   string                 `json:"directory"`
	FilePath    string                 `json:"file_path"`
	Size        int64                  `json:"size"`
	ContentType string                 `json:"content_type"`
	Uploader    string                 `json:"uploader"`
	Metadata    map[string]interface{} `json:"metadata"` // 👈 dynamic field
}

// -------------------------------------
//  Request Structs (for user_controller.go)
// -------------------------------------

type AddUserRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type UpdateUserRequest struct {
	OldUsername string `json:"old_username"`
	NewUsername string `json:"new_username"`
	NewPassword string `json:"new_password"`
}

type DeleteUserRequest struct {
	Username string `json:"username"`
}

type AssignAdminRequest struct {
	Username string `json:"username"`
}

// Activity represents an audit log entry.
type Activity struct {
	ID        int       `json:"id"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}

// -------------------------------------
//  JSON Response Helpers
// -------------------------------------

func RespondJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(payload)
}

func RespondError(w http.ResponseWriter, code int, message string) {
	RespondJSON(w, code, map[string]string{"error": message})
}

// -------------------------------------
//  Password & Session Helpers
// -------------------------------------

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPasswordHash(password, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func (app *App) GenerateToken() (string, error) {
	b := make([]byte, 16) // 128-bit token
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (app *App) DefaultSessionOptions() *sessions.Options {
	return &sessions.Options{
		Path:     "/",
		MaxAge:   86400, // 1 day
		HttpOnly: true,
	}
}

// GetUserFromSession retrieves the authenticated user from the session.
func (app *App) GetUserFromSession(r *http.Request) (User, error) {
	session, err := app.Store.Get(r, "session")
	if err != nil {
		log.Println("Error retrieving session:", err)
		return User{}, errors.New("session retrieval error")
	}

	username, ok := session.Values["username"].(string)
	if !ok || username == "" {
		return User{}, errors.New("user not logged in or session expired")
	}

	user, err := app.GetUserByUsername(username)
	if err != nil {
		return User{}, errors.New("user not found")
	}

	return user, nil
}

// -------------------------------------
//  User / Admin Operations
// -------------------------------------

// GetUserByUsername retrieves a user by username from the database.
func (app *App) GetUserByUsername(username string) (User, error) {
	row := app.DB.QueryRow(`
        SELECT username, password, role, created_at, updated_at
        FROM users
        WHERE lower(username) = lower($1)
    `, username)

	var user User
	err := row.Scan(
		&user.Username,
		&user.Password,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	return user, err
}

// CreateUser inserts a new user into the database.
func (app *App) CreateUser(user User) error {
	_, err := app.DB.Exec(`
        INSERT INTO users(username, password, role)
        VALUES($1, $2, $3)
    `,
		user.Username,
		user.Password,
		user.Role,
	)
	return err
}

// ListUsers returns all users from the database.
func (app *App) ListUsers() ([]User, error) {
	rows, err := app.DB.Query(`
        SELECT username, password, role, created_at, updated_at
        FROM users
        ORDER BY username
    `)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(
			&u.Username,
			&u.Password,
			&u.Role,
			&u.CreatedAt,
			&u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

// AdminExists checks if there is any admin user.
func (app *App) AdminExists() bool {
	var count int
	row := app.DB.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'")
	if err := row.Scan(&count); err != nil {
		return false
	}
	return count > 0
}

// UpdateUserProfile updates only the username.
func (app *App) UpdateUserProfile(oldUsername, newUsername string) error {
	_, err := app.DB.Exec(`
        UPDATE users
        SET username = $1, updated_at = CURRENT_TIMESTAMP
        WHERE username = $2
    `, newUsername, oldUsername)
	return err
}

// UpdateUser updates a user's username and password.
func (app *App) UpdateUser(oldUsername, newUsername, newPassword string) error {
	hashedPass, err := HashPassword(newPassword)
	if err != nil {
		return err
	}
	_, err = app.DB.Exec(`
        UPDATE users
        SET username = $1, password = $2, updated_at = CURRENT_TIMESTAMP
        WHERE username = $3
    `, newUsername, hashedPass, oldUsername)
	return err
}

// DeleteUser removes a user from the database.
func (app *App) DeleteUser(username string) error {
	res, err := app.DB.Exec(`
        DELETE FROM users
        WHERE username = $1
    `, username)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("user not found")
	}
	return nil
}

// AssignAdmin promotes a user to an admin role.
func (app *App) AssignAdmin(username string) error {
	_, err := app.DB.Exec(`
        UPDATE users
        SET role = 'admin', updated_at = CURRENT_TIMESTAMP
        WHERE username = $1
    `, username)
	return err
}

// -------------------------------------
//  Activity Logging
// -------------------------------------

func (app *App) LogActivity(event string) {
	_, err := app.DB.Exec(`
        INSERT INTO activity_log(event, timestamp)
        VALUES($1, CURRENT_TIMESTAMP)
    `, event)
	if err != nil {
		log.Println("Error logging activity:", err)
	}
}

func (app *App) ListActivities() ([]map[string]interface{}, error) {
	rows, err := app.DB.Query(`
        SELECT id, timestamp, event
        FROM activity_log
        ORDER BY timestamp DESC
        LIMIT 50
    `)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var activities []map[string]interface{}
	for rows.Next() {
		var (
			id        int
			timestamp time.Time
			event     string
		)
		if err := rows.Scan(&id, &timestamp, &event); err != nil {
			continue
		}
		activities = append(activities, map[string]interface{}{
			"id":        id,
			"timestamp": timestamp,
			"event":     event,
		})
	}
	return activities, nil
}

// -------------------------------------
//  File & Directory Operations
// -------------------------------------

func (app *App) CreateFileRecord(record FileRecord) error {
	metadataJSON, _ := json.Marshal(record.Metadata)
	_, err := app.DB.Exec(`
		INSERT INTO files (file_name, file_path, directory, size, content_type, uploader, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`,
		record.FileName,
		record.FilePath,
		record.Directory,
		record.Size,
		record.ContentType,
		record.Uploader,
		metadataJSON,
	)
	return err
}

func (app *App) GetFileRecord(fileName string) (FileRecord, error) {
	row := app.DB.QueryRow(`
        SELECT id, file_name, file_path, size, content_type, uploader
        FROM files
        WHERE file_name = $1
    `, fileName)

	var fr FileRecord
	err := row.Scan(
		&fr.ID,
		&fr.FileName,
		&fr.FilePath,
		&fr.Size,
		&fr.ContentType,
		&fr.Uploader,
	)
	return fr, err
}

func (app *App) ListFiles() ([]FileRecord, error) {
	rows, err := app.DB.Query(`
        SELECT file_name, size, content_type, uploader
        FROM files
    `)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var files []FileRecord
	for rows.Next() {
		var fr FileRecord
		if err := rows.Scan(&fr.FileName, &fr.Size, &fr.ContentType, &fr.Uploader); err != nil {
			continue
		}
		files = append(files, fr)
	}
	return files, nil
}

func (app *App) CreateDirectoryRecord(name, parent, createdBy string) error {
	_, err := app.DB.Exec(`
        INSERT INTO directories(directory_name, parent_directory, created_by, created_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `, name, parent, createdBy)
	return err
}

func (app *App) DeleteDirectoryRecord(name string) error {
	_, err := app.DB.Exec(`
        DELETE FROM directories
        WHERE directory_name = $1
    `, name)
	return err
}

func (app *App) UpdateDirectoryRecord(oldName, newName string) error {
	// 1. Rename the directory record itself
	_, err := app.DB.Exec(`
        UPDATE directories 
        SET directory_name = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE directory_name = $2
    `, newName, oldName)
	if err != nil {
		return err
	}

	// 2. Update any subfolders whose parent_directory = oldName
	_, err = app.DB.Exec(`
        UPDATE directories
        SET parent_directory = $1
        WHERE parent_directory = $2
    `, newName, oldName)
	return err
}

// ListDirectory is a placeholder that can be implemented as needed.
func (app *App) ListDirectory(parent string) ([]map[string]interface{}, error) {
	query := `
        SELECT directory_name, parent_directory, created_by, created_at
        FROM directories
        WHERE parent_directory = $1
    `
	rows, err := app.DB.Query(query, parent)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var directories []map[string]interface{}
	for rows.Next() {
		var name, parentDir, createdBy string
		var createdAt time.Time
		if err := rows.Scan(&name, &parentDir, &createdBy, &createdAt); err != nil {
			continue
		}
		directories = append(directories, map[string]interface{}{
			"name":       name,
			"type":       "directory", // this helps the UI distinguish folders from files
			"parent":     parentDir,
			"created_by": createdBy,
			"created_at": createdAt,
		})
	}
	return directories, nil
}

func (app *App) ListFilesInDirectory(dir string) ([]FileRecord, error) {
	var rows *sql.Rows
	var err error

	if dir == "" {
		// Root: files with no slash at all
		rows, err = app.DB.Query(`
            SELECT id, file_name, file_path, size, content_type, uploader
            FROM files
            WHERE file_path NOT LIKE '%/%'
        `)
	} else {
		// Only immediate children of dir.
		rows, err = app.DB.Query(`
            SELECT id, file_name, file_path, size, content_type, uploader
            FROM files
            WHERE file_path LIKE $1 || '/%' 
              AND file_path NOT LIKE $1 || '/%/%'
        `, dir)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []FileRecord
	for rows.Next() {
		var f FileRecord
		if err := rows.Scan(&f.ID, &f.FileName, &f.FilePath, &f.Size, &f.ContentType, &f.Uploader); err != nil {
			return nil, err
		}
		results = append(results, f)
	}
	return results, nil
}

// DirectoryExists checks if a directory with the given name exists under the specified parent.
func (app *App) DirectoryExists(name, parent string) (bool, error) {
	var count int
	query := `
        SELECT COUNT(*)
        FROM directories
        WHERE directory_name = $1
          AND parent_directory = $2
    `
	err := app.DB.QueryRow(query, name, parent).Scan(&count)
	return count > 0, err
}

// Enhance this method to update both file_name AND file_path
func (app *App) RenameFileRecord(oldFilename, newFilename, newFilePath string) error {
	_, err := app.DB.Exec(`
        UPDATE files
        SET file_name = $1,
            file_path = $2
        WHERE file_name = $3
    `, newFilename, newFilePath, oldFilename)
	return err
}

func (app *App) DeleteFileRecord(fileName string) (int, error) {
	log.Printf("Attempting to delete file: %s", fileName)

	var fileID int
	err := app.DB.QueryRow("SELECT id FROM files WHERE file_name = $1", fileName).Scan(&fileID)
	if err != nil {
		log.Printf("Error retrieving file ID for '%s': %v", fileName, err)
		return 0, err
	}

	_, err = app.DB.Exec("DELETE FROM files WHERE file_name = $1", fileName)
	if err != nil {
		log.Printf("Error deleting file '%s' from database: %v", fileName, err)
	}

	return fileID, err
}

// UpdateFilePathsForRenamedFolder updates the file paths of all files
// whose file_path starts with oldFolderPath by replacing that prefix with newFolderPath.
func (app *App) UpdateFilePathsForRenamedFolder(oldFolderPath, newFolderPath string) error {
	query := `
        UPDATE files
        SET file_path = regexp_replace(file_path, $1, $2)
        WHERE file_path LIKE $3
    `
	// Create a pattern that matches the beginning of the file_path.
	pattern := "^" + oldFolderPath
	// Build the LIKE pattern (files whose file_path starts with oldFolderPath).
	likePattern := oldFolderPath + "%"
	_, err := app.DB.Exec(query, pattern, newFolderPath, likePattern)
	return err
}

func (app *App) DeleteFilesInFolder(folderPath string) error {
	pattern := folderPath + "%" // All files whose path begins with folderPath
	_, err := app.DB.Exec("DELETE FROM files WHERE file_path LIKE $1", pattern)
	return err
}

// -------------------------------------------------------------------
//  Inventory Feature (Added at the bottom of models.go)
// -------------------------------------------------------------------

// InventoryItem represents a single inventory record.
type InventoryItem struct {
	ID        int       `json:"id"`
	ItemName  string    `json:"item_name"`
	Quantity  int       `json:"quantity"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateInventoryItem inserts a new record into the inventory table.
func (app *App) CreateInventoryItem(item InventoryItem) error {
	_, err := app.DB.Exec(`
        INSERT INTO inventory (item_name, quantity)
        VALUES ($1, $2)
    `, item.ItemName, item.Quantity)
	return err
}

// ListInventoryItems returns all items from the inventory table.
func (app *App) ListInventoryItems() ([]InventoryItem, error) {
	rows, err := app.DB.Query(`
        SELECT id, item_name, quantity, created_at, updated_at
        FROM inventory
        ORDER BY id
    `)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []InventoryItem
	for rows.Next() {
		var it InventoryItem
		if err := rows.Scan(&it.ID, &it.ItemName, &it.Quantity, &it.CreatedAt, &it.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, nil
}

// GetInventoryItemByID retrieves a single item by its ID.
func (app *App) GetInventoryItemByID(id int) (InventoryItem, error) {
	row := app.DB.QueryRow(`
        SELECT id, item_name, quantity, created_at, updated_at
        FROM inventory
        WHERE id = $1
    `, id)

	var it InventoryItem
	err := row.Scan(&it.ID, &it.ItemName, &it.Quantity, &it.CreatedAt, &it.UpdatedAt)
	if err == sql.ErrNoRows {
		return it, errors.New("inventory item not found")
	}
	return it, err
}

// UpdateInventoryItem updates an existing record.
func (app *App) UpdateInventoryItem(item InventoryItem) error {
	_, err := app.DB.Exec(`
        UPDATE inventory
        SET item_name = $1, quantity = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
    `, item.ItemName, item.Quantity, item.ID)
	return err
}

// DeleteInventoryItem removes a record from the inventory table.
func (app *App) DeleteInventoryItem(id int) error {
	_, err := app.DB.Exec(`
        DELETE FROM inventory
        WHERE id = $1
    `, id)
	return err
}

func (app *App) DeleteFilesWithPrefix(prefix string) error {
	query := `
        DELETE FROM files
        WHERE file_path = $1
           OR file_path LIKE $1 || '/%'
    `
	// For empty parent, you might just have "FolderName" in file_path.
	// The first condition (`file_path = $1`) catches the exact match (rare for a folder).
	// The second condition matches subpaths, e.g. "FolderName/anything..."
	_, err := app.DB.Exec(query, prefix)
	return err
}
func (app *App) DeleteDirectoriesWithPrefix(prefix string) error {
	query := `DELETE FROM directories WHERE (parent_directory || '/' || directory_name) LIKE $1 || '%'`
	_, err := app.DB.Exec(query, prefix)
	return err
}

// DeleteDirectoryAndSubdirectories removes exactly the (parent, name) directory record,
// then removes all subdirectories that reside under it.
func (app *App) DeleteDirectoryAndSubdirectories(parent, name string) error {
	// Build a prefix for subfolders
	// e.g. if parent = "", prefix = "Tata"
	//      if parent = "Root", prefix = "Root/Tata"
	prefix := parent
	if prefix != "" {
		prefix += "/"
	}
	prefix += name

	// 1) Delete the main directory itself
	_, err := app.DB.Exec(`
        DELETE FROM directories
        WHERE parent_directory = $1
          AND directory_name = $2
    `, parent, name)
	if err != nil {
		return err
	}

	// 2) Delete any subfolders whose path starts with prefix
	_, err = app.DB.Exec(`
        DELETE FROM directories
        WHERE (parent_directory || '/' || directory_name) LIKE $1 || '/%'
    `, prefix)
	return err
}

// MoveDirectoryRecord updates the parent_directory of a directory.
func (app *App) MoveDirectoryRecord(name, oldParent, newParent string) error {
	// 1) Update the directory record for the folder itself
	_, err := app.DB.Exec(`
        UPDATE directories
        SET parent_directory = $1, updated_at = CURRENT_TIMESTAMP
        WHERE directory_name = $2 AND parent_directory = $3
    `, newParent, name, oldParent)
	if err != nil {
		return err
	}

	// 2) Now fix subfolders that used to have "oldParent/name" in their parent path
	oldFullPath := oldParent
	if oldFullPath != "" {
		oldFullPath += "/"
	}
	oldFullPath += name

	newFullPath := newParent
	if newFullPath != "" {
		newFullPath += "/"
	}
	newFullPath += name

	// Example approach: any directory whose parent_directory starts with oldFullPath
	// should replace that prefix with newFullPath.
	_, err = app.DB.Exec(`
        UPDATE directories
        SET parent_directory = regexp_replace(parent_directory, '^' || $1, $2)
        WHERE parent_directory LIKE $1 || '/%'
    `, oldFullPath, newFullPath)
	if err != nil {
		return err
	}

	// 3) Also update file paths if needed
	// If your file paths start with "oldParent/name", do a similar approach
	err = app.UpdateFilePathsForRenamedFolder(oldFullPath, newFullPath)
	return err
}
func (app *App) UpdateUserPassword(username, hashedPassword string) error {
	_, err := app.DB.Exec(`
        UPDATE users
        SET password = $1, updated_at = CURRENT_TIMESTAMP
        WHERE username = $2
    `, hashedPassword, username)
	return err
}
func (app *App) CreateFileVersion(fileID, versionNum int, path string) error {
	_, err := app.DB.Exec(`
        INSERT INTO file_versions (file_id, version_number, file_path)
        VALUES ($1, $2, $3)
    `, fileID, versionNum, path)
	return err
}

// GetLatestVersionNumber retrieves the highest version_number for a given file_id.
func (app *App) GetLatestVersionNumber(fileID int) (int, error) {
	var maxVer int
	err := app.DB.QueryRow(`
        SELECT COALESCE(MAX(version_number), 0)
        FROM file_versions
        WHERE file_id = $1
    `, fileID).Scan(&maxVer)
	return maxVer, err
}

// GetFileIDByPath returns the files.id for a given file_path.
func (app *App) GetFileIDByPath(path string) (int, error) {
	var id int
	err := app.DB.QueryRow(`
        SELECT id
        FROM files
        WHERE file_path = $1
    `, path).Scan(&id)
	return id, err
}

// DeleteFileVersions removes all version records for a given file ID.
func (app *App) DeleteFileVersions(fileID int) error {
	_, err := app.DB.Exec(`
        DELETE FROM file_versions
        WHERE file_id = $1
    `, fileID)
	return err
}
func (app *App) GetFileRecordByPath(filePath string) (FileRecord, error) {
	var fr FileRecord
	err := app.DB.QueryRow(`
        SELECT id, file_name, file_path, size, content_type, uploader
        FROM files
        WHERE file_path = $1
    `, filePath).Scan(
		&fr.ID,
		&fr.FileName,
		&fr.FilePath,
		&fr.Size,
		&fr.ContentType,
		&fr.Uploader,
	)
	return fr, err
}
func (app *App) UpdateFileMetadata(fileID int, newSize int64, newContentType string) error {
	_, err := app.DB.Exec(`
        UPDATE files
        SET size = $1,
            content_type = $2
        WHERE id = $3
    `, newSize, newContentType, fileID)
	return err
}

// DeleteFileVersionsInFolder removes file_versions rows for all files whose
// file_path starts with the given folderPath prefix.
func (app *App) DeleteFileVersionsInFolder(folderPath string) error {
	// Step 1: Gather all file IDs in that folder (including subfolders).
	rows, err := app.DB.Query(`
        SELECT id
        FROM files
        WHERE file_path = $1
           OR file_path LIKE $1 || '/%'
    `, folderPath)
	if err != nil {
		return err
	}
	defer rows.Close()

	var fileIDs []int
	for rows.Next() {
		var fid int
		if err := rows.Scan(&fid); err != nil {
			return err
		}
		fileIDs = append(fileIDs, fid)
	}

	// Step 2: For each file ID, delete any version rows in file_versions.
	for _, fid := range fileIDs {
		if _, err := app.DB.Exec(`DELETE FROM file_versions WHERE file_id = $1`, fid); err != nil {
			return err
		}
	}
	return nil
}

func (app *App) ListFileAuditLogs() ([]AuditLog, error) {
	rows, err := app.DB.Query(`
		SELECT 
			id, 
			user_username,
			username_at_action,   -- <-- NEW
			file_id, 
			action, 
			details, 
			created_at
		FROM audit_logs
		ORDER BY created_at DESC
	`)
	if err != nil {
		log.Println("Error querying audit logs:", err)
		return nil, err
	}
	defer rows.Close()

	var logs []AuditLog

	for rows.Next() {
		var (
			auditLog         AuditLog
			userUsername     sql.NullString
			usernameAtAction sql.NullString
			fileID           sql.NullInt64
		)

		if err := rows.Scan(
			&auditLog.ID,
			&userUsername,
			&usernameAtAction, // read the snapshot
			&fileID,
			&auditLog.Action,
			&auditLog.Details,
			&auditLog.CreatedAt,
		); err != nil {
			log.Println("Error scanning audit log row:", err)
			return nil, err
		}

		if userUsername.Valid {
			auditLog.UserUsername = &userUsername.String
		}
		if usernameAtAction.Valid {
			auditLog.UsernameAtAction = &usernameAtAction.String
		}
		if fileID.Valid {
			val := int(fileID.Int64)
			auditLog.FileID = &val
		}

		logs = append(logs, auditLog)
	}

	if err := rows.Err(); err != nil {
		log.Println("Row iteration error:", err)
		return nil, err
	}

	return logs, nil
}

func (app *App) LogAudit(username string, fileID int, action, details string) {
	var nullableFileID sql.NullInt64
	if fileID > 0 {
		nullableFileID = sql.NullInt64{Int64: int64(fileID), Valid: true}
	} else {
		nullableFileID = sql.NullInt64{Valid: false}
	}

	_, err := app.DB.Exec(`
		INSERT INTO audit_logs (user_username, username_at_action, file_id, action, details)
		VALUES ($1, $2, $3, $4, $5)
	`,
		username,       // user_username
		username,       // username_at_action (the snapshot)
		nullableFileID, // file_id
		action,
		details,
	)

	if err != nil {
		log.Printf("SQL Error in LogAudit: %v", err)
	} else {
		log.Println("Audit log inserted successfully!")
	}
}

func (app *App) ListAllFiles() ([]FileRecord, error) {
	rows, err := app.DB.Query("SELECT file_name, size, content_type, uploader FROM files")
	if err != nil {
		log.Println("Error fetching all files:", err)
		return nil, err
	}
	defer rows.Close()

	var files []FileRecord
	for rows.Next() {
		var file FileRecord
		if err := rows.Scan(&file.FileName, &file.Size, &file.ContentType, &file.Uploader); err != nil {
			log.Println("Error scanning file row:", err)
			return nil, err
		}
		files = append(files, file)
	}
	return files, nil
}

// GetFileRecordByID retrieves a file record by its ID.
func (app *App) GetFileRecordByID(fileID int) (FileRecord, error) {
	query := "SELECT id, file_name, directory, file_path, size, content_type, uploader, FROM files WHERE id = $1"
	log.Printf("Executing query: %s with fileID: %d", query, fileID)
	row := app.DB.QueryRow(query, fileID)

	var fr FileRecord
	err := row.Scan(&fr.ID, &fr.FileName, &fr.Directory, &fr.FilePath, &fr.Size, &fr.ContentType, &fr.Uploader)
	if err != nil {
		log.Printf("Error scanning file record for id %d: %v", fileID, err)
	} else {
		log.Printf("Successfully retrieved file record: %+v", fr)
	}
	return fr, err
}
func AddFileToArchive(archive *zip.Writer, filePath, nameInZip string) error {
	fileToZip, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer fileToZip.Close()

	// Get file info for header.
	info, err := fileToZip.Stat()
	if err != nil {
		return err
	}

	header, err := zip.FileInfoHeader(info)
	if err != nil {
		return err
	}
	// Use the provided name instead of the full path.
	header.Name = nameInZip
	header.Method = zip.Deflate

	writer, err := archive.CreateHeader(header)
	if err != nil {
		return err
	}

	_, err = io.Copy(writer, fileToZip)
	return err
}

// GetFirstAdmin returns the first admin (oldest by creation time).
func (app *App) GetFirstAdmin() (User, error) {
	row := app.DB.QueryRow(`
        SELECT username, created_at
        FROM users
        WHERE role = 'admin'
        ORDER BY created_at ASC
        LIMIT 1
    `)
	var user User
	err := row.Scan(&user.Username, &user.CreatedAt)
	return user, err
}

// IsUserAdmin checks if a user is an admin.
func (app *App) IsUserAdmin(username string) (bool, error) {
	var role string
	err := app.DB.QueryRow(`
        SELECT role 
        FROM users 
        WHERE username = $1
    `, username).Scan(&role)
	if err != nil {
		return false, err
	}
	return role == "admin", nil
}

// RevokeAdmin sets a user's role to 'user'.
func (app *App) RevokeAdmin(username string) error {
	_, err := app.DB.Exec(`
        UPDATE users 
        SET role = 'user', updated_at = CURRENT_TIMESTAMP 
        WHERE username = $1
    `, username)
	return err
}
func (app *App) DeleteFileRecordByPath(filePath string) (int, error) {
	var fileID int
	err := app.DB.QueryRow("SELECT id FROM files WHERE file_path = $1", filePath).Scan(&fileID)
	if err != nil {
		log.Printf("Error retrieving file ID for path '%s': %v", filePath, err)
		return 0, err
	}

	_, err = app.DB.Exec("DELETE FROM files WHERE file_path = $1", filePath)
	if err != nil {
		log.Printf("Error deleting file with path '%s': %v", filePath, err)
		return 0, err
	}

	return fileID, nil
}
