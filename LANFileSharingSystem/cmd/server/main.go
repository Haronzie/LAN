package main

import (
	"database/sql"
	"log"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/gorilla/sessions"
	_ "github.com/lib/pq"

	"LANFileSharingSystem/internal/config"
	"LANFileSharingSystem/internal/controllers"
	"LANFileSharingSystem/internal/models"
)

func main() {
	// Load application configuration (e.g. port, database URL, session key)
	cfg := config.LoadConfig()

	// Connect to the database
	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Error connecting to database:", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatal("Error connecting to database:", err)
	}
	log.Println("Successfully connected to database!")

	// Initialize session store using a secret key from configuration
	store := sessions.NewCookieStore([]byte(cfg.SessionKey))

	// Initialize the application model (shared context)
	app := models.NewApp(db, store)

	// Create a new router
	router := mux.NewRouter()

	// Initialize controllers with the application context
	authController := controllers.NewAuthController(app)
	fileController := controllers.NewFileController(app)
	userController := controllers.NewUserController(app)
	directoryController := controllers.NewDirectoryController(app)
	activityController := controllers.NewActivityController(app)

	// Define routes (these endpoints are now handled by their respective controllers)
	router.HandleFunc("/register", authController.Register).Methods("POST")
	router.HandleFunc("/login", authController.Login).Methods("POST")
	router.HandleFunc("/logout", authController.Logout).Methods("POST")

	router.HandleFunc("/upload", fileController.Upload).Methods("POST")
	router.HandleFunc("/download", fileController.Download).Methods("GET")
	router.HandleFunc("/files", fileController.ListFiles).Methods("GET")
	router.HandleFunc("/share", fileController.ShareFile).Methods("POST")
	router.HandleFunc("/download-share", fileController.DownloadShare).Methods("GET")

	router.HandleFunc("/user/profile", userController.Profile).Methods("GET", "PUT")
	router.HandleFunc("/users", userController.ListUsers).Methods("GET")
	router.HandleFunc("/user/add", userController.AddUser).Methods("POST")
	router.HandleFunc("/user/update", userController.UpdateUser).Methods("PUT")
	router.HandleFunc("/user/delete", userController.DeleteUser).Methods("DELETE")
	router.HandleFunc("/assign-admin", userController.AssignAdmin).Methods("POST")

	router.HandleFunc("/directory/create", directoryController.Create).Methods("POST")
	router.HandleFunc("/directory/delete", directoryController.Delete).Methods("DELETE")
	router.HandleFunc("/directory/rename", directoryController.Rename).Methods("PUT")
	router.HandleFunc("/directory/list", directoryController.List).Methods("GET")

	router.HandleFunc("/activities", activityController.List).Methods("GET")

	// Additional endpoints for moving, copying resources, updating user status, etc. can be added similarly.

	// Start the HTTP server
	log.Println("Starting server on port", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatal("Server failed:", err)
	}
}
