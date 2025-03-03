package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"

	_ "github.com/lib/pq"

	// ADDED for bcrypt:
	"golang.org/x/crypto/bcrypt"
)

// ADDED for bcrypt: Helper functions to hash and compare passwords.
func hashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashed), nil
}

func checkPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// User represents a registered user.
type User struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"` // "admin" or "user"
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

type LoginResponse struct {
	Token string `json:"token"`
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

type ForgotPasswordRequest struct {
	NewPassword string `json:"new_password"`
}

type DeleteFileRequest struct {
	FileName string `json:"file_name"`
}

type AssignAdminRequest struct {
	Username string `json:"username"`
}

var db *sql.DB

func main() {
	// PostgreSQL connection string.
	connStr := "host=localhost port=5432 user=postgres password=haron dbname=Cdrrmo sslmode=disable"
	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Database connection error:", err)
	}
	defer db.Close()

	// Ping the database to check the connection.
	if err = db.Ping(); err != nil {
		log.Fatal("Database ping error:", err)
	}
	log.Println("Database connected successfully")

	// Create necessary tables if they don't exist.
	createTables()

	// Set up HTTP handlers.
	mux := http.NewServeMux()
	mux.HandleFunc("/register", registerHandler)
	mux.HandleFunc("/login", loginHandler)
	mux.HandleFunc("/forgot-password", forgotPasswordHandler)
	mux.HandleFunc("/upload", uploadHandler)
	mux.HandleFunc("/delete-file", deleteFileHandler)
	mux.HandleFunc("/files", filesHandler)
	mux.HandleFunc("/download", downloadHandler)
	mux.HandleFunc("/admin", adminHandler)
	mux.HandleFunc("/users", usersHandler)
	mux.HandleFunc("/add-user", addUserHandler)
	mux.HandleFunc("/update-user", updateUserHandler)
	mux.HandleFunc("/delete-user", deleteUserHandler)
	mux.HandleFunc("/user", userHandler)
	mux.HandleFunc("/assign-admin", assignAdminHandler)
	mux.HandleFunc("/admin-status", adminStatusHandler)

	handler := enableCORS(mux)

	// Start HTTP redirect server on port 80.
	go func() {
		httpServer := &http.Server{
			Addr: ":80",
			Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				target := "https://" + r.Host + r.RequestURI
				http.Redirect(w, r, target, http.StatusMovedPermanently)
			}),
		}
		log.Println("Starting HTTP redirect server on port 80...")
		if err := httpServer.ListenAndServe(); err != nil {
			log.Fatal("HTTP redirect server error:", err)
		}
	}()

	// Start HTTPS server.
	log.Println("Starting HTTPS server on port 443...")
	err = http.ListenAndServeTLS(":443", "server.crt", "server.key", handler)
	if err != nil {
		log.Fatal("HTTPS server error:", err)
	}
}

// createTables creates the users and files tables if they don't exist.
func createTables() {
	userTable := `
	CREATE TABLE IF NOT EXISTS users (
		username TEXT PRIMARY KEY,
		password TEXT NOT NULL,
		role TEXT NOT NULL
	);`
	_, err := db.Exec(userTable)
	if err != nil {
		log.Fatal("Error creating users table:", err)
	}

	fileTable := `
	CREATE TABLE IF NOT EXISTS files (
		file_name TEXT PRIMARY KEY,
		size BIGINT,
		content_type TEXT,
		uploader TEXT
	);`
	_, err = db.Exec(fileTable)
	if err != nil {
		log.Fatal("Error creating files table:", err)
	}
}

// generateToken creates a dummy token for the given username.
func generateToken(username string) string {
	return "Bearer " + username + "-token"
}

// getUsernameFromToken extracts the username from our dummy token.
func getUsernameFromToken(token string) (string, error) {
	if !strings.HasPrefix(token, "Bearer ") {
		return "", errors.New("invalid token")
	}
	token = strings.TrimPrefix(token, "Bearer ")
	if !strings.HasSuffix(token, "-token") {
		return "", errors.New("invalid token")
	}
	username := strings.TrimSuffix(token, "-token")
	return username, nil
}

// getUserByUsername retrieves a user from the database.
func getUserByUsername(username string) (User, error) {
	row := db.QueryRow("SELECT username, password, role FROM users WHERE username = $1", username)
	var user User
	err := row.Scan(&user.Username, &user.Password, &user.Role)
	return user, err
}

// createUser inserts a new user into the database.
func createUser(user User) error {
	_, err := db.Exec("INSERT INTO users(username, password, role) VALUES($1, $2, $3)", user.Username, user.Password, user.Role)
	return err
}

// updateUser updates an existing user in the database.
func updateUser(user User) error {
	_, err := db.Exec("UPDATE users SET password = $1, role = $2 WHERE username = $3", user.Password, user.Role, user.Username)
	return err
}

