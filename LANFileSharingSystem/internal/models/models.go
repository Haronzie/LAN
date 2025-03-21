package models

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/sessions"
	"golang.org/x/crypto/bcrypt"
)

// App holds shared resources across the application.
type App struct {
	DB              *sql.DB
	Store           *sessions.CookieStore
	FileCache       map[string]FileRecord
	FileShareTokens map[string]string // token -> file name mapping
}

// NewApp creates a new App instance.
func NewApp(db *sql.DB, store *sessions.CookieStore) *App {
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

// FileRecord represents a file stored in the system.
type FileRecord struct {
	ID           int    `json:"id"`
	FileName     string `json:"file_name"`
	Directory    string `json:"directory"` // <-- New field
	FilePath     string `json:"file_path"`
	Size         int64  `json:"size"`
	ContentType  string `json:"content_type"`
	Uploader     string `json:"uploader"`
	Confidential bool   `json:"confidential"`
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
		return User{}, errors.New("user not logged in")
	}
	return app.GetUserByUsername(username)
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

func (app *App) CreateFileRecord(fr FileRecord) error {
	_, err := app.DB.Exec(`
		INSERT INTO files (file_name, directory, file_path, size, content_type, uploader, confidential)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`,
		fr.FileName,
		fr.Directory, // must match your new schema
		fr.FilePath,
		fr.Size,
		fr.ContentType,
		fr.Uploader,
		fr.Confidential,
	)
	return err
}

func (app *App) GetFileRecord(fileName string) (FileRecord, error) {
	row := app.DB.QueryRow(`
        SELECT file_name, file_path, size, content_type, uploader, confidential
        FROM files
        WHERE file_name = $1
    `, fileName)

	var fr FileRecord
	err := row.Scan(
		&fr.FileName,
		&fr.FilePath,
		&fr.Size,
		&fr.ContentType,
		&fr.Uploader,
		&fr.Confidential,
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
            SELECT file_name, file_path, size, content_type, uploader
            FROM files
            WHERE file_path NOT LIKE '%/%'
        `)
	} else {
		// Only immediate children of dir (e.g. "Operation/file.jpg"),
		// not subfolders (e.g. "Operation/Report/file.jpg").
		rows, err = app.DB.Query(`
            SELECT file_name, file_path, size, content_type, uploader
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
		if err := rows.Scan(&f.FileName, &f.FilePath, &f.Size, &f.ContentType, &f.Uploader); err != nil {
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
        WHERE directory_name = $1 AND parent_directory = $2
    `
	err := app.DB.QueryRow(query, name, parent).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
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

func (app *App) DeleteFileRecord(fileName string) error {
	_, err := app.DB.Exec("DELETE FROM files WHERE file_name = $1", fileName)
	return err
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
