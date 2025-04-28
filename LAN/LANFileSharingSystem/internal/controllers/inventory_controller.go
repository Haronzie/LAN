package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"LANFileSharingSystem/internal/models"

	"github.com/gorilla/mux"
)

// InventoryController handles endpoints related to inventory management.
type InventoryController struct {
	App *models.App
}

// NewInventoryController creates a new InventoryController.
func NewInventoryController(app *models.App) *InventoryController {
	return &InventoryController{App: app}
}

// List handles GET /inventory to list all items.
func (ic *InventoryController) List(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	items, err := ic.App.ListInventoryItems()
	if err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error retrieving inventory items")
		return
	}

	models.RespondJSON(w, http.StatusOK, items)
}

// Create handles POST /inventory to create a new item.
func (ic *InventoryController) Create(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	var req struct {
		ItemName string `json:"item_name"`
		Quantity int    `json:"quantity"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.ItemName = strings.TrimSpace(req.ItemName)
	if req.ItemName == "" {
		models.RespondError(w, http.StatusBadRequest, "Item name cannot be empty")
		return
	}

	item := models.InventoryItem{
		ItemName: req.ItemName,
		Quantity: req.Quantity,
	}
	if err := ic.App.CreateInventoryItem(item); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error creating inventory item")
		return
	}

	// Log activity if needed
	ic.App.LogActivity(fmt.Sprintf("New inventory item '%s' created.", req.ItemName))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Item '%s' created successfully", req.ItemName),
	})
}

// Get handles GET /inventory/{id} to get a single item.
func (ic *InventoryController) Get(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	vars := mux.Vars(r)
	idStr, ok := vars["id"]
	if !ok {
		models.RespondError(w, http.StatusBadRequest, "Missing item ID")
		return
	}
	id, err := strconv.Atoi(idStr)
	if err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid item ID")
		return
	}

	item, err := ic.App.GetInventoryItemByID(id)
	if err != nil {
		models.RespondError(w, http.StatusNotFound, err.Error())
		return
	}

	models.RespondJSON(w, http.StatusOK, item)
}

// Update handles PUT /inventory/{id} to update an existing item.
func (ic *InventoryController) Update(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	vars := mux.Vars(r)
	idStr, ok := vars["id"]
	if !ok {
		models.RespondError(w, http.StatusBadRequest, "Missing item ID")
		return
	}
	id, err := strconv.Atoi(idStr)
	if err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid item ID")
		return
	}

	var req struct {
		ItemName string `json:"item_name"`
		Quantity int    `json:"quantity"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	item := models.InventoryItem{
		ID:       id,
		ItemName: strings.TrimSpace(req.ItemName),
		Quantity: req.Quantity,
	}

	if err := ic.App.UpdateInventoryItem(item); err != nil {
		models.RespondError(w, http.StatusInternalServerError, "Error updating inventory item")
		return
	}

	ic.App.LogActivity(fmt.Sprintf("Inventory item '%d' updated.", id))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Item '%d' updated successfully", id),
	})
}

// Delete handles DELETE /inventory/{id} to remove an item.
func (ic *InventoryController) Delete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		models.RespondError(w, http.StatusMethodNotAllowed, "Invalid request method")
		return
	}

	vars := mux.Vars(r)
	idStr, ok := vars["id"]
	if !ok {
		models.RespondError(w, http.StatusBadRequest, "Missing item ID")
		return
	}
	id, err := strconv.Atoi(idStr)
	if err != nil {
		models.RespondError(w, http.StatusBadRequest, "Invalid item ID")
		return
	}

	if err := ic.App.DeleteInventoryItem(id); err != nil {
		models.RespondError(w, http.StatusNotFound, "Item not found or could not be deleted")
		return
	}

	ic.App.LogActivity(fmt.Sprintf("Inventory item '%d' deleted.", id))
	models.RespondJSON(w, http.StatusOK, map[string]string{
		"message": fmt.Sprintf("Item '%d' deleted successfully", id),
	})
}
