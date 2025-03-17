package controllers

import (
	"net/http"

	"LANFileSharingSystem/internal/models"
)

// ActivityController handles activity log endpoints.
type ActivityController struct {
	App *models.App
}

// NewActivityController creates a new ActivityController.
func NewActivityController(app *models.App) *ActivityController {
	return &ActivityController{App: app}
}

// List returns the most recent activity logs.
func (ac *ActivityController) List(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	activities, err := ac.App.ListActivities() // Assumes ListActivities() is implemented.
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error retrieving activities")
		return
	}
	models.RespondJSON(w, http.StatusOK, activities)
}
