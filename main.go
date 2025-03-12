package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gorilla/sessions"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

// App holds shared resources.
type App struct {
	DB              *sql.DB
	Store           *sessions.CookieStore
	FileCache       map[string]FileRecord
	FileShareTokens map[string]string // token -> file name mapping
}

// generateToken creates a random token.
func generateToken() (string, error) {
	b := make([]byte, 16) // 16 bytes = 128 bits
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// respondJSON sends a JSON response.
func respondJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(payload)
}

// respondError sends a JSON error response.
func respondError(w http.ResponseWriter, code int, message string) {
	respondJSON(w, code, map[string]string{"error": message})
}

// sanitizeName cleans file/directory names to avoid path traversal.
func sanitizeName(name string) string {
	// filepath.Base strips directory components.
	return filepath.Base(name)
}

// --- Data Structures ---

type User struct {
	Username  string    `json:"username"`
	Password  string    `json:"password"`
	Role      string    `json:"role"` // "admin" or "user"
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type FileRecord struct {
	FileName    string `json:"file_name"`
	Size        int64  `json:"size"`         // in bytes
	ContentType string `json:"content_type"` // MIME type
	Uploader    string `json:"uploader"`     // username
}

// Request structs

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

// --- Helper Functions for Passwords ---

func hashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hashed), err
}

func checkPasswordHash(password, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// --- Database & Session Operations ---

// createTables creates users, files, and directories tables.
func (a *App) createTables() {
	// Users table with created_at and updated_at.
	userTable := `
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
	_, err := a.DB.Exec(userTable)
	if err != nil {
		log.Fatal("Error creating users table:", err)
	}
	_, err = a.DB.Exec("CREATE INDEX IF NOT EXISTS idx_users_role_active ON users (role, active)")
	if err != nil {
		log.Fatal("Error creating index on users table:", err)
	}

	// Files table.
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
	_, err = a.DB.Exec("CREATE INDEX IF NOT EXISTS idx_files_filename ON files (file_name)")
	if err != nil {
		log.Fatal("Error creating index on files table:", err)
	}

	// Directories table.
	directoryTable := `
    CREATE TABLE IF NOT EXISTS directories (
        directory_name TEXT PRIMARY KEY,
        parent_directory TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
	_, err = a.DB.Exec(directoryTable)
	if err != nil {
		log.Fatal("Error creating directories table:", err)
	}
}
func (a *App) adminExistsHandler(w http.ResponseWriter, r *http.Request) {
	var exists bool
	err := a.DB.QueryRow("SELECT EXISTS (SELECT 1 FROM users WHERE role = 'admin')").Scan(&exists)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Database error")
		return
	}
	respondJSON(w, http.StatusOK, map[string]bool{"exists": exists})
}

// getUserFromSession retrieves the current user.
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

// getUserByUsername retrieves a user from the DB.
func (a *App) getUserByUsername(username string) (User, error) {
	row := a.DB.QueryRow("SELECT username, password, role, active, created_at, updated_at FROM users WHERE username = $1", username)
	var user User
	err := row.Scan(&user.Username, &user.Password, &user.Role, &user.Active, &user.CreatedAt, &user.UpdatedAt)
	return user, err
}

// createUser inserts a new user.
func (a *App) createUser(user User) error {
	_, err := a.DB.Exec("INSERT INTO users(username, password, role) VALUES($1, $2, $3)", user.Username, user.Password, user.Role)
	return err
}

// updateUser updates a user and refreshes updated_at.
func (a *App) updateUser(user User) error {
	_, err := a.DB.Exec("UPDATE users SET password = $1, role = $2, updated_at = CURRENT_TIMESTAMP WHERE username = $3", user.Password, user.Role, user.Username)
	return err
}

// deleteUser removes a user.
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

// --- File Operations ---

func (a *App) getFileRecord(fileName string) (FileRecord, error) {
	row := a.DB.QueryRow("SELECT file_name, size, content_type, uploader FROM files WHERE file_name = $1", fileName)
	var fr FileRecord
	err := row.Scan(&fr.FileName, &fr.Size, &fr.ContentType, &fr.Uploader)
	return fr, err
}

// cacheFileRecord adds or updates a file record in the cache.
func (a *App) cacheFileRecord(fr FileRecord) {
	a.FileCache[fr.FileName] = fr
}

// deleteFileRecord removes a file record from both the cache and the database.
func (a *App) deleteFileRecord(fileName string) error {
	delete(a.FileCache, fileName)
	_, err := a.DB.Exec("DELETE FROM files WHERE file_name = $1", fileName)
	return err
}

// --- Endpoints ---

// registerHandler handles user registration.
func (a *App) registerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)
	if req.Username == "" || req.Password == "" {
		respondError(w, http.StatusBadRequest, "Username and password cannot be empty")
		return
	}
	// Check if user already exists.
	if _, err := a.getUserByUsername(req.Username); err == nil {
		respondError(w, http.StatusBadRequest, "User already exists")
		return
	}
	// Allow first user to be admin; if an admin exists, registration is closed.
	if a.adminExists() {
		respondError(w, http.StatusForbidden, "Admin already registered. Registration closed.")
		return
	}
	hashedPass, err := hashPassword(req.Password)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Error hashing password")
		return
	}
	newUser := User{
		Username: req.Username,
		Password: hashedPass,
		Role:     "admin",
		Active:   true,
	}
	if err := a.createUser(newUser); err != nil {
		respondError(w, http.StatusInternalServerError, "Error creating user")
		return
	}
	// Set session using Gorilla sessions.
	session, err := a.Store.Get(r, "session")
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Error getting session")
		return
	}
	session.Values["username"] = req.Username
	if err := session.Save(r, w); err != nil {
		respondError(w, http.StatusInternalServerError, "Error saving session")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": fmt.Sprintf("Admin '%s' registered successfully", req.Username)})
}

