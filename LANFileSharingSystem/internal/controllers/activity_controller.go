package controllers

import (
	"LANFileSharingSystem/internal/models"
	"net/http"
)

// AuditLogController handles file audit log endpoints.
type AuditLogController struct {
	App *models.App
}

// NewAuditLogController creates a new AuditLogController.
func NewAuditLogController(app *models.App) *AuditLogController {
	return &AuditLogController{App: app}
}

// List returns the file audit logs.
func (alc *AuditLogController) List(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	// Fetch only file-related audit logs
	auditLogs, err := alc.App.ListFileAuditLogs()
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error retrieving audit logs")
		return
	}
	models.RespondJSON(w, http.StatusOK, auditLogs)
}
