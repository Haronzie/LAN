package main

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"runtime"
	"strings"

	"LANFileSharingSystem/internal/config"
	"LANFileSharingSystem/internal/controllers"
	"LANFileSharingSystem/internal/middleware"
	"LANFileSharingSystem/internal/models"
	"LANFileSharingSystem/internal/ws"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/google/uuid"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/gorilla/sessions"
	_ "github.com/lib/pq"
	"github.com/sirupsen/logrus"
	"gopkg.in/natefinch/lumberjack.v2"
)

/*
LOGGING STANDARDS:
1. Use INFO level to indicate successful or expected system operations.
2. Use ERROR level when an operation fails or an unexpected issue occurs.
3. Use DEBUG level for more granular details helpful during development.
   - Enable by setting environment variable LOG_LEVEL=debug
4. Include correlation IDs in logs to trace requests across services.
   - We generate a UUID if no correlation ID is provided in the header.
5. To integrate with centralized logging (Splunk, ELK, etc.), set LOG_FORMAT=json
   - This switches to logrus.JSONFormatter for structured logs.
6. Always wrap errors with context (using fmt.Errorf and %w) to preserve the original error.
7. Use uniform error messages with unique error codes for easier troubleshooting:
   - DB_CONN_ERR: Database connection errors.
   - DB_PING_ERR: Database ping failures.
   - MIG_INIT_ERR: Migration initialization failures.
   - MIG_UP_ERR: Migration execution failures.
   - FOLDER_CREATE_ERR: File system folder creation errors.
   - SERVER_ERR: Server startup errors.
*/

var logger *logrus.Logger

// correlationIDKey is a custom type to avoid context key collisions.
type correlationIDKey struct{}

// correlationIDMiddleware generates or retrieves a correlation ID for each request
// and adds it to the request context so we can log it consistently.
func correlationIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Attempt to read a correlation ID from the incoming request header.
		corrID := r.Header.Get("X-Correlation-ID")
		if corrID == "" {
			corrID = uuid.New().String()
		}
		// Store correlation ID in the request context.
		ctx := context.WithValue(r.Context(), correlationIDKey{}, corrID)

		// Call the next handler with the updated context.
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// getCorrelationID retrieves the correlation ID from the request context.
func getCorrelationID(r *http.Request) string {
	val := r.Context().Value(correlationIDKey{})
	if corrID, ok := val.(string); ok {
		return corrID
	}
	return ""
}

func initLogger() {
	// Set up lumberjack for log rotation.
	lumberjackLogger := &lumberjack.Logger{
		Filename:   "error.log", // Log file path
		MaxSize:    5,           // Max size in MB before rotation
		MaxBackups: 30,          // Max number of old log files to keep
		MaxAge:     30,          // Max number of days to retain logs
		Compress:   true,        // Whether to compress old logs
	}

	// Create a new logrus logger.
	logger = logrus.New()

	// Write logs both to the rotating file and stdout.
	multiWriter := io.MultiWriter(lumberjackLogger, os.Stdout)
	logger.SetOutput(multiWriter)

	// Determine if we should use JSON or text format based on an environment variable.
	logFormat := os.Getenv("LOG_FORMAT")
	if logFormat == "json" {
		logger.SetFormatter(&logrus.JSONFormatter{
			// You can set a custom timestamp format, or rely on RFC3339.
			// e.g., TimestampFormat: time.RFC3339,
		})
	} else {
		// Customize the text format for a more professional look.
		logger.SetFormatter(&logrus.TextFormatter{
			TimestampFormat: "2006-01-02 15:04:05", // e.g., 2025-03-25 13:51:13
			FullTimestamp:   true,
			ForceColors:     true, // color-coded logs in terminal (optional)
			CallerPrettyfier: func(frame *runtime.Frame) (function string, file string) {
				fileName := path.Base(frame.File)
				return fmt.Sprintf("%s()", frame.Function), fmt.Sprintf("%s:%d", fileName, frame.Line)
			},
		})
	}

	// Enable caller reporting so that file and line number are logged.
	logger.SetReportCaller(true)

	// Set log level based on an environment variable (e.g. LOG_LEVEL=debug).
	switch os.Getenv("LOG_LEVEL") {
	case "debug":
		logger.SetLevel(logrus.DebugLevel)
	case "trace":
		logger.SetLevel(logrus.TraceLevel)
	default:
		logger.SetLevel(logrus.InfoLevel)
	}
}