func (a *App) loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)
	user, err := a.getUserByUsername(req.Username)
	if err != nil || !checkPasswordHash(req.Password, user.Password) {
		respondJSON(w, http.StatusUnauthorized, map[string]string{"message": "Invalid username or password"})
		return
	}
	// Update user active status.
	_, err = a.DB.Exec("UPDATE users SET active = $1 WHERE username = $2", true, user.Username)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Error updating user status")
		return
	}
	session, err := a.Store.Get(r, "session")
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Error getting session")
		return
	}
	session.Values["username"] = req.Username
	if err := session.Save(r, w); err != nil {
		respondError(w, http.StatusInternalServerError, "Error saving session")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{
		"message":  "Login successful",
		"username": user.Username,
		"role":     user.Role,
	})
}

func (a *App) logoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}
	// Mark user inactive.
	user, err := a.getUserFromSession(r)
	if err == nil && user.Username != "" {
		_, updateErr := a.DB.Exec("UPDATE users SET active = $1 WHERE username = $2", false, user.Username)
		if updateErr != nil {
			respondError(w, http.StatusInternalServerError, "Error updating user status")
			return
		}
	}
	session, err := a.Store.Get(r, "session")
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Error retrieving session")
		return
	}
	session.Options.MaxAge = -1
	if err := session.Save(r, w); err != nil {
		respondError(w, http.StatusInternalServerError, "Error saving session")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": "Logout successful"})
}

