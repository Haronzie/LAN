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

// User represents an application user (no email field).
type User struct {
	Username  string    `json:"username"`
	Password  string    `json:"password"`
	Role      string    `json:"role"`
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// FileRecord represents a file stored in the system.
type FileRecord struct {
	FileName    string `json:"file_name"`
	FilePath    string `json:"file_path"` // New field to store the file's relative path
	Size        int64  `json:"size"`
	ContentType string `json:"content_type"`
	Uploader    string `json:"uploader"`
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

// GetUserByUsername retrieves a user by username from the database (no email column).
func (app *App) GetUserByUsername(username string) (User, error) {
	row := app.DB.QueryRow(`
        SELECT username, password, role, active, created_at, updated_at
        FROM users
        WHERE username = $1
    `, username)

	var user User
	err := row.Scan(
		&user.Username,
		&user.Password,
		&user.Role,
		&user.Active,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	return user, err
}

// CreateUser inserts a new user into the database (no email column).
func (app *App) CreateUser(user User) error {
	_, err := app.DB.Exec(`
        INSERT INTO users(username, password, role, active)
        VALUES($1, $2, $3, $4)
    `,
		user.Username,
		user.Password,
		user.Role,
		user.Active,
	)
	return err
}

// ListUsers returns all users from the database (no email column).
func (app *App) ListUsers() ([]User, error) {
	rows, err := app.DB.Query(`
        SELECT username, password, role, active, created_at, updated_at
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
			&u.Active,
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

// UpdateUserProfile updates only the username (no email).
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
        INSERT INTO files(file_name, file_path, size, content_type, uploader) 
        VALUES($1, $2, $3, $4, $5)
    `,
		fr.FileName, fr.FilePath, fr.Size, fr.ContentType, fr.Uploader)
	return err
}

func (app *App) GetFileRecord(fileName string) (FileRecord, error) {
	row := app.DB.QueryRow(`
        SELECT file_name, file_path, size, content_type, uploader
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
        VALUES($1, $2, $3, CURRENT_TIMESTAMP)
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
func (app *App) ListDirectory(directory string) ([]map[string]interface{}, error) {
	// Return an empty list or implement your logic (DB queries, file system, etc.).
	return []map[string]interface{}{}, nil
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