func main() {
	// Initialize the structured logger.
	initLogger()

	// Log the start of main function execution.
	logger.WithField("function", "main").Debug("Starting main function execution")

	// Load application configuration.
	cfg := config.LoadConfig()
	logger.WithField("function", "main").Debug("Loaded configuration from environment or default file")

	// Connect to the database.
	logger.WithField("function", "main").Debug("Attempting to open DB connection")
	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		// DB_CONN_ERR: Database connection errors.
		wrappedErr := fmt.Errorf("failed to open DB connection (database: %s): %w", cfg.DatabaseURL, err)
		logger.WithField("function", "main").
			WithField("errorCode", "DB_CONN_ERR").
			WithField("database", cfg.DatabaseURL).
			WithError(wrappedErr).
			Error("Database connection error")
		logrus.Exit(1)
	}
	defer db.Close()

	// Debug log: Attempting to ping the DB.
	logger.WithField("function", "main").Debug("Attempting to ping the database...")
	if err := db.Ping(); err != nil {
		// DB_PING_ERR: Database ping failures.
		wrappedErr := fmt.Errorf("failed to ping DB (database: %s): %w", cfg.DatabaseURL, err)
		logger.WithField("function", "main").
			WithField("errorCode", "DB_PING_ERR").
			WithField("database", cfg.DatabaseURL).
			WithError(wrappedErr).
			Error("Database ping error")
		logrus.Exit(1)
	}
	logger.WithField("function", "main").
		WithField("database", cfg.DatabaseURL).
		Info("Successfully connected to database")

	// AUTOMATICALLY RUN MIGRATIONS HERE
	migrationsPath := "file://internal/migrations"
	logger.WithField("function", "main").Debug("Initializing migrations...")
	m, err := migrate.New(migrationsPath, cfg.DatabaseURL)
	if err != nil {
		// MIG_INIT_ERR: Migration initialization failures.
		wrappedErr := fmt.Errorf("migration initialization error (path: %s): %w", migrationsPath, err)
		logger.WithField("function", "main").
			WithField("errorCode", "MIG_INIT_ERR").
			WithField("migrationsPath", migrationsPath).
			WithError(wrappedErr).
			Error("Migration initialization failed")
		logrus.Exit(1)
	}
	logger.WithField("function", "main").Debug("Running migrations...")
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		// MIG_UP_ERR: Migration execution failures.
		wrappedErr := fmt.Errorf("migration error (path: %s): %w", migrationsPath, err)
		logger.WithField("function", "main").
			WithField("errorCode", "MIG_UP_ERR").
			WithField("migrationsPath", migrationsPath).
			WithError(wrappedErr).
			Error("Migration up failed")
		logrus.Exit(1)
	}
	logger.WithField("function", "main").
		WithField("migrationsPath", migrationsPath).
		Info("Migrations applied successfully (or no changes needed)")

	// Initialize session store using a secret key from configuration.
	logger.WithField("function", "main").Debug("Initializing session store...")
	store := sessions.NewCookieStore([]byte(cfg.SessionKey))

	// Initialize the application model (shared context).
	logger.WithField("function", "main").Debug("Creating new application context (App)...")
	app := models.NewApp(db, store)

	// Initialize the notification hub and attach it to your app context.
	logger.WithField("function", "main").Debug("Initializing WebSocket hub...")
	hub := ws.NewHub()
	go hub.Run()
	app.NotificationHub = hub

	// Ensure the 'uploads' folder exists.
	// Ensure the 'Cdrrmo' folder and fixed subfolders exist.
	logger.WithField("function", "main").Debug("Ensuring 'Cdrrmo' base folders exist...")
	if err := os.MkdirAll("Cdrrmo", 0755); err != nil {
		wrappedErr := fmt.Errorf("error creating 'Cdrrmo' folder: %w", err)
		logger.WithField("function", "main").
			WithField("errorCode", "FOLDER_CREATE_ERR").
			WithField("folder", "Cdrrmo").
			WithError(wrappedErr).
			Error("Folder creation error")
		logrus.Exit(1)
	}
	for _, folder := range []string{"Operation", "Research", "Training"} {
		fullPath := path.Join("Cdrrmo", folder)
		if err := os.MkdirAll(fullPath, 0755); err != nil {
			wrappedErr := fmt.Errorf("error creating subfolder: %s - %w", fullPath, err)
			logger.WithField("function", "main").
				WithField("errorCode", "FOLDER_CREATE_ERR").
				WithField("folder", fullPath).
				WithError(wrappedErr).
				Error("Subfolder creation error")
			logrus.Exit(1)
		}
	}

	// Create a new router.
	logger.WithField("function", "main").Debug("Creating new Gorilla mux router...")
	router := mux.NewRouter()
	// Removed the first RateLimitMiddleware call here to avoid duplication.

	// Initialize controllers with the application context.
	logger.WithField("function", "main").Debug("Initializing controllers...")
	authController := controllers.NewAuthController(app)
	fileController := controllers.NewFileController(app)
	userController := controllers.NewUserController(app)
	directoryController := controllers.NewDirectoryController(app)
	auditLogController := controllers.NewAuditLogController(app)
	inventoryController := controllers.NewInventoryController(app)

	// Define your routes...
	logger.WithField("function", "main").Debug("Defining application routes...")
	router.HandleFunc("/register", authController.Register).Methods("POST")
	router.HandleFunc("/login", authController.Login).Methods("POST")
	router.HandleFunc("/forgot-password", authController.ForgotPassword).Methods("POST")
	router.HandleFunc("/logout", authController.Logout).Methods("POST")
	router.HandleFunc("/upload", fileController.Upload).Methods("POST")
	router.HandleFunc("/bulk-upload", fileController.BulkUpload).Methods("POST")
	router.HandleFunc("/copy-file", fileController.CopyFile).Methods("POST")
	router.HandleFunc("/move-file", fileController.MoveFile).Methods("POST")
	router.HandleFunc("/download", fileController.Download).Methods("GET")
	router.HandleFunc("/files", fileController.ListFiles).Methods("GET")
	router.HandleFunc("/file/rename", fileController.RenameFile).Methods("PUT")
	router.HandleFunc("/users/fetch", userController.FetchUserList).Methods("GET")
	router.HandleFunc("/users", userController.ListUsers).Methods("GET")
	router.HandleFunc("/user/add", userController.AddUser).Methods("POST")
	router.HandleFunc("/user/update", userController.UpdateUser).Methods("PUT")
	router.HandleFunc("/user/delete", userController.DeleteUser).Methods("DELETE")
	router.HandleFunc("/assign-admin", userController.AssignAdmin).Methods("POST")
	router.HandleFunc("/delete-file", fileController.DeleteFile).Methods("DELETE")
	router.HandleFunc("/admin-exists", userController.AdminExists).Methods("GET")
	router.HandleFunc("/user-role", userController.GetUserRole).Methods("GET")
	router.HandleFunc("/get-user-role", authController.GetUserRole).Methods("GET")
	router.HandleFunc("/files/all", fileController.ListAllFiles).Methods("GET")
	router.HandleFunc("/preview", fileController.Preview).Methods("GET")
	router.HandleFunc("/revoke-admin", userController.RevokeAdmin).Methods("POST")
	router.HandleFunc("/get-first-admin", userController.GetFirstAdmin).Methods("GET")
	router.HandleFunc("/file/message", fileController.SendFileMessage).Methods("POST")
	router.HandleFunc("/file/message/{id}/done", fileController.MarkFileMessageAsDone).Methods("PATCH")
	router.HandleFunc("/file/messages", fileController.GetFileMessages).Methods("GET")
	router.HandleFunc("/file/versions", fileController.GetFileVersions).Methods("GET")

	// Directory routes
	router.HandleFunc("/directory/create", directoryController.Create).Methods("POST")
	router.HandleFunc("/directory/delete", directoryController.Delete).Methods("DELETE")
	router.HandleFunc("/directory/rename", directoryController.Rename).Methods("PUT")
	router.HandleFunc("/directory/list", directoryController.List).Methods("GET")
	router.HandleFunc("/directory/copy", directoryController.Copy).Methods("POST")
	router.HandleFunc("/directory/tree", directoryController.Tree).Methods("GET")
	router.HandleFunc("/directory/move", directoryController.Move).Methods("POST")
	router.HandleFunc("/download-folder", directoryController.DownloadFolder).Methods("GET")

	// Inventory routes
	router.HandleFunc("/inventory", inventoryController.List).Methods("GET")
	router.HandleFunc("/inventory", inventoryController.Create).Methods("POST")
	router.HandleFunc("/inventory/{id}", inventoryController.Get).Methods("GET")
	router.HandleFunc("/inventory/{id}", inventoryController.Update).Methods("PUT")
	router.HandleFunc("/inventory/{id}", inventoryController.Delete).Methods("DELETE")

	// Audit logs
	router.HandleFunc("/auditlogs", auditLogController.List).Methods("GET")

	// WebSocket route
	router.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		// Attach correlation ID to logs inside the handler, if needed.
		corrID := getCorrelationID(r)
		logger.WithField("function", "WebSocketHandler").
			WithField("correlationID", corrID).
			Debug("Upgrading to WebSocket")
		ws.ServeWs(hub, w, r)
	})

	// Add correlation ID middleware before other middlewares.
	router.Use(correlationIDMiddleware)

	// Add rate limit middleware (applied only once now).
	router.Use(middleware.RateLimitMiddleware)

	// Wrap your router with CORS middleware.
	corsRouter := handlers.CORS(
		handlers.AllowedOriginValidator(func(origin string) bool {
			return strings.HasPrefix(origin, "http://192.168.") || origin == "http://localhost:3000"
		}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
		handlers.AllowCredentials(),
	)(router)

	// Start the HTTP server.
	logger.WithField("function", "main").
		WithField("port", cfg.Port).
		Info("Starting server")
	if err := http.ListenAndServe(":"+cfg.Port, corsRouter); err != nil {
		// SERVER_ERR: Server startup errors.
		wrappedErr := fmt.Errorf("server failed on port %s: %w", cfg.Port, err)
		logger.WithField("function", "main").
			WithField("errorCode", "SERVER_ERR").
			WithField("port", cfg.Port).
			WithError(wrappedErr).
			Error("Server error")
		logrus.Exit(1)
	}
}
