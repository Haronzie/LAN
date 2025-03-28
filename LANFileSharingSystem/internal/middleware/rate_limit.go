package middleware

import (
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// Client holds a limiter and last seen time for each client
type Client struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

var (
	clients = make(map[string]*Client)
	mu      sync.Mutex
)

// RateLimitConfig contains configurable rate limit parameters
type RateLimitConfig struct {
	RequestsPerSecond float64
	BurstSize         int
	CleanupInterval   time.Duration
	ClientTTL         time.Duration
}

// NewRateLimitConfig creates a config with defaults or environment variables
func NewRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		RequestsPerSecond: getEnvFloat("RATE_LIMIT", 1.0),
		BurstSize:         getEnvInt("BURST_LIMIT", 5),
		CleanupInterval:   getEnvDuration("CLEANUP_INTERVAL", 1*time.Hour),
		ClientTTL:         getEnvDuration("CLIENT_TTL", 24*time.Hour),
	}
}

// RateLimitMiddleware creates a configured rate limiting middleware
func RateLimitMiddleware(next http.Handler) http.Handler {
	config := NewRateLimitConfig()

	// Start background cleanup
	go cleanupClients(config.CleanupInterval, config.ClientTTL)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := getClientIP(r)
		if ip == "" {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		limiter := getClientLimiter(ip, config.RequestsPerSecond, config.BurstSize)

		// Reserve a token
		reservation := limiter.ReserveN(time.Now(), 1)
		if !reservation.OK() {
			log.Printf("Rate limit exceeded for IP: %s", ip)
			setRateLimitHeaders(w, limiter, 0, 0)
			http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
			return
		}

		// Check if allowed
		delay := reservation.Delay()
		if delay > 0 {
			reservation.Cancel()
			log.Printf("Rate limit exceeded for IP: %s", ip)
			resetTime := int(delay.Seconds())
			setRateLimitHeaders(w, limiter, 0, resetTime)
			http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
			return
		}

		// Calculate remaining tokens
		remaining := int(limiter.Tokens())
		resetTime := int((1 / config.RequestsPerSecond) * 1000) // Approximate reset in ms

		// Set headers and proceed
		setRateLimitHeaders(w, limiter, remaining, resetTime)
		next.ServeHTTP(w, r)
	})
}

func getClientIP(r *http.Request) string {
	// Get IP from X-Forwarded-For header if behind proxy
	ip := r.Header.Get("X-Forwarded-For")
	if ip == "" {
		ip = r.RemoteAddr
	}

	// Split IP:PORT combinations
	host, _, err := net.SplitHostPort(ip)
	if err == nil {
		ip = host
	}

	// Handle multiple IPs in X-Forwarded-For
	if strings.Contains(ip, ",") {
		ips := strings.Split(ip, ",")
		ip = strings.TrimSpace(ips[0])
	}

	return ip
}

func getClientLimiter(ip string, rps float64, burst int) *rate.Limiter {
	mu.Lock()
	defer mu.Unlock()

	if client, exists := clients[ip]; exists {
		client.lastSeen = time.Now()
		return client.limiter
	}

	limiter := rate.NewLimiter(rate.Limit(rps), burst)
	clients[ip] = &Client{
		limiter:  limiter,
		lastSeen: time.Now(),
	}

	return limiter
}

func cleanupClients(interval, ttl time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		mu.Lock()
		for ip, client := range clients {
			if time.Since(client.lastSeen) > ttl {
				delete(clients, ip)
			}
		}
		mu.Unlock()
	}
}

func setRateLimitHeaders(w http.ResponseWriter, l *rate.Limiter, remaining int, reset int) {
	w.Header().Set("X-RateLimit-Limit", strconv.Itoa(l.Burst()))
	w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
	w.Header().Set("X-RateLimit-Reset", strconv.Itoa(reset))
	w.Header().Set("Retry-After", strconv.Itoa(reset))
}

// Helper functions for environment variables
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if f, err := strconv.ParseFloat(value, 64); err == nil {
			return f
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if d, err := time.ParseDuration(value); err == nil {
			return d
		}
	}
	return defaultValue
}