// deleteUser removes a user from the database.
func deleteUser(username string) error {
	_, err := db.Exec("DELETE FROM users WHERE username = $1", username)
	return err
}

// getUserByToken retrieves a user using the token.
func getUserByToken(token string) (User, error) {
	username, err := getUsernameFromToken(token)
	if err != nil {
		return User{}, err
	}
	return getUserByUsername(username)
}

// adminExists checks if any admin exists in the database.
func adminExists() bool {
	row := db.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'")
	var count int
	if err := row.Scan(&count); err != nil {
		return false
	}
	return count > 0
}

// isValidAdminToken checks if the token belongs to an admin.
func isValidAdminToken(token string) bool {
	user, err := getUserByToken(token)
	return err == nil && user.Role == "admin"
}

// isValidUserToken checks if the token belongs to a regular user.
func isValidUserToken(token string) bool {
	user, err := getUserByToken(token)
	return err == nil && user.Role == "user"
}

// File-related DB functions.
func getFileRecord(fileName string) (FileRecord, error) {
	row := db.QueryRow("SELECT file_name, size, content_type, uploader FROM files WHERE file_name = $1", fileName)
	var fr FileRecord
	err := row.Scan(&fr.FileName, &fr.Size, &fr.ContentType, &fr.Uploader)
	return fr, err
}

func createFileRecord(fr FileRecord) error {
	_, err := db.Exec("INSERT INTO files(file_name, size, content_type, uploader) VALUES($1, $2, $3, $4)", fr.FileName, fr.Size, fr.ContentType, fr.Uploader)
	return err
}

func deleteFileRecord(fileName string) error {
	_, err := db.Exec("DELETE FROM files WHERE file_name = $1", fileName)
	return err
}

func getAllFiles() ([]FileRecord, error) {
	rows, err := db.Query("SELECT file_name, size, content_type, uploader FROM files")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var files []FileRecord
	for rows.Next() {
		var fr FileRecord
		if err := rows.Scan(&fr.FileName, &fr.Size, &fr.ContentType, &fr.Uploader); err != nil {
			return nil, err
		}
		files = append(files, fr)
	}
	return files, nil
}

// Handlers

func registerHandler(w http.ResponseWriter, r *http.Request) {
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
	if _, err := getUserByUsername(req.Username); err == nil {
		http.Error(w, "User already exists", http.StatusBadRequest)
		return
	}
	// Allow first user to become admin; if an admin exists, registration is closed.
	if adminExists() {
		http.Error(w, "Admin already registered. Registration closed.", http.StatusForbidden)
		return
	}

	// ADDED for bcrypt: Hash the incoming password before storing.
	hashedPass, err := hashPassword(req.Password)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}

	newUser := User{
		Username: req.Username,
		Password: hashedPass, // store hashed password
		Role:     "admin",
	}
	if err := createUser(newUser); err != nil {
		http.Error(w, "Error creating user", http.StatusInternalServerError)
		return
	}
	token := generateToken(req.Username)
	// Respond with token.
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("Admin '%s' registered successfully", req.Username),
		"token":   token,
	})
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
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
	user, err := getUserByUsername(req.Username)

	// ADDED for bcrypt: Compare hashed password in DB with incoming password.
	if err != nil || !checkPasswordHash(req.Password, user.Password) {
		http.Error(w, "Invalid username or password", http.StatusUnauthorized)
		return
	}

	token := generateToken(req.Username)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(LoginResponse{Token: token})
}

func forgotPasswordHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	token := r.Header.Get("Authorization")
	if !isValidAdminToken(token) {
		http.Error(w, "Forbidden: Only admin can use forgot password", http.StatusForbidden)
		return
	}
	var req ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	req.NewPassword = strings.TrimSpace(req.NewPassword)
	if req.NewPassword == "" {
		http.Error(w, "New password cannot be empty", http.StatusBadRequest)
		return
	}
	adminUser, err := getUserByToken(token)
	if err != nil || adminUser.Role != "admin" {
		http.Error(w, "Admin user not found", http.StatusNotFound)
		return
	}

	// ADDED for bcrypt: Hash the new admin password before storing.
	hashedPass, err := hashPassword(req.NewPassword)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}
	adminUser.Password = hashedPass

	if err := updateUser(adminUser); err != nil {
		http.Error(w, "Error updating password", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Admin password has been reset successfully. Please login with your new password.",
	})
}

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	token := r.Header.Get("Authorization")
	if !(isValidAdminToken(token) || isValidUserToken(token)) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	currentUser, err := getUserByToken(token)
	if err != nil {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}
	err = r.ParseMultipartForm(10 << 20) // 10 MB memory limit
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
	// Check if file already exists.
	if _, err := getFileRecord(handler.Filename); err == nil {
		http.Error(w, "File already exists", http.StatusBadRequest)
		return
	}
	fr := FileRecord{
		FileName:    handler.Filename,
		Size:        handler.Size,
		ContentType: handler.Header.Get("Content-Type"),
		Uploader:    currentUser.Username,
	}
	if err := createFileRecord(fr); err != nil {
		http.Error(w, "Error saving file record", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("File '%s' uploaded successfully", handler.Filename),
	})
}

func deleteFileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	token := r.Header.Get("Authorization")
	user, err := getUserByToken(token)
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
	fr, err := getFileRecord(req.FileName)
	if err != nil {
		http.Error(w, "File does not exist", http.StatusNotFound)
		return
	}
	// Only admin or the uploader can delete.
	if user.Role != "admin" && fr.Uploader != user.Username {
		http.Error(w, "Forbidden: You can only delete files you uploaded", http.StatusForbidden)
		return
	}
	if err := deleteFileRecord(req.FileName); err != nil {
		http.Error(w, "Error deleting file record", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("File '%s' has been deleted successfully", req.FileName),
	})
}

func filesHandler(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	if !(isValidAdminToken(token) || isValidUserToken(token)) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	files, err := getAllFiles()
	if err != nil {
		http.Error(w, "Error retrieving files", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

func downloadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	token := r.Header.Get("Authorization")
	if !(isValidAdminToken(token) || isValidUserToken(token)) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	fileName := r.URL.Query().Get("filename")
	if fileName == "" {
		http.Error(w, "Filename is required", http.StatusBadRequest)
		return
	}
	fr, err := getFileRecord(fileName)
	if err != nil {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", fr.ContentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fr.FileName))
	dummyContent := fmt.Sprintf("This is dummy content for file %s", fr.FileName)
	w.Write([]byte(dummyContent))
}

func adminHandler(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	if !isValidAdminToken(token) {
		http.NotFound(w, r)
		return
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprintln(w, "Welcome admin")
}

func userHandler(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	if !isValidUserToken(token) {
		http.NotFound(w, r)
		return
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprintln(w, "Welcome user")
}

func usersHandler(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	if !isValidAdminToken(token) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	rows, err := db.Query("SELECT username FROM users")
	if err != nil {
		http.Error(w, "Error retrieving users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var userList []string
	for rows.Next() {
		var username string
		if err := rows.Scan(&username); err != nil {
			http.Error(w, "Error scanning user", http.StatusInternalServerError)
			return
		}
		userList = append(userList, username)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(userList)
}

func addUserHandler(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	if !isValidAdminToken(token) {
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
	// Check if user exists.
	if _, err := getUserByUsername(req.Username); err == nil {
		http.Error(w, "User already exists", http.StatusBadRequest)
		return
	}

	// ADDED for bcrypt: Hash the new user's password before storing.
	hashedPass, err := hashPassword(req.Password)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}

	newUser := User{
		Username: req.Username,
		Password: hashedPass, // store hashed password
		Role:     "user",
	}
	if err := createUser(newUser); err != nil {
		http.Error(w, "Error adding user", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("User '%s' has been added successfully", req.Username),
	})
}

func updateUserHandler(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	if !isValidAdminToken(token) {
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
	user, err := getUserByUsername(req.OldUsername)
	if err != nil {
		http.Error(w, "User does not exist", http.StatusNotFound)
		return
	}
	// Check if new username is already taken (if changed).
	if req.OldUsername != req.NewUsername {
		if _, err := getUserByUsername(req.NewUsername); err == nil {
			http.Error(w, "New username already taken", http.StatusBadRequest)
			return
		}
	}
	// Update user info.
	user.Username = req.NewUsername

	// ADDED for bcrypt: Hash the updated password.
	hashedPass, err := hashPassword(req.NewPassword)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}
	user.Password = hashedPass

	// Remove old record and update with new info.
	if err := deleteUser(req.OldUsername); err != nil {
		http.Error(w, "Error updating user", http.StatusInternalServerError)
		return
	}
	if err := createUser(user); err != nil {
		http.Error(w, "Error updating user", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("User '%s' has been updated to '%s' with new password", req.OldUsername, req.NewUsername),
	})
}

func adminStatusHandler(w http.ResponseWriter, r *http.Request) {
	exists := adminExists()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"adminExists": exists})
}

func deleteUserHandler(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	if !isValidAdminToken(token) {
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
	if err := deleteUser(req.Username); err != nil {
		http.Error(w, "User does not exist or error deleting user", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("User '%s' has been deleted successfully", req.Username),
	})
}

func assignAdminHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	token := r.Header.Get("Authorization")
	if !isValidAdminToken(token) {
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
	user, err := getUserByUsername(req.Username)
	if err != nil {
		http.Error(w, "User does not exist", http.StatusNotFound)
		return
	}
	if user.Role == "admin" {
		http.Error(w, "User is already an admin", http.StatusBadRequest)
		return
	}
	user.Role = "admin"
	if err := updateUser(user); err != nil {
		http.Error(w, "Error updating user role", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("User '%s' is now an admin", req.Username),
	})
}

// enableCORS sets CORS headers.
func enableCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			return
		}
		h.ServeHTTP(w, r)
	})
}
