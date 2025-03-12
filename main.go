package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gorilla/sessions"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

// App is the main application "class" that holds shared resources.
type App struct {
	DB        *sql.DB
	Store     *sessions.CookieStore
	FileCache map[string]FileRecord
}

// User represents a registered user.
type User struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"` // "admin" or "user"
	Active   bool   `json:"active"`
}

// FileRecord represents a stored file with metadata.
type FileRecord struct {
	FileName    string `json:"file_name"`
	Size        int64  `json:"size"`         // Size in bytes
	ContentType string `json:"content_type"` // MIME type of the file
	Uploader    string `json:"uploader"`     // Username of who uploaded the file
}

// Request/Response structs.
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

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
type UpdateUserStatusRequest struct {
	Username string `json:"username"`
	Active   bool   `json:"active"`
}

type ForgotPasswordRequest struct {
	NewPassword string `json:"new_password"`
}

type DeleteFileRequest struct {
	FileName string `json:"file_name"`
}

type AssignAdminRequest struct {
	Username string `json:"username"`
}

// ----- Helper Functions -----

// hashPassword returns the bcrypt hash of the password.
func hashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashed), nil
}

// checkPasswordHash compares a bcrypt hashed password with its possible plaintext equivalent.
func checkPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// ----- App Methods for DB and Session Operations -----

// createTables creates the users and files tables if they don't exist.
func (a *App) createTables() {
	// Create the users table with active defaulting to false.
	userTable := `
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT FALSE
    );`
	_, err := a.DB.Exec(userTable)
	if err != nil {
		log.Fatal("Error creating users table:", err)
	}

	// Create an index on the users table for role and active status.
	_, err = a.DB.Exec("CREATE INDEX IF NOT EXISTS idx_users_role_active ON users (role, active)")
	if err != nil {
		log.Fatal("Error creating index on users table:", err)
	}

	// Create the files table.
	fileTable := `
    CREATE TABLE IF NOT EXISTS files (
        file_name TEXT PRIMARY KEY,
        size BIGINT,
        content_type TEXT,
        uploader TEXT
    );`
	_, err = a.DB.Exec(fileTable)
	if err != nil {
		log.Fatal("Error creating files table:", err)
	}

	// Create an index on the files table for the file_name column.
	_, err = a.DB.Exec("CREATE INDEX IF NOT EXISTS idx_files_filename ON files (file_name)")
	if err != nil {
		log.Fatal("Error creating index on files table:", err)
	}
}

// getUserByUsername retrieves a user from the database.
func (a *App) getUserByUsername(username string) (User, error) {
	row := a.DB.QueryRow("SELECT username, password, role, active FROM users WHERE username = $1", username)
	var user User
	err := row.Scan(&user.Username, &user.Password, &user.Role, &user.Active)

	return user, err
}

// createUser inserts a new user into the database.
func (a *App) createUser(user User) error {
	_, err := a.DB.Exec("INSERT INTO users(username, password, role) VALUES($1, $2, $3)", user.Username, user.Password, user.Role)
	return err
}

// updateUser updates an existing user in the database.
func (a *App) updateUser(user User) error {
	_, err := a.DB.Exec("UPDATE users SET password = $1, role = $2 WHERE username = $3", user.Password, user.Role, user.Username)
	return err
}

// deleteUser removes a user from the database.
func (a *App) deleteUser(username string) error {
	res, err := a.DB.Exec("DELETE FROM users WHERE username = $1", username)
	if err != nil {
		return err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return errors.New("user does not exist")
	}
	return nil
}

// adminExists checks if any admin exists in the database.
func (a *App) adminExists() bool {
	row := a.DB.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'")
	var count int
	if err := row.Scan(&count); err != nil {
		return false
	}
	return count > 0
}

