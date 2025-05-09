package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"unicode"

	"LANFileSharingSystem/internal/models"

	"github.com/gorilla/sessions"
)

// AuthController handles authentication-related endpoints.
type AuthController struct {
	App *models.App
}

// NewAuthController creates a new AuthController.
func NewAuthController(app *models.App) *AuthController {
	return &AuthController{App: app}
}

// Register handles user registration. The first registered user is set as admin.
func (ac *AuthController) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	var req struct {
		Username        string `json:"username"`
		Password        string `json:"password"`
		ConfirmPassword string `json:"confirmPassword"`
	}

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

	// Check if the user already exists.
	if _, err := ac.App.GetUserByUsername(req.Username); err == nil {
		models.RespondError(w, http.StatusBadRequest, "User already exists")
		return
	}

	// Hash the password.
	hashedPass, err := models.HashPassword(req.Password)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error hashing password")
		return
	}

	// First user is admin; next users are regular.
	role := "admin"
	if ac.App.AdminExists() {
		role = "user"
	}

	newUser := models.User{
		Username: req.Username,
		Password: hashedPass,
		Role:     role,
	}

	if err := ac.App.CreateUser(newUser); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error registering user")
		return
	}

	// ✅ NO SESSION CREATION HERE.

	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("%s registered successfully", newUser.Username),
	})
}

// Login handles user authentication.
func (ac *AuthController) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)

	user, err := ac.App.GetUserByUsername(req.Username)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Invalid username or password")
		return
	}

	if !models.CheckPasswordHash(req.Password, user.Password) {
		models.RespondError(w, http.StatusUnauthorized, "Invalid username or password")
		return
	}

	// Fix: Ensure `ac.App.Store` is initialized and accessible.
	session, err := ac.App.Store.Get(r, "session")
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error retrieving session")
		return
	}

	session.Values["username"] = user.Username
	session.Values["role"] = user.Role
	session.Options = &sessions.Options{
		Path:     "/",                  // root path
		MaxAge:   86400 * 7,            // one week
		HttpOnly: true,                 // inaccessible to JS
		Secure:   false,                // OK for localhost; use true in prod
		SameSite: http.SameSiteLaxMode, // adjust SameSite mode as needed
	}
	if err := session.Save(r, w); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error saving session")
		return
	}

	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message":  "Login successful",
		"username": user.Username,
		"role":     user.Role,
	})
}

// Logout ends the user session.
func (ac *AuthController) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	user, err := ac.App.GetUserFromSession(r)
	if err != nil {
		models.RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	session, err := ac.App.Store.Get(r, "session")
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error retrieving session")
		return
	}
	session.Options.MaxAge = -1
	if err := session.Save(r, w); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error saving session")
		return
	}

	ac.App.LogActivity(fmt.Sprintf("User '%s' logged out.", user.Username))
	models.RespondJSON(w, http.StatusOK, map[string]string{"message": "Logout successful"})
}

// ForgotPassword handles resetting a user's password.
func (ac *AuthController) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	var req struct {
		Username        string `json:"username"`
		NewPassword     string `json:"newPassword"`
		ConfirmPassword string `json:"confirmPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.NewPassword = strings.TrimSpace(req.NewPassword)
	req.ConfirmPassword = strings.TrimSpace(req.ConfirmPassword)

	if req.Username == "" || req.NewPassword == "" || req.ConfirmPassword == "" {
		models.RespondError(w, http.StatusBadRequest, "Username, new password, and confirm password are required")
		return
	}

	if req.NewPassword != req.ConfirmPassword {
		models.RespondError(w, http.StatusBadRequest, "New password and confirm password do not match")
		return
	}

	user, err := ac.App.GetUserByUsername(req.Username)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "Username does not exist")
		return
	}

	// ✅ Enforce admin-only access
	if user.Role != "admin" {
		models.RespondError(w, http.StatusForbidden, "Only admins are allowed to reset password via this endpoint")
		return
	}

	if ok, msg := isStrongPassword(req.NewPassword); !ok {
		models.RespondError(w, http.StatusBadRequest, msg)
		return
	}

	hashedPass, err := models.HashPassword(req.NewPassword)
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error hashing new password")
		return
	}

	if err := ac.App.UpdateUserPassword(user.Username, hashedPass); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error updating password")
		return
	}

	ac.App.LogAudit(user.Username, 0, "PASSWORD_RESET", "Admin reset their password")
	ac.App.LogActivity(fmt.Sprintf("Admin '%s' reset their password", user.Username))

	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Password updated for user '%s'.", user.Username),
	})
}

// isStrongPassword checks if the given password meets your strength criteria.
func isStrongPassword(pw string) (bool, string) {
	var (
		hasMinLen  = false
		hasUpper   = false
		hasLower   = false
		hasDigit   = false
		hasSpecial = false
	)

	// Adjust minimum length as needed
	if len(pw) >= 8 {
		hasMinLen = true
	}

	for _, char := range pw {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsDigit(char):
			hasDigit = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}

	if !hasMinLen {
		return false, "Password must be at least 8 characters long"
	}
	if !hasUpper {
		return false, "Password must contain at least one uppercase letter"
	}
	if !hasLower {
		return false, "Password must contain at least one lowercase letter"
	}
	if !hasDigit {
		return false, "Password must contain at least one digit"
	}
	if !hasSpecial {
		return false, "Password must contain at least one special character"
	}

	return true, ""
}

// GetUserRole returns the role of a given username, e.g. {"role": "admin"} or {"role": "user"}.
func (ac *AuthController) GetUserRole(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	username := r.URL.Query().Get("username")
	if username == "" {
		models.RespondError(w, http.StatusBadRequest, "Username is required")
		return
	}

	user, err := ac.App.GetUserByUsername(username)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, "User not found")
		return
	}

	models.RespondJSON(w, http.StatusOK, map[string]string{"role": user.Role})
}
