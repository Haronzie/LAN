package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/gorilla/sessions"
	_ "github.com/lib/pq"

	"LANFileSharingSystem/internal/config"
	"LANFileSharingSystem/internal/controllers"
	"LANFileSharingSystem/internal/models"
)

func main() {
	// Load application configuration.
	cfg := config.LoadConfig()

	// Connect to the database.
	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Error connecting to database:", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal("Error pinging database:", err)
	}
	log.Println("Successfully connected to database!")

	// AUTOMATICALLY RUN MIGRATIONS HERE

	migrationsPath := "file://../../internal/migrations"
	m, err := migrate.New(migrationsPath, cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Migration initialization error:", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatal("Migration error:", err)
	}
	log.Println("Migrations applied successfully (or no changes needed).")

	// Initialize session store using a secret key from configuration.
	store := sessions.NewCookieStore([]byte(cfg.SessionKey))

	// Initialize the application model (shared context).
	app := models.NewApp(db, store)

	// Ensure the 'uploads' folder exists.
	if err := os.MkdirAll("uploads", 0755); err != nil {
		log.Fatal("Error creating 'uploads' folder:", err)
	}

	// OPTIONAL: Create subfolders if needed
	// (Same logic you already have—omitted for brevity)
	// ...

	// Create a new router.
	router := mux.NewRouter()

	// Initialize controllers with the application context.
	authController := controllers.NewAuthController(app)
	fileController := controllers.NewFileController(app)
	userController := controllers.NewUserController(app)
	directoryController := controllers.NewDirectoryController(app)
	activityController := controllers.NewActivityController(app)
	inventoryController := controllers.NewInventoryController(app)

	// Define routes.
	router.HandleFunc("/register", authController.Register).Methods("POST")
	router.HandleFunc("/login", authController.Login).Methods("POST")
	router.HandleFunc("/logout", authController.Logout).Methods("POST")
	router.HandleFunc("/upload", fileController.Upload).Methods("POST")
	router.HandleFunc("/copy-file", fileController.CopyFile).Methods("POST")
	router.HandleFunc("/move-file", fileController.MoveFile).Methods("POST")
	router.HandleFunc("/download", fileController.Download).Methods("GET")
	router.HandleFunc("/files", fileController.ListFiles).Methods("GET")
	router.HandleFunc("/share", fileController.ShareFile).Methods("POST")
	router.HandleFunc("/file/rename", fileController.RenameFile).Methods("PUT")
	router.HandleFunc("/download-share", fileController.DownloadShare).Methods("GET")
	router.HandleFunc("/users", userController.ListUsers).Methods("GET")
	router.HandleFunc("/user/add", userController.AddUser).Methods("POST")
	router.HandleFunc("/user/update", userController.UpdateUser).Methods("PUT")
	router.HandleFunc("/user/delete", userController.DeleteUser).Methods("DELETE")
	router.HandleFunc("/assign-admin", userController.AssignAdmin).Methods("POST")
	router.HandleFunc("/delete-file", fileController.DeleteFile).Methods("DELETE")
	router.HandleFunc("/admin-exists", userController.AdminExists).Methods("GET")
	router.HandleFunc("/user-role", userController.GetUserRole).Methods("GET")

	// Directory routes.
	router.HandleFunc("/directory/create", directoryController.Create).Methods("POST")
	router.HandleFunc("/directory/delete", directoryController.Delete).Methods("DELETE")
	router.HandleFunc("/directory/rename", directoryController.Rename).Methods("PUT")
	router.HandleFunc("/directory/list", directoryController.List).Methods("GET")
	router.HandleFunc("/directory/copy", directoryController.Copy).Methods("POST")
	router.HandleFunc("/directory/tree", directoryController.Tree).Methods("GET")
	router.HandleFunc("/directory/move", directoryController.Move).Methods("POST")
	// Inventory routes
	router.HandleFunc("/inventory", inventoryController.List).Methods("GET")
	router.HandleFunc("/inventory", inventoryController.Create).Methods("POST")
	router.HandleFunc("/inventory/{id}", inventoryController.Get).Methods("GET")
	router.HandleFunc("/inventory/{id}", inventoryController.Update).Methods("PUT")
	router.HandleFunc("/inventory/{id}", inventoryController.Delete).Methods("DELETE")

	// Activity routes.
	router.HandleFunc("/activities", activityController.List).Methods("GET")

	// Wrap your router with CORS middleware.
	corsRouter := handlers.CORS(
		handlers.AllowedOrigins([]string{"http://localhost:3000"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)(router)

	// Start the HTTP server.
	log.Println("Starting server on port", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, corsRouter); err != nil {
		log.Fatal("Server failed:", err)
	}
}