func (a *App) forgotPasswordHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Invalid request method"})
		return
	}
	var req struct {
		Username    string `json:"username"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request body"})
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.NewPassword = strings.TrimSpace(req.NewPassword)
	if req.Username == "" || req.NewPassword == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"message": "Username and new password cannot be empty"})
		return
	}
	userRecord, err := a.getUserByUsername(req.Username)
	if err != nil {
		respondJSON(w, http.StatusNotFound, map[string]string{"message": "Username not found"})
		return
	}
	hashedPass, err := hashPassword(req.NewPassword)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"message": "Error hashing password"})
		return
	}
	userRecord.Password = hashedPass
	if err := a.updateUser(userRecord); err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"message": "Error updating password"})
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": "Password has been reset successfully. Please login with your new password."})
}

// adminExists checks if any admin exists in the users table.
func (a *App) adminExists() bool {
	row := a.DB.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'")
	var count int
	if err := row.Scan(&count); err != nil {
		return false
	}
	return count > 0
}

// createFileRecord creates a new file record in the database.
func (a *App) createFileRecord(fr FileRecord) error {
	_, err := a.DB.Exec("INSERT INTO files(file_name, size, content_type, uploader) VALUES($1, $2, $3, $4)",
		fr.FileName, fr.Size, fr.ContentType, fr.Uploader)
	return err
}

func (a *App) uploadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}
	currentUser, err := a.getUserFromSession(r)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	err = r.ParseMultipartForm(10 << 20) // 10 MB limit
	if err != nil {
		respondError(w, http.StatusBadRequest, "Error parsing form data")
		return
	}
	file, handler, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "Error retrieving the file")
		return
	}
	defer file.Close()

	var msg string
	// Check if the file record exists.
	if _, err := a.getFileRecord(handler.Filename); err == nil {
		msg = fmt.Sprintf("File '%s' overwritten successfully", handler.Filename)
	} else {
		fr := FileRecord{
			FileName:    handler.Filename,
			Size:        handler.Size,
			ContentType: handler.Header.Get("Content-Type"),
			Uploader:    currentUser.Username,
		}
		if err := a.createFileRecord(fr); err != nil {
			respondError(w, http.StatusInternalServerError, "Error saving file record")
			return
		}
		a.cacheFileRecord(fr)
		msg = fmt.Sprintf("File '%s' uploaded successfully", handler.Filename)
	}

	dstPath := filepath.Join("uploads", handler.Filename)
	dst, err := os.Create(dstPath)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Error saving file")
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, file); err != nil {
		respondError(w, http.StatusInternalServerError, "Error saving file")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": msg})
}

func (a *App) filesHandler(w http.ResponseWriter, r *http.Request) {
	_, err := a.getUserFromSession(r)
	if err != nil {
		respondError(w, http.StatusForbidden, "Forbidden")
		return
	}
	rows, err := a.DB.Query("SELECT file_name, size, content_type, uploader FROM files")
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Error retrieving files")
		return
	}
	defer rows.Close()
	var files []FileRecord
	for rows.Next() {
		var fr FileRecord
		if err := rows.Scan(&fr.FileName, &fr.Size, &fr.ContentType, &fr.Uploader); err != nil {
			respondError(w, http.StatusInternalServerError, "Error scanning file record")
			return
		}
		files = append(files, fr)
	}
	respondJSON(w, http.StatusOK, files)
}

func (a *App) downloadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}
	_, err := a.getUserFromSession(r)
	if err != nil {
		respondError(w, http.StatusForbidden, "Forbidden")
		return
	}
	fileName := r.URL.Query().Get("filename")
	if fileName == "" {
		respondError(w, http.StatusBadRequest, "Filename is required")
		return
	}
	fr, err := a.getFileRecord(fileName)
	if err != nil {
		respondError(w, http.StatusNotFound, "File not found")
		return
	}
	filePath := filepath.Join("uploads", fileName)
	f, err := os.Open(filePath)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Error opening file")
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", fr.ContentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fr.FileName))
	if _, err := io.Copy(w, f); err != nil {
		log.Println("Error sending file:", err)
	}
}

// createResourceHandler creates files or directories.
func (a *App) createResourceHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}
	user, _ := a.getUserFromSession(r) // Optional: handle error if needed

	var req struct {
		ResourceType string `json:"resource_type"` // "file" or "directory"
		Name         string `json:"name"`
		Content      string `json:"content"` // optional for files
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Name = sanitizeName(strings.TrimSpace(req.Name))
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "Name cannot be empty")
		return
	}

	basePath := "uploads"
	resourcePath := filepath.Join(basePath, req.Name)

	switch req.ResourceType {
	case "file":
		file, err := os.Create(resourcePath)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Error creating file")
			return
		}
		defer file.Close()
		if req.Content != "" {
			if _, err := file.WriteString(req.Content); err != nil {
				respondError(w, http.StatusInternalServerError, "Error writing to file")
				return
			}
		}
		respondJSON(w, http.StatusOK, map[string]string{"message": "File created successfully"})
	case "directory":
		err := os.Mkdir(resourcePath, 0755)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Error creating directory")
			return
		}
		if user.Username == "" {
			respondError(w, http.StatusForbidden, "Authentication required to create directory")
			return
		}
		_, err = a.DB.Exec("INSERT INTO directories (directory_name, created_by) VALUES ($1, $2)", req.Name, user.Username)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Error saving directory record")
			return
		}
		respondJSON(w, http.StatusOK, map[string]string{"message": "Directory created successfully"})
	default:
		respondError(w, http.StatusBadRequest, "Invalid resource type")
	}
}

// deleteResourceHandler deletes files or directories.
func (a *App) deleteResourceHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		respondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}
	user, err := a.getUserFromSession(r)
	if err != nil {
		respondError(w, http.StatusForbidden, "Forbidden")
		return
	}
	var req struct {
		ResourceType string `json:"resource_type"` // "file" or "directory"
		Name         string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Name = sanitizeName(strings.TrimSpace(req.Name))
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "Name cannot be empty")
		return
	}

	basePath := "uploads"
	resourcePath := filepath.Join(basePath, req.Name)

	switch req.ResourceType {
	case "file":
		fr, err := a.getFileRecord(req.Name)
		if err != nil {
			respondError(w, http.StatusNotFound, "File does not exist")
			return
		}
		if user.Role != "admin" && fr.Uploader != user.Username {
			respondError(w, http.StatusForbidden, "Forbidden: You can only delete files you uploaded")
			return
		}
		if err := os.Remove(resourcePath); err != nil {
			respondError(w, http.StatusInternalServerError, "Error deleting file")
			return
		}
		if err := a.deleteFileRecord(req.Name); err != nil {
			respondError(w, http.StatusInternalServerError, "Error deleting file record")
			return
		}
		respondJSON(w, http.StatusOK, map[string]string{"message": fmt.Sprintf("File '%s' deleted successfully", req.Name)})
	case "directory":
		if err := os.RemoveAll(resourcePath); err != nil {
			respondError(w, http.StatusInternalServerError, "Error deleting directory")
			return
		}
		// Optionally remove directory metadata from DB.
		respondJSON(w, http.StatusOK, map[string]string{"message": fmt.Sprintf("Directory '%s' deleted successfully", req.Name)})
	default:
		respondError(w, http.StatusBadRequest, "Invalid resource type")
	}
}

// moveResourceHandler moves (renames) files or directories.
func (a *App) moveResourceHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		respondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}
	user, err := a.getUserFromSession(r)
	if err != nil {
		respondError(w, http.StatusForbidden, "Forbidden")
		return
	}
	var req struct {
		ResourceType string `json:"resource_type"` // "file" or "directory"
		OldName      string `json:"old_name"`
		NewName      string `json:"new_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.OldName = sanitizeName(strings.TrimSpace(req.OldName))
	req.NewName = sanitizeName(strings.TrimSpace(req.NewName))
	if req.OldName == "" || req.NewName == "" {
		respondError(w, http.StatusBadRequest, "OldName and NewName cannot be empty")
		return
	}
	basePath := "uploads"
	oldPath := filepath.Join(basePath, req.OldName)
	newPath := filepath.Join(basePath, req.NewName)
	switch req.ResourceType {
	case "file":
		fr, err := a.getFileRecord(req.OldName)
		if err != nil {
			respondError(w, http.StatusNotFound, "File does not exist")
			return
		}
		if user.Role != "admin" && fr.Uploader != user.Username {
			respondError(w, http.StatusForbidden, "Forbidden: You can only move files you uploaded")
			return
		}
		if err := os.Rename(oldPath, newPath); err != nil {
			respondError(w, http.StatusInternalServerError, "Error moving file")
			return
		}
		_, err = a.DB.Exec("UPDATE files SET file_name = $1 WHERE file_name = $2", req.NewName, req.OldName)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Error updating file record")
			return
		}
		delete(a.FileCache, req.OldName)
		respondJSON(w, http.StatusOK, map[string]string{"message": fmt.Sprintf("File moved from '%s' to '%s' successfully", req.OldName, req.NewName)})
	case "directory":
		if err := os.Rename(oldPath, newPath); err != nil {
			respondError(w, http.StatusInternalServerError, "Error moving directory")
			return
		}
		// Optionally update directory metadata in DB.
		respondJSON(w, http.StatusOK, map[string]string{"message": fmt.Sprintf("Directory moved from '%s' to '%s' successfully", req.OldName, req.NewName)})
	default:
		respondError(w, http.StatusBadRequest, "Invalid resource type")
		return
	}
}

