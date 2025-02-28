package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
)

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

// Global maps for users, tokens, and files.
var users = map[string]User{}
var tokens = map[string]string{}
var files = map[string]FileRecord{}

// Structs for various API requests/responses.
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

// ForgotPasswordRequest represents the JSON structure for resetting the admin's password.
type ForgotPasswordRequest struct {
	NewPassword string `json:"new_password"`
}

// DeleteFileRequest represents the JSON structure for deleting a file.
type DeleteFileRequest struct {
	FileName string `json:"file_name"`
}

// AssignAdminRequest is used for promoting a user to admin.
type AssignAdminRequest struct {
	Username string `json:"username"`
}

func main() {
	// Public endpoints.
	http.HandleFunc("/register", registerHandler)
	http.HandleFunc("/login", loginHandler)
	// Secured endpoints.
	http.HandleFunc("/forgot-password", forgotPasswordHandler)
	http.HandleFunc("/upload", uploadHandler)
	http.HandleFunc("/delete-file", deleteFileHandler)
	http.HandleFunc("/files", filesHandler)       // Lists all stored file records.
	http.HandleFunc("/download", downloadHandler) // Download endpoint.
	// Admin-only endpoints.
	http.HandleFunc("/admin", adminHandler)
	http.HandleFunc("/users", usersHandler)            // List all users (admin only).
	http.HandleFunc("/add-user", addUserHandler)       // Admin can add a new user.
	http.HandleFunc("/update-user", updateUserHandler) // Now uses PUT
	http.HandleFunc("/delete-user", deleteUserHandler) // Admin can delete a user.
	// A user-specific endpoint.
	http.HandleFunc("/user", userHandler)
	// New endpoint: Only an admin can promote an existing user to admin.
	http.HandleFunc("/assign-admin", assignAdminHandler)
	http.HandleFunc("/admin-status", adminStatusHandler)

	fmt.Println("Server listening on port 8080...")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

// registerHandler registers a new user. If no admin exists yet, the first registered user becomes the admin.
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
	if _, exists := users[req.Username]; exists {
		http.Error(w, "User already exists", http.StatusBadRequest)
		return
	}
	// Allow first user to become admin; if an admin already exists, registration is closed.
	for _, user := range users {
		if user.Role == "admin" {
			http.Error(w, "Admin already registered. Registration closed.", http.StatusForbidden)
			return
		}
	}
	newUser := User{
		Username: req.Username,
		Password: req.Password,
		Role:     "admin",
	}
	users[req.Username] = newUser
	token := "Bearer " + req.Username + "-token"
	tokens[req.Username] = token
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("Admin '%s' registered successfully", req.Username),
		"token":   token,
	})
}

// loginHandler authenticates users and returns their token.
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
	user, exists := users[req.Username]
	if !exists || user.Password != req.Password {
		http.Error(w, "Invalid username or password", http.StatusUnauthorized)
		return
	}
	token := tokens[req.Username]
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(LoginResponse{Token: token})
}

// forgotPasswordHandler allows only the admin to reset their own password.
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
	adminUser, exists := getUserByToken(token)
	if !exists || adminUser.Role != "admin" {
		http.Error(w, "Admin user not found", http.StatusNotFound)
		return
	}
	adminUser.Password = req.NewPassword
	users[adminUser.Username] = adminUser
	newToken := "Bearer " + adminUser.Username + "-token"
	tokens[adminUser.Username] = newToken
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Admin password has been reset successfully. Please login with your new password.",
	})
}

// uploadHandler allows both admin and user to upload a file.
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
	// Retrieve the current user from token.
	currentUser, _ := getUserByToken(token)
	err := r.ParseMultipartForm(10 << 20) // 10 MB memory limit
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
	if _, exists := files[handler.Filename]; exists {
		http.Error(w, "File already exists", http.StatusBadRequest)
		return
	}
	uploadedFile := FileRecord{
		FileName:    handler.Filename,
		Size:        handler.Size,
		ContentType: handler.Header.Get("Content-Type"),
		Uploader:    currentUser.Username,
	}
	files[handler.Filename] = uploadedFile
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("File '%s' uploaded successfully", handler.Filename),
	})
}

// deleteFileHandler allows admin to delete any file, and allows a regular user to delete only files they uploaded.
func deleteFileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}
	token := r.Header.Get("Authorization")
	user, ok := getUserByToken(token)
	if !ok {
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
	fileRecord, exists := files[req.FileName]
	if !exists {
		http.Error(w, "File does not exist", http.StatusNotFound)
		return
	}
	// If the caller is not an admin, check that they are the uploader.
	if user.Role != "admin" && fileRecord.Uploader != user.Username {
		http.Error(w, "Forbidden: You can only delete files you uploaded", http.StatusForbidden)
		return
	}
	delete(files, req.FileName)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("File '%s' has been deleted successfully", req.FileName),
	})
}

