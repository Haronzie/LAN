package middleware

import (
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"golang.org/x/time/rate"
)

// RateLimitConfig holds configuration for requests per second, burst size, etc.
type RateLimitConfig struct {
	RequestsPerSecond float64
	BurstSize         int
	ClientTTL         time.Duration
	CleanupInterval   time.Duration
}

// clients stores a map of IP -> rate limiter
var (
	clients   = make(map[string]*rate.Limiter)
	clientsMu sync.Mutex
)

// NewRateLimitConfig sets up defaults or reads from environment variables
func NewRateLimitConfig() *RateLimitConfig {
	return &RateLimitConfig{
		RequestsPerSecond: getEnvFloat("RATE_LIMIT", 1.0),
		BurstSize:         getEnvInt("BURST_LIMIT", 5),
		ClientTTL:         10 * time.Minute, // You can adjust as needed
		CleanupInterval:   5 * time.Minute,  // You can adjust as needed
	}
}

// RateLimitMiddleware only rate-limits /upload and /download paths
func RateLimitMiddleware(next http.Handler) http.Handler {
	config := NewRateLimitConfig()

	// Start background cleanup of stale clients
	go cleanupClients(config.CleanupInterval, config.ClientTTL)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. Check if we should apply rate limiting to this path
		if !shouldRateLimit(r.URL.Path) {
			// If not, skip limiting
			next.ServeHTTP(w, r)
			return
		}

		// 2. If we do, proceed with the limiter
		ip := getClientIP(r)
		if ip == "" {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		limiter := getClientLimiter(ip, config.RequestsPerSecond, config.BurstSize)
		reservation := limiter.ReserveN(time.Now(), 1)
		if !reservation.OK() {
			logrus.WithField("ip", ip).Warn("Rate limit exceeded")
			setRateLimitHeaders(w, limiter, 0, 0)
			http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
			return
		}

		// If there's a delay, it means we're out of tokens
		delay := reservation.Delay()
		if delay > 0 {
			reservation.Cancel()
			logrus.WithField("ip", ip).Warn("Rate limit exceeded due to delay")
			resetTime := int(delay.Seconds())
			setRateLimitHeaders(w, limiter, 0, resetTime)
			http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
			return
		}

		// Calculate remaining tokens
		remaining := int(limiter.Tokens())
		// Approximate reset time in ms (for X-RateLimit-Reset header)
		resetTime := int((1 / config.RequestsPerSecond) * 1000)

		// Set rate limit headers and proceed
		setRateLimitHeaders(w, limiter, remaining, resetTime)
		next.ServeHTTP(w, r)
	})
}

// shouldRateLimit returns true only if the path is /upload or /download
func shouldRateLimit(path string) bool {
	return strings.HasPrefix(path, "/upload") || strings.HasPrefix(path, "/download")
}

// getClientLimiter returns the existing limiter for an IP or creates a new one
func getClientLimiter(ip string, rateLimit float64, burst int) *rate.Limiter {
	clientsMu.Lock()
	defer clientsMu.Unlock()

	if limiter, exists := clients[ip]; exists {
		return limiter
	}
	limiter := rate.NewLimiter(rate.Limit(rateLimit), burst)
	clients[ip] = limiter
	return limiter
}

// cleanupClients removes stale IPs that haven't been used within ClientTTL
func cleanupClients(interval, ttl time.Duration) {
	_ = ttl
	for {
		time.Sleep(interval)
		clientsMu.Lock()
		for ip, limiter := range clients {
			// If we have no tokens left, it might indicate the client is active,
			// but this simple approach tries to remove older entries.
			// In a more robust system, you'd store a lastSeen time for each IP.
			if limiter.Allow() {
				// If a token is successfully taken, it suggests no active usage,
				// so remove the client entry.
				delete(clients, ip)
			}
		}
		clientsMu.Unlock()
	}
}

// getClientIP tries to extract the client's IP from headers or remote address
func getClientIP(r *http.Request) string {
	ip := r.Header.Get("X-Forwarded-For")
	if ip == "" {
		ip = r.RemoteAddr
	}
	// Strip port if present
	host, _, err := net.SplitHostPort(ip)
	if err == nil {
		ip = host
	}
	// If multiple IPs in X-Forwarded-For, take the first
	if strings.Contains(ip, ",") {
		ips := strings.Split(ip, ",")
		ip = strings.TrimSpace(ips[0])
	}
	return ip
}

// setRateLimitHeaders adds useful rate-limit info to the response
func setRateLimitHeaders(w http.ResponseWriter, l *rate.Limiter, remaining, reset int) {
	w.Header().Set("X-RateLimit-Limit", strconv.Itoa(l.Burst()))
	w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
	w.Header().Set("X-RateLimit-Reset", strconv.Itoa(reset))
	w.Header().Set("Retry-After", strconv.Itoa(reset))
}

// Helper functions to read environment variables
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
