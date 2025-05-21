package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	DatabaseURL string
	SessionKey  string
}

func LoadConfig() Config {
	// Load from .env file (ignore error if file doesn't exist)
	_ = godotenv.Load(".env")

	cfg := Config{
		Port:        os.Getenv("PORT"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		SessionKey:  os.Getenv("SESSION_KEY"),
	}

	if cfg.Port == "" {
		cfg.Port = "8080"
	}

	if cfg.DatabaseURL == "" {
		cfg.DatabaseURL = "postgres://postgres:haron@localhost:5432/Cdrrmo?sslmode=disable"
	}

	if cfg.SessionKey == "" {
		cfg.SessionKey = "your-default-secret-key"
	}

	return cfg
}