// filesHandler returns all stored file records. Accessible to both admin and user.
func filesHandler(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	if !(isValidAdminToken(token) || isValidUserToken(token)) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	fileList := make([]FileRecord, 0, len(files))
	for _, record := range files {
		fileList = append(fileList, record)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(fileList)
}

// downloadHandler allows both admin and user to download a file.
// Since actual file content is not stored, it returns dummy content.
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
	fileRecord, exists := files[fileName]
	if !exists {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", fileRecord.ContentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileRecord.FileName))
	dummyContent := fmt.Sprintf("This is dummy content for file %s", fileRecord.FileName)
	w.Write([]byte(dummyContent))
}

// adminHandler responds only if the provided token belongs to an admin.
func adminHandler(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	if !isValidAdminToken(token) {
		http.NotFound(w, r)
		return
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprintln(w, "Welcome admin")
}

// userHandler responds only if the provided token belongs to a regular user.
func userHandler(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	if !isValidUserToken(token) {
		http.NotFound(w, r)
		return
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprintln(w, "Welcome user")
}

// usersHandler returns all registered users (admin only).
func usersHandler(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	if !isValidAdminToken(token) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	var userList []string
	for username := range users {
		userList = append(userList, username)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(userList)
}

// addUserHandler allows an admin to add a new user (with role "user").
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
	if _, exists := users[req.Username]; exists {
		http.Error(w, "User already exists", http.StatusBadRequest)
		return
	}
	newUser := User{
		Username: req.Username,
		Password: req.Password,
		Role:     "user",
	}
	users[req.Username] = newUser
	tokens[req.Username] = "Bearer " + req.Username + "-token"
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("User '%s' has been added successfully", req.Username),
	})
}

// updateUserHandler allows an admin to update an existing user's username and password.
// Refactored to use the PUT method.
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
	user, exists := users[req.OldUsername]
	if !exists {
		http.Error(w, "User does not exist", http.StatusNotFound)
		return
	}
	if req.OldUsername != req.NewUsername {
		if _, exists := users[req.NewUsername]; exists {
			http.Error(w, "New username already taken", http.StatusBadRequest)
			return
		}
	}
	delete(users, req.OldUsername)
	user.Username = req.NewUsername
	user.Password = req.NewPassword
	users[req.NewUsername] = user
	delete(tokens, req.OldUsername)
	tokens[req.NewUsername] = "Bearer " + req.NewUsername + "-token"
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("User '%s' has been updated to '%s' with new password", req.OldUsername, req.NewUsername),
	})
}

// adminStatusHandler returns whether an admin is registered.
func adminStatusHandler(w http.ResponseWriter, r *http.Request) {
	for _, user := range users {
		if user.Role == "admin" {
			json.NewEncoder(w).Encode(map[string]bool{"adminExists": true})
			return
		}
	}
	json.NewEncoder(w).Encode(map[string]bool{"adminExists": false})
}

// Rustom Bayot API
// deleteUserHandler allows an admin to delete a user.
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
	if _, exists := users[req.Username]; !exists {
		http.Error(w, "User does not exist", http.StatusNotFound)
		return
	}
	delete(users, req.Username)
	delete(tokens, req.Username)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("User '%s' has been deleted successfully", req.Username),
	})
}

// assignAdminHandler allows an admin to promote an existing user to admin.
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

	user, exists := users[req.Username]
	if !exists {
		http.Error(w, "User does not exist", http.StatusNotFound)
		return
	}
	if user.Role == "admin" {
		http.Error(w, "User is already an admin", http.StatusBadRequest)
		return
	}

	// Promote the user to admin.
	user.Role = "admin"
	users[req.Username] = user
	tokens[req.Username] = "Bearer " + req.Username + "-token"

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("User '%s' is now an admin", req.Username),
	})
}

// getUserByToken finds a user associated with a given token.
func getUserByToken(token string) (User, bool) {
	for username, t := range tokens {
		if t == token {
			u, exists := users[username]
			return u, exists
		}
	}
	return User{}, false
}

// isValidAdminToken checks whether the provided token belongs to an admin.
func isValidAdminToken(token string) bool {
	user, ok := getUserByToken(token)
	return ok && user.Role == "admin"
}

// isValidUserToken checks whether the provided token belongs to a regular user.
func isValidUserToken(token string) bool {
	user, ok := getUserByToken(token)
	return ok && user.Role == "user"
}

//API Endpoints
