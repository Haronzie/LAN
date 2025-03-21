package config

import (
	"os"
)

// Config holds the application configuration settings.
type Config struct {
	Port        string
	DatabaseURL string
	SessionKey  string
}

// LoadConfig reads configuration values from environment variables
// and returns a Config struct. If certain values are not set, defaults are used.
func LoadConfig() Config {
	cfg := Config{
		Port:        os.Getenv("PORT"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		SessionKey:  os.Getenv("SESSION_KEY"),
	}

	// Set default port if not provided.
	if cfg.Port == "" {
		cfg.Port = "8080"
	}

	// Set a default database URL if not provided.
	if cfg.DatabaseURL == "" {
		cfg.DatabaseURL = "postgres://postgres:haron@localhost:5432/Cdrrmo?sslmode=disable"

	}

	// Set a default session key if not provided.
	if cfg.SessionKey == "" {
		cfg.SessionKey = "your-default-secret-key"
	}

	return cfg
}