// getUserFromSession retrieves the current user from the Gorilla session.
func (a *App) getUserFromSession(r *http.Request) (User, error) {
	session, err := a.Store.Get(r, "session")
	if err != nil {
		return User{}, err
	}
	username, ok := session.Values["username"].(string)
	if !ok || username == "" {
		return User{}, errors.New("session not found or username not set")
	}
	return a.getUserByUsername(username)
}

// ----- App Methods for File Operations -----

// getFileRecord retrieves a file record from the database.
// getFileRecordWithCache checks the in-memory cache first; if the file record is not found, it queries the database and stores the result in the cache.
func (a *App) getFileRecordWithCache(fileName string) (FileRecord, error) {
	// Check the cache first
	if fr, exists := a.getCachedFileRecord(fileName); exists {
		return fr, nil
	}
	// If not in cache, query the database
	fr, err := a.getFileRecord(fileName)
	if err != nil {
		return fr, err
	}
	// Cache the result for future requests
	a.cacheFileRecord(fr)
	return fr, nil
}
func (a *App) getFileRecord(fileName string) (FileRecord, error) {
	row := a.DB.QueryRow("SELECT file_name, size, content_type, uploader FROM files WHERE file_name = $1", fileName)
	var fr FileRecord
	err := row.Scan(&fr.FileName, &fr.Size, &fr.ContentType, &fr.Uploader)
	return fr, err
}

// createFileRecord creates a new file record in the database.
func (a *App) createFileRecord(fr FileRecord) error {
	_, err := a.DB.Exec("INSERT INTO files(file_name, size, content_type, uploader) VALUES($1, $2, $3, $4)", fr.FileName, fr.Size, fr.ContentType, fr.Uploader)
	return err
}

// deleteFileRecord removes a file record from both the cache and the database.
func (a *App) deleteFileRecord(fileName string) error {
	delete(a.FileCache, fileName)
	_, err := a.DB.Exec("DELETE FROM files WHERE file_name = $1", fileName)
	return err
}

// getAllFiles returns all file records from the database.
func (a *App) getAllFiles() ([]FileRecord, error) {
	rows, err := a.DB.Query("SELECT file_name, size, content_type, uploader FROM files")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	files := []FileRecord{} // Initialized as an empty slice.
	for rows.Next() {
		var fr FileRecord
		if err := rows.Scan(&fr.FileName, &fr.Size, &fr.ContentType, &fr.Uploader); err != nil {
			return nil, err
		}
		files = append(files, fr)
	}
	return files, nil
}

// getCachedFileRecord retrieves a file record from the cache.
func (a *App) getCachedFileRecord(fileName string) (FileRecord, bool) {
	fr, exists := a.FileCache[fileName]
	return fr, exists
}

// cacheFileRecord adds or updates a file record in the cache.
func (a *App) cacheFileRecord(fr FileRecord) {
	a.FileCache[fr.FileName] = fr
}

// ----- HTTP Handlers as App Methods -----

func (a *App) registerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)
	if req.Username == "" || req.Password == "" {
		http.Error(w, "Username and password cannot be empty", http.StatusBadRequest)
		return
	}
	// Check if user already exists.
	if _, err := a.getUserByUsername(req.Username); err == nil {
		http.Error(w, "User already exists", http.StatusBadRequest)
		return
	}
	// Allow first user to become admin; if an admin exists, registration is closed.
	if a.adminExists() {
		http.Error(w, "Admin already registered. Registration closed.", http.StatusForbidden)
		return
	}

	hashedPass, err := hashPassword(req.Password)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}

	newUser := User{
		Username: req.Username,
		Password: hashedPass,
		Role:     "admin",
		Active:   true,
	}
	if err := a.createUser(newUser); err != nil {
		http.Error(w, "Error creating user", http.StatusInternalServerError)
		return
	}

	// Set session value using Gorilla sessions.
	session, err := a.Store.Get(r, "session")
	if err != nil {
		http.Error(w, "Error getting session", http.StatusInternalServerError)
		return
	}
	session.Values["username"] = req.Username
	if err := session.Save(r, w); err != nil {
		http.Error(w, "Error saving session", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("Admin '%s' registered successfully", req.Username),
	})
}
func (a *App) updateUserStatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	var req UpdateUserStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" {
		http.Error(w, "Username cannot be empty", http.StatusBadRequest)
		return
	}
	// Update the user's active status in the database.
	_, err := a.DB.Exec("UPDATE users SET active = $1 WHERE username = $2", req.Active, req.Username)
	if err != nil {
		http.Error(w, "Error updating user status", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("User '%s' status updated successfully", req.Username),
	})
}

