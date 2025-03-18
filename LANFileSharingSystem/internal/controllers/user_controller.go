package controllers

import (
	"encoding/json"
	"fmt"
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

// Profile handles retrieving and updating the authenticated user's profile.
func (uc *UserController) Profile(w http.ResponseWriter, r *http.Request) {
	user, err := uc.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	switch r.Method {
	case http.MethodGet:
		// Return the user record as JSON.
		models.RespondJSON(w, http.StatusOK, user)

	case http.MethodPut:
		// No longer expect an email field in the JSON payload.
		var req struct {
			Username string `json:"username"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			models.RespondError(w, http.StatusBadRequest, "Invalid request body")
			return
		}

		req.Username = strings.TrimSpace(req.Username)
		if req.Username == "" {
			models.RespondError(w, http.StatusBadRequest, "Username cannot be empty")
			return
		}

		// UpdateUserProfile now only updates the username (remove email references).
		if err := uc.App.UpdateUserProfile(user.Username, req.Username); err != nil {
			models.RespondError(w, http.StatusInternalServerError, "Error updating profile")
			return
		}

		// Update session username to reflect changes.
		session, _ := uc.App.Store.Get(r, "session")
		session.Values["username"] = req.Username
		session.Save(r, w)

		models.RespondJSON(w, http.StatusOK, map[string]string{
			"message":  "Profile updated successfully",
			"username": req.Username,
		})

	default:
		models.RespondError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

// ListUsers returns a list of all users. Only admins can access this.
func (uc *UserController) ListUsers(w http.ResponseWriter, r *http.Request) {
	user, err := uc.App.GetUserFromSession(r)
	if err != nil || user.Role != "admin" {
		models.RespondError(w, http.StatusForbidden, "Forbidden")
		return
	}

	users, err := uc.App.ListUsers() // Assumes ListUsers() is implemented.
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error retrieving users")
		return
	}
	models.RespondJSON(w, http.StatusOK, users)
}

// AddUser allows an admin to add a new user.
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

	newUser := models.User{
		Username: req.Username,
		Password: req.Password, // Ensure CreateUser hashes the password.
		Role:     "user",
		Active:   false,
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

// AdminExists handles GET /admin-exists
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
