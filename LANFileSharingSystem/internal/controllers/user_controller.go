package controllers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"LANFileSharingSystem/internal/models"
)

// UserController handles endpoints related to user management.
type UserController struct {
	App *models.App
}

// NewUserController creates a new UserController.
func NewUserController(app *models.App) *UserController {
	return &UserController{App: app}
}

// ListUsers returns a list of all users. Only admins can access this.
func (uc *UserController) ListUsers(w http.ResponseWriter, r *http.Request) {
	user, err := uc.App.GetUserFromSession(r)
	if err != nil {
		log.Println("Failed to retrieve session:", err)
		models.RespondError(w, http.StatusUnauthorized, "Unauthorized: Session invalid")
		return
	}

	// Ensure only admin can access
	if user.Role != "admin" {
		models.RespondError(w, http.StatusForbidden, "Forbidden")
		return
	}

	users, err := uc.App.ListUsers()
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error retrieving users")
		return
	}

	models.RespondJSON(w, http.StatusOK, users)
}

// AddUser allows an admin to add a new user.
// user_controller.go

func (uc *UserController) AddUser(w http.ResponseWriter, r *http.Request) {
	user, err := uc.App.GetUserFromSession(r)
	if err != nil || user.Role != "admin" {
		models.RespondError(w, http.StatusForbidden, "Forbidden: Only admins can add users")
		return
	}
	if r.Method != http.MethodPost {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	var req models.AddUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)
	if req.Username == "" || req.Password == "" {
		models.RespondError(w, http.StatusBadRequest, "Username and password cannot be empty")
		return
	}
	if ok, msg := isStrongPassword(req.Password); !ok {
		models.RespondError(w, http.StatusBadRequest, msg)
		return
	}

	// Use a case-insensitive search to see if the user already exists.
	_, err = uc.App.GetUserByUsername(req.Username)
	if err == nil {
		models.RespondError(w, http.StatusBadRequest, fmt.Sprintf("User '%s' already exists", req.Username))
		return
	}

	// IMPORTANT: Hash the password before saving
	hashedPass, err := models.HashPassword(req.Password)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error hashing password")
		return
	}

	// Create new user with hashed password
	newUser := models.User{
		Username: req.Username,
		Password: hashedPass,
		Role:     "user",
	}
	if err := uc.App.CreateUser(newUser); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error adding user")
		return
	}

	uc.App.LogActivity(fmt.Sprintf("Admin '%s' added user '%s'.", user.Username, req.Username))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("User '%s' has been added successfully", req.Username),
	})
}

// AdminExists handles GET /admin-exists.
func (uc *UserController) AdminExists(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	exists := uc.App.AdminExists()
	models.RespondJSON(w, http.StatusOK, map[string]bool{"exists": exists})
}

// UpdateUser allows an admin to update a user's information.
func (uc *UserController) UpdateUser(w http.ResponseWriter, r *http.Request) {
	user, err := uc.App.GetUserFromSession(r)
	if err != nil || user.Role != "admin" {
		models.RespondError(w, http.StatusForbidden, "Forbidden")
		return
	}
	if r.Method != http.MethodPut {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	var req models.UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.OldUsername = strings.TrimSpace(req.OldUsername)
	req.NewUsername = strings.TrimSpace(req.NewUsername)
	req.NewPassword = strings.TrimSpace(req.NewPassword)
	if req.OldUsername == "" || req.NewUsername == "" || req.NewPassword == "" {
		models.RespondError(w, http.StatusBadRequest, "Old username, new username, and new password are required")
		return
	}

	// Case-insensitive duplicate check
	if !strings.EqualFold(req.OldUsername, req.NewUsername) {
		existingUser, err := uc.App.GetUserByUsername(req.NewUsername)
		if err == nil && !strings.EqualFold(existingUser.Username, req.OldUsername) {
			models.RespondError(w, http.StatusBadRequest, fmt.Sprintf("Username '%s' already exists", req.NewUsername))
			return
		}
	}

	// Update user if username is unique or unchanged
	if err := uc.App.UpdateUser(req.OldUsername, req.NewUsername, req.NewPassword); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error updating user")
		return
	}

	uc.App.LogActivity(fmt.Sprintf("Admin '%s' updated user '%s' to '%s'.", user.Username, req.OldUsername, req.NewUsername))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("User '%s' updated successfully", req.OldUsername),
	})
}

// DeleteUser allows an admin to delete a user.
func (uc *UserController) DeleteUser(w http.ResponseWriter, r *http.Request) {
	user, err := uc.App.GetUserFromSession(r)
	if err != nil || user.Role != "admin" {
		models.RespondError(w, http.StatusForbidden, "Forbidden")
		return
	}
	if r.Method != http.MethodDelete {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	var req models.DeleteUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" {
		models.RespondError(w, http.StatusBadRequest, "Username cannot be empty")
		return
	}

	if err := uc.App.DeleteUser(req.Username); err != nil {
		models.RespondError(w, http.StatusNotFound, "User not found")
		return
	}

	uc.App.LogActivity(fmt.Sprintf("Admin '%s' deleted user '%s'.", user.Username, req.Username))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("User '%s' has been deleted successfully", req.Username),
	})
}