func (a *App) loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)
	user, err := a.getUserByUsername(req.Username)
	if err != nil || !checkPasswordHash(req.Password, user.Password) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Invalid username or password",
		})
		return
	}

	// Update the user's active status in the database
	_, err = a.DB.Exec("UPDATE users SET active = $1 WHERE username = $2", true, user.Username)
	if err != nil {
		http.Error(w, "Error updating user status", http.StatusInternalServerError)
		return
	}

	session, err := a.Store.Get(r, "session")
	if err != nil {
		http.Error(w, "Error getting session", http.StatusInternalServerError)
		return
	}
	session.Values["username"] = req.Username
	if err := session.Save(r, w); err != nil {
		http.Error(w, "Error saving session", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message":  "Login successful",
		"username": user.Username,
		"role":     user.Role,
	})
}

func (a *App) logoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Retrieve the user from the session and mark them inactive.
	user, err := a.getUserFromSession(r)
	if err == nil && user.Username != "" {
		_, updateErr := a.DB.Exec("UPDATE users SET active = $1 WHERE username = $2", false, user.Username)
		if updateErr != nil {
			http.Error(w, "Error updating user status", http.StatusInternalServerError)
			return
		}
	}

	// Clear the session.
	session, err := a.Store.Get(r, "session")
	if err != nil {
		http.Error(w, "Error retrieving session", http.StatusInternalServerError)
		return
	}
	session.Options.MaxAge = -1
	if err := session.Save(r, w); err != nil {
		http.Error(w, "Error saving session", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Logout successful"})
}

func (a *App) forgotPasswordHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid request method"})
		return
	}

	// Decode the request body into a struct with username & new_password
	var req struct {
		Username    string `json:"username"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid request body"})
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.NewPassword = strings.TrimSpace(req.NewPassword)
	if req.Username == "" || req.NewPassword == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Username and new password cannot be empty"})
		return
	}

	// Attempt to retrieve the user by username
	userRecord, err := a.getUserByUsername(req.Username)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"message": "Username not found"})
		return
	}

	// Hash the new password
	hashedPass, err := hashPassword(req.NewPassword)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Error hashing password"})
		return
	}

	// Update the user record with the new password
	userRecord.Password = hashedPass
	if err := a.updateUser(userRecord); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"message": "Error updating password"})
		return
	}

	// Return success
	log.Println("Reached forgotPasswordHandler success block")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Password has been reset successfully. Please login with your new password.",
	})
}

func (a *App) uploadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	currentUser, err := a.getUserFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	err = r.ParseMultipartForm(10 << 20)
	if err != nil {
		http.Error(w, "Error parsing form data", http.StatusBadRequest)
		return
	}
	file, handler, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Error retrieving the file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	var msg string
	// Check if the file record already exists.
	if _, err := a.getFileRecord(handler.Filename); err == nil {
		// File exists: allow overwriting.
		msg = fmt.Sprintf("File '%s' overwritten successfully", handler.Filename)
		// Optionally, update the record in the database if necessary.
	} else {
		// File does not exist: create new file record.
		fr := FileRecord{
			FileName:    handler.Filename,
			Size:        handler.Size,
			ContentType: handler.Header.Get("Content-Type"),
			Uploader:    currentUser.Username,
		}
		if err := a.createFileRecord(fr); err != nil {
			http.Error(w, "Error saving file record", http.StatusInternalServerError)
			return
		}
		a.cacheFileRecord(fr)
		msg = fmt.Sprintf("File '%s' uploaded successfully", handler.Filename)
	}

	// Save (or overwrite) the file on disk in the "uploads" folder.
	dstPath := filepath.Join("uploads", handler.Filename)
	dst, err := os.Create(dstPath)
	if err != nil {
		http.Error(w, "Error saving file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "Error saving file", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": msg,
	})
}

func (a *App) deleteFileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	user, err := a.getUserFromSession(r)
	if err != nil {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	var req DeleteFileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	req.FileName = strings.TrimSpace(req.FileName)
	if req.FileName == "" {
		http.Error(w, "File name cannot be empty", http.StatusBadRequest)
		return
	}
	fr, err := a.getFileRecord(req.FileName)
	if err != nil {
		http.Error(w, "File does not exist", http.StatusNotFound)
		return
	}
	if user.Role != "admin" && fr.Uploader != user.Username {
		http.Error(w, "Forbidden: You can only delete files you uploaded", http.StatusForbidden)
		return
	}
	if err := a.deleteFileRecord(req.FileName); err != nil {
		http.Error(w, "Error deleting file record", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("File '%s' has been deleted successfully", req.FileName),
	})
}

func (a *App) filesHandler(w http.ResponseWriter, r *http.Request) {
	_, err := a.getUserFromSession(r)
	if err != nil {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	files, err := a.getAllFiles()
	if err != nil {
		http.Error(w, "Error retrieving files", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

func (a *App) downloadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	// Check if user is authenticated.
	_, err := a.getUserFromSession(r)
	if err != nil {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	fileName := r.URL.Query().Get("filename")
	if fileName == "" {
		http.Error(w, "Filename is required", http.StatusBadRequest)
		return
	}
	// Retrieve file record using the cache
	fr, err := a.getFileRecordWithCache(fileName)
	if err != nil {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}
	// Build the full file path from the "uploads" folder.
	filePath := filepath.Join("uploads", fileName)
	f, err := os.Open(filePath)
	if err != nil {
		http.Error(w, "Error opening file", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	// Set headers to prompt a file download in the browser.
	w.Header().Set("Content-Type", fr.ContentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fr.FileName))

	// Stream the file to the response.
	if _, err := io.Copy(w, f); err != nil {
		log.Println("Error sending file:", err)
	}
}

func (a *App) adminHandler(w http.ResponseWriter, r *http.Request) {
	user, err := a.getUserFromSession(r)
	if err != nil || user.Role != "admin" {
		http.NotFound(w, r)
		return
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprintln(w, "Welcome admin")
}

func (a *App) userHandler(w http.ResponseWriter, r *http.Request) {
	user, err := a.getUserFromSession(r)
	if err != nil || user.Role != "user" {
		http.NotFound(w, r)
		return
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprintln(w, "Welcome user")
}

func (a *App) usersHandler(w http.ResponseWriter, r *http.Request) {
	user, err := a.getUserFromSession(r)
	if err != nil || user.Role != "admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	rows, err := a.DB.Query(`
  SELECT username, role, active
  FROM users
  ORDER BY
    CASE WHEN role = 'admin' THEN 0 ELSE 1 END,
    username ASC
`)

	if err != nil {
		http.Error(w, "Error retrieving users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type UserWithRoleAndStatus struct {
		Username string `json:"username"`
		Role     string `json:"role"`
		Active   bool   `json:"active"`
	}

	var userList []UserWithRoleAndStatus
	for rows.Next() {
		var u UserWithRoleAndStatus
		if err := rows.Scan(&u.Username, &u.Role, &u.Active); err != nil {
			http.Error(w, "Error scanning user", http.StatusInternalServerError)
			return
		}
		userList = append(userList, u)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(userList)
}

func (a *App) addUserHandler(w http.ResponseWriter, r *http.Request) {
	user, err := a.getUserFromSession(r)
	if err != nil || user.Role != "admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	var req AddUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)
	if req.Username == "" || req.Password == "" {
		http.Error(w, "Username and password cannot be empty", http.StatusBadRequest)
		return
	}
	if _, err := a.getUserByUsername(req.Username); err == nil {
		http.Error(w, "User already exists", http.StatusBadRequest)
		return
	}
	hashedPass, err := hashPassword(req.Password)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}
	// Create new user. We don't set the active field here so that it defaults to false in the DB.
	newUser := User{
		Username: req.Username,
		Password: hashedPass,
		Role:     "user",
	}
	if err := a.createUser(newUser); err != nil {
		http.Error(w, "Error adding user", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("User '%s' has been added successfully", req.Username),
	})
}

func (a *App) updateUserHandler(w http.ResponseWriter, r *http.Request) {
	user, err := a.getUserFromSession(r)
	if err != nil || user.Role != "admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	if r.Method != http.MethodPut {
		http.Error(w, "Invalid request method. Use PUT.", http.StatusMethodNotAllowed)
		return
	}
	var req UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	req.OldUsername = strings.TrimSpace(req.OldUsername)
	req.NewUsername = strings.TrimSpace(req.NewUsername)
	req.NewPassword = strings.TrimSpace(req.NewPassword)
	if req.OldUsername == "" || req.NewUsername == "" || req.NewPassword == "" {
		http.Error(w, "Old username, new username, and new password are required", http.StatusBadRequest)
		return
	}
	userRecord, err := a.getUserByUsername(req.OldUsername)
	if err != nil {
		http.Error(w, "User does not exist", http.StatusNotFound)
		return
	}
	if req.OldUsername != req.NewUsername {
		if _, err := a.getUserByUsername(req.NewUsername); err == nil {
			http.Error(w, "New username already taken", http.StatusBadRequest)
			return
		}
	}
	userRecord.Username = req.NewUsername
	hashedPass, err := hashPassword(req.NewPassword)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}
	userRecord.Password = hashedPass
	if err := a.deleteUser(req.OldUsername); err != nil {
		http.Error(w, "Error updating user", http.StatusInternalServerError)
		return
	}
	if err := a.createUser(userRecord); err != nil {
		http.Error(w, "Error updating user", http.StatusInternalServerError)
		return
	}
	// Update file records if the username has changed
	if req.OldUsername != req.NewUsername {
		_, err = a.DB.Exec("UPDATE files SET uploader = $1 WHERE uploader = $2", req.NewUsername, req.OldUsername)
		if err != nil {
			http.Error(w, "Error updating file records", http.StatusInternalServerError)
			return
		}
	}
	if req.OldUsername == user.Username {
		session, err := a.Store.Get(r, "session")
		if err == nil {
			session.Options.MaxAge = -1 // Invalidate session
			session.Save(r, w)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("User '%s' has been updated to '%s' with new password", req.OldUsername, req.NewUsername),
	})
}

func (a *App) deleteUserHandler(w http.ResponseWriter, r *http.Request) {
	user, err := a.getUserFromSession(r)
	if err != nil || user.Role != "admin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	if r.Method != http.MethodDelete {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	var req DeleteUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" {
		http.Error(w, "Username cannot be empty", http.StatusBadRequest)
		return
	}
	if err := a.deleteUser(req.Username); err != nil {
		http.Error(w, "User does not exist or error deleting user", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("User '%s' has been deleted successfully", req.Username),
	})
}

func (a *App) assignAdminHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	user, err := a.getUserFromSession(r)
	if err != nil || user.Role != "admin" {
		http.Error(w, "Forbidden: Only an admin can assign a new admin", http.StatusForbidden)
		return
	}
	var req AssignAdminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" {
		http.Error(w, "Username cannot be empty", http.StatusBadRequest)
		return
	}
	userRecord, err := a.getUserByUsername(req.Username)
	if err != nil {
		http.Error(w, "User does not exist", http.StatusNotFound)
		return
	}
	if userRecord.Role == "admin" {
		http.Error(w, "User is already an admin", http.StatusBadRequest)
		return
	}
	userRecord.Role = "admin"
	if err := a.updateUser(userRecord); err != nil {
		http.Error(w, "Error updating user role", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("User '%s' is now an admin", req.Username),
	})
}

func (a *App) adminStatusHandler(w http.ResponseWriter, r *http.Request) {
	exists := a.adminExists()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"adminExists": exists})
}

// enableCORS sets CORS headers.
func enableCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			return
		}
		h.ServeHTTP(w, r)
	})
}

// ----- Main Function -----

func main() {
	// Connect to PostgreSQL.
	connStr := "host=localhost port=5432 user=postgres password=haron dbname=Cdrrmo sslmode=disable"
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Database connection error:", err)
	}
	defer db.Close()
	if err = db.Ping(); err != nil {
		log.Fatal("Database ping error:", err)
	}
	log.Println("Database connected successfully")

	if _, err := os.Stat("uploads"); os.IsNotExist(err) {
		err := os.Mkdir("uploads", 0755)
		if err != nil {
			log.Fatal("Failed to create uploads folder:", err)
		}
	}

	// Create an instance of App.
	app := &App{
		DB:        db,
		Store:     sessions.NewCookieStore([]byte("super-secret-key")),
		FileCache: make(map[string]FileRecord),
	}
	app.createTables()

	// Set up HTTP routes.
	mux := http.NewServeMux()
	mux.HandleFunc("/register", app.registerHandler)
	mux.HandleFunc("/login", app.loginHandler)
	mux.HandleFunc("/logout", app.logoutHandler)
	mux.HandleFunc("/forgot-password", app.forgotPasswordHandler)
	mux.HandleFunc("/upload", app.uploadHandler)
	mux.HandleFunc("/delete-file", app.deleteFileHandler)
	mux.HandleFunc("/files", app.filesHandler)
	mux.HandleFunc("/download", app.downloadHandler)
	mux.HandleFunc("/admin", app.adminHandler)
	mux.HandleFunc("/user", app.userHandler)
	mux.HandleFunc("/users", app.usersHandler)
	mux.HandleFunc("/add-user", app.addUserHandler)
	mux.HandleFunc("/update-user", app.updateUserHandler)
	mux.HandleFunc("/delete-user", app.deleteUserHandler)
	mux.HandleFunc("/assign-admin", app.assignAdminHandler)
	mux.HandleFunc("/admin-status", app.adminStatusHandler)
	mux.HandleFunc("/update-user-status", app.updateUserStatusHandler)

	handler := enableCORS(mux)
	// Start HTTP redirect server on port 80.
	// go func() {
	// 	httpServer := &http.Server{
	// 		Addr: ":80",
	// 		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	// 			target := "https://" + r.Host + r.RequestURI
	// 			http.Redirect(w, r, target, http.StatusMovedPermanently)
	// 		}),
	// 	}
	// 	log.Println("Starting HTTP redirect server on port 80...")
	// 	if err := httpServer.ListenAndServe(); err != nil {
	// 		log.Fatal("HTTP redirect server error:", err)
	// 	}
	// }()

	// // Start HTTPS server.
	// log.Println("Starting HTTPS server on port 443...")
	// err = http.ListenAndServeTLS(":443", "server.crt", "server.key", handler)
	// if err != nil {
	// 	log.Fatal("HTTPS server error:", err)
	// }
	log.Println("Starting HTTP server on port 8080...")
	err = http.ListenAndServe(":8080", handler)
	if err != nil {
		log.Fatal("HTTP server error:", err)
	}
}

//nge