// shareFileHandler creates a shareable link for a file.
func (a *App) shareFileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}
	user, err := a.getUserFromSession(r)
	if err != nil {
		respondError(w, http.StatusForbidden, "Forbidden")
		return
	}
	var req struct {
		FileName string `json:"file_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.FileName = sanitizeName(strings.TrimSpace(req.FileName))
	if req.FileName == "" {
		respondError(w, http.StatusBadRequest, "File name cannot be empty")
		return
	}
	fr, err := a.getFileRecord(req.FileName)
	if err != nil {
		respondError(w, http.StatusNotFound, "File does not exist")
		return
	}
	if user.Role != "admin" && fr.Uploader != user.Username {
		respondError(w, http.StatusForbidden, "Forbidden: You can only share files you uploaded")
		return
	}
	token, err := generateToken()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Error generating share token")
		return
	}
	if a.FileShareTokens == nil {
		a.FileShareTokens = make(map[string]string)
	}
	a.FileShareTokens[token] = req.FileName
	shareURL := fmt.Sprintf("http://%s/download-share?token=%s", r.Host, token)
	respondJSON(w, http.StatusOK, map[string]string{"share_url": shareURL})
}

// downloadShareHandler serves a file via a share token.
func (a *App) downloadShareHandler(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		respondError(w, http.StatusBadRequest, "Missing token")
		return
	}
	fileName, exists := a.FileShareTokens[token]
	if !exists {
		respondError(w, http.StatusBadRequest, "Invalid or expired token")
		return
	}
	fr, err := a.getFileRecord(fileName)
	if err != nil {
		respondError(w, http.StatusNotFound, "File not found")
		return
	}
	filePath := filepath.Join("uploads", fileName)
	f, err := os.Open(filePath)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Error opening file")
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", fr.ContentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileName))
	if _, err := io.Copy(w, f); err != nil {
		log.Println("Error sending file:", err)
	}
}

// --- Admin & User Endpoints ---

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
		respondError(w, http.StatusForbidden, "Forbidden")
		return
	}
	rows, err := a.DB.Query(`
  SELECT username, role, active 
  FROM users 
  ORDER BY 
    CASE WHEN role = 'admin' THEN 0 ELSE 1 END, 
    username ASC`)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Error retrieving users")
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
			respondError(w, http.StatusInternalServerError, "Error scanning user")
			return
		}
		userList = append(userList, u)
	}
	respondJSON(w, http.StatusOK, userList)
}

func (a *App) addUserHandler(w http.ResponseWriter, r *http.Request) {
	user, err := a.getUserFromSession(r)
	if err != nil || user.Role != "admin" {
		respondError(w, http.StatusForbidden, "Forbidden")
		return
	}
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}
	var req AddUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)
	if req.Username == "" || req.Password == "" {
		respondError(w, http.StatusBadRequest, "Username and password cannot be empty")
		return
	}
	if _, err := a.getUserByUsername(req.Username); err == nil {
		respondError(w, http.StatusBadRequest, "User already exists")
		return
	}
	hashedPass, err := hashPassword(req.Password)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Error hashing password")
		return
	}
	newUser := User{
		Username: req.Username,
		Password: hashedPass,
		Role:     "user",
	}
	if err := a.createUser(newUser); err != nil {
		respondError(w, http.StatusInternalServerError, "Error adding user")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": fmt.Sprintf("User '%s' has been added successfully", req.Username)})
}

func (a *App) updateUserHandler(w http.ResponseWriter, r *http.Request) {
	user, err := a.getUserFromSession(r)
	if err != nil || user.Role != "admin" {
		respondError(w, http.StatusForbidden, "Forbidden")
		return
	}
	if r.Method != http.MethodPut {
		respondError(w, http.StatusMethodNotAllowed, "Invalid request method. Use PUT.")
		return
	}
	var req UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.OldUsername = strings.TrimSpace(req.OldUsername)
	req.NewUsername = strings.TrimSpace(req.NewUsername)
	req.NewPassword = strings.TrimSpace(req.NewPassword)
	if req.OldUsername == "" || req.NewUsername == "" || req.NewPassword == "" {
		respondError(w, http.StatusBadRequest, "Old username, new username, and new password are required")
		return
	}
	userRecord, err := a.getUserByUsername(req.OldUsername)
	if err != nil {
		respondError(w, http.StatusNotFound, "User does not exist")
		return
	}
	if req.OldUsername != req.NewUsername {
		if _, err := a.getUserByUsername(req.NewUsername); err == nil {
			respondError(w, http.StatusBadRequest, "New username already taken")
			return
		}
	}
	userRecord.Username = req.NewUsername
	hashedPass, err := hashPassword(req.NewPassword)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Error hashing password")
		return
	}
	userRecord.Password = hashedPass
	if err := a.deleteUser(req.OldUsername); err != nil {
		respondError(w, http.StatusInternalServerError, "Error updating user")
		return
	}
	if err := a.createUser(userRecord); err != nil {
		respondError(w, http.StatusInternalServerError, "Error updating user")
		return
	}
	// Update file records if username has changed.
	if req.OldUsername != req.NewUsername {
		_, err = a.DB.Exec("UPDATE files SET uploader = $1 WHERE uploader = $2", req.NewUsername, req.OldUsername)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Error updating file records")
			return
		}
	}
	// Invalidate session if needed.
	if req.OldUsername == user.Username {
		session, err := a.Store.Get(r, "session")
		if err == nil {
			session.Options.MaxAge = -1
			session.Save(r, w)
		}
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": fmt.Sprintf("User '%s' has been updated to '%s' with new password", req.OldUsername, req.NewUsername)})
}

func (a *App) deleteUserHandler(w http.ResponseWriter, r *http.Request) {
	user, err := a.getUserFromSession(r)
	if err != nil || user.Role != "admin" {
		respondError(w, http.StatusForbidden, "Forbidden")
		return
	}
	if r.Method != http.MethodDelete {
		respondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}
	var req DeleteUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" {
		respondError(w, http.StatusBadRequest, "Username cannot be empty")
		return
	}
	if err := a.deleteUser(req.Username); err != nil {
		respondError(w, http.StatusNotFound, "User does not exist or error deleting user")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": fmt.Sprintf("User '%s' has been deleted successfully", req.Username)})
}

func (a *App) assignAdminHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}
	user, err := a.getUserFromSession(r)
	if err != nil || user.Role != "admin" {
		respondError(w, http.StatusForbidden, "Forbidden: Only an admin can assign a new admin")
		return
	}
	var req AssignAdminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" {
		respondError(w, http.StatusBadRequest, "Username cannot be empty")
		return
	}
	userRecord, err := a.getUserByUsername(req.Username)
	if err != nil {
		respondError(w, http.StatusNotFound, "User does not exist")
		return
	}
	if userRecord.Role == "admin" {
		respondError(w, http.StatusBadRequest, "User is already an admin")
		return
	}
	userRecord.Role = "admin"
	if err := a.updateUser(userRecord); err != nil {
		respondError(w, http.StatusInternalServerError, "Error updating user role")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": fmt.Sprintf("User '%s' is now an admin", req.Username)})
}

func (a *App) adminStatusHandler(w http.ResponseWriter, r *http.Request) {
	exists := false
	row := a.DB.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'")
	var count int
	if err := row.Scan(&count); err == nil {
		exists = count > 0
	}
	respondJSON(w, http.StatusOK, map[string]bool{"adminExists": exists})
}

func (a *App) updateUserStatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		respondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}
	var req UpdateUserStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" {
		respondError(w, http.StatusBadRequest, "Username cannot be empty")
		return
	}
	_, err := a.DB.Exec("UPDATE users SET active = $1 WHERE username = $2", req.Active, req.Username)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Error updating user status")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": fmt.Sprintf("User '%s' status updated successfully", req.Username)})
}

// --- CORS Middleware ---
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

// --- Main Function ---
func main() {
	// Load configuration from environment variables.
	connStr := os.Getenv("DB_CONN") // e.g., "host=localhost port=5432 user=postgres password=haron dbname=Cdrrmo sslmode=disable"
	if connStr == "" {
		log.Fatal("DB_CONN not set")
	}
	secretKey := os.Getenv("SESSION_SECRET")
	if secretKey == "" {
		log.Fatal("SESSION_SECRET not set")
	}

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Database connection error:", err)
	}
	defer db.Close()
	if err = db.Ping(); err != nil {
		log.Fatal("Database ping error:", err)
	}
	log.Println("Database connected successfully")

	// Ensure uploads folder exists.
	if _, err := os.Stat("uploads"); os.IsNotExist(err) {
		err := os.Mkdir("uploads", 0755)
		if err != nil {
			log.Fatal("Failed to create uploads folder:", err)
		}
	}

	app := &App{
		DB:        db,
		Store:     sessions.NewCookieStore([]byte(secretKey)),
		FileCache: make(map[string]FileRecord),
	}

	app.createTables()

	mux := http.NewServeMux()
	// User endpoints.
	mux.HandleFunc("/register", app.registerHandler)
	mux.HandleFunc("/login", app.loginHandler)
	mux.HandleFunc("/logout", app.logoutHandler)
	mux.HandleFunc("/forgot-password", app.forgotPasswordHandler)
	// File endpoints.
	mux.HandleFunc("/upload", app.uploadHandler)
	mux.HandleFunc("/files", app.filesHandler)
	mux.HandleFunc("/download", app.downloadHandler)
	mux.HandleFunc("/create-resource", app.createResourceHandler)
	mux.HandleFunc("/delete-resource", app.deleteResourceHandler)
	mux.HandleFunc("/move-resource", app.moveResourceHandler)
	mux.HandleFunc("/share-file", app.shareFileHandler)
	mux.HandleFunc("/download-share", app.downloadShareHandler)
	// Admin endpoints.
	mux.HandleFunc("/admin", app.adminHandler)
	mux.HandleFunc("/user", app.userHandler)
	mux.HandleFunc("/users", app.usersHandler)
	mux.HandleFunc("/add-user", app.addUserHandler)
	mux.HandleFunc("/update-user", app.updateUserHandler)
	mux.HandleFunc("/delete-user", app.deleteUserHandler)
	mux.HandleFunc("/assign-admin", app.assignAdminHandler)
	mux.HandleFunc("/admin-status", app.adminStatusHandler)
	mux.HandleFunc("/update-user-status", app.updateUserStatusHandler)
	mux.HandleFunc("/admin-exists", app.adminExistsHandler)

	handler := enableCORS(mux)
	log.Println("Starting HTTP server on port 9090...")
	if err := http.ListenAndServe(":9090", handler); err != nil {
		log.Fatal("HTTP server error:", err)
	}
}