// AssignAdmin allows an admin to promote a user to admin.
func (uc *UserController) AssignAdmin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}
	user, err := uc.App.GetUserFromSession(r)
	if err != nil || user.Role != "admin" {
		models.RespondError(w, http.StatusForbidden, "Forbidden: Only an admin can assign a new admin")
		return
	}

	var req models.AssignAdminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" {
		models.RespondError(w, http.StatusBadRequest, "Username cannot be empty")
		return
	}

	if err := uc.App.AssignAdmin(req.Username); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error assigning admin role")
		return
	}

	uc.App.LogActivity(fmt.Sprintf("Admin '%s' assigned admin role to user '%s'.", user.Username, req.Username))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("User '%s' is now an admin", req.Username),
	})
}

// GetUserRole returns the role of the currently authenticated user.
func (uc *UserController) GetUserRole(w http.ResponseWriter, r *http.Request) {
	// Attempt to retrieve the user from session
	user, err := uc.App.GetUserFromSession(r)
	if err != nil {
		// If not found or any error, respond with 401 Unauthorized
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Otherwise, return the user's role as JSON
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"role": user.Role,
	})
}

// FetchUserList allows authenticated users to fetch a list of users for granting/revoking access.
func (uc *UserController) FetchUserList(w http.ResponseWriter, r *http.Request) {
	// Ensure the user is authenticated
	user, err := uc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Unauthorized: Session invalid")
		return
	}

	// Log the user fetching the list
	log.Printf("User '%s' is fetching the user list.", user.Username)

	// Parse query parameters for search
	searchQuery := strings.TrimSpace(r.URL.Query().Get("search"))

	// Fetch the list of users
	users, err := uc.App.ListUsers()
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error retrieving users")
		return
	}

	// Filter users based on the search query (case-insensitive)
	var filteredUsers []models.User
	for _, u := range users {
		if searchQuery == "" || strings.Contains(strings.ToLower(u.Username), strings.ToLower(searchQuery)) {
			// Exclude sensitive information like passwords
			filteredUsers = append(filteredUsers, models.User{
				Username: u.Username,
				Role:     u.Role,
			})
		}
	}

	// Respond with the filtered list of users
	models.RespondJSON(w, http.StatusOK, filteredUsers)
}

// RevokeAdmin allows the first admin to revoke admin privileges from another admin.
func (uc *UserController) RevokeAdmin(w http.ResponseWriter, r *http.Request) {
	// Get current user from session
	currentUser, err := uc.App.GetUserFromSession(r)
	if err != nil || currentUser.Role != "admin" {
		models.RespondError(w, http.StatusForbidden, "Forbidden: Only admins can revoke admin roles")
		return
	}

	// Check if the current user is the FIRST admin
	firstAdmin, err := uc.App.GetFirstAdmin()
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error retrieving first admin")
		return
	}

	if currentUser.Username != firstAdmin.Username {
		models.RespondError(w, http.StatusForbidden, "Forbidden: Only the first admin can revoke roles")
		return
	}

	// Parse request
	var req models.AssignAdminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	targetUsername := strings.TrimSpace(req.Username)
	if targetUsername == "" {
		models.RespondError(w, http.StatusBadRequest, "Username cannot be empty")
		return
	}

	// Prevent revoking the first admin
	if targetUsername == firstAdmin.Username {
		models.RespondError(w, http.StatusBadRequest, "Cannot revoke the first admin")
		return
	}

	// Check if target user exists and is an admin
	isAdmin, err := uc.App.IsUserAdmin(targetUsername)
	if err != nil || !isAdmin {
		models.RespondError(w, http.StatusBadRequest, "User is not an admin or does not exist")
		return
	}

	// Revoke admin role
	if err := uc.App.RevokeAdmin(targetUsername); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error revoking admin role")
		return
	}

	uc.App.LogActivity(fmt.Sprintf("First admin '%s' revoked admin role from user '%s'.", currentUser.Username, targetUsername))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Admin privileges revoked from '%s'", targetUsername),
	})
}
func (uc *UserController) GetFirstAdmin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	// (Optional) Ensure the requester is an admin or at least authenticated:
	user, err := uc.App.GetUserFromSession(r)
	if err != nil || user.Role != "admin" {
		models.RespondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	firstAdmin, err := uc.App.GetFirstAdmin()
	if err != nil {
		// If no admin exists or DB error, respond accordingly
		log.Println("Error retrieving first admin:", err)
		models.RespondError(w, http.StatusInternalServerError, "Error retrieving first admin")
		return
	}

	// Return the first admin's info (e.g., username and role)
	models.RespondJSON(w, http.StatusOK, firstAdmin)
}
