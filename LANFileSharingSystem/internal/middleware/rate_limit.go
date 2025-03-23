package middleware

import (
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// Client holds a limiter for each client.
type Client struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

var (
	clients = make(map[string]*Client)
	mu      sync.Mutex
)

// getClientLimiter returns a limiter for a given IP address. It creates one if not found.
func getClientLimiter(ip string) *rate.Limiter {
	mu.Lock()
	defer mu.Unlock()

	if client, exists := clients[ip]; exists {
		client.lastSeen = time.Now()
		return client.limiter
	}

	// Create a new limiter: 1 request per second with a burst size of 5.
	limiter := rate.NewLimiter(1, 5)
	clients[ip] = &Client{limiter: limiter, lastSeen: time.Now()}
	return limiter
}

// RateLimitMiddleware is a middleware that applies per-IP rate limiting and adds custom headers.
func RateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		limiter := getClientLimiter(ip)

		// Set static limit values.
		limit := limiter.Burst() // Maximum tokens allowed (e.g., 5)
		// In a more sophisticated implementation, you might track the remaining tokens dynamically.
		remaining := "N/A"
		reset := "1" // Seconds until a token is likely available

		// Check if a token is available.
		if !limiter.Allow() {
			// Log the rejection for debugging.
			log.Printf("Rate limit exceeded for IP: %s", ip)
			// Set headers before rejecting.
			w.Header().Set("X-RateLimit-Limit", strconv.Itoa(limit))
			w.Header().Set("X-RateLimit-Remaining", "0")
			w.Header().Set("X-RateLimit-Reset", reset)
			http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
			return
		}

		// Set headers for successful requests.
		w.Header().Set("X-RateLimit-Limit", strconv.Itoa(limit))
		w.Header().Set("X-RateLimit-Remaining", remaining)
		w.Header().Set("X-RateLimit-Reset", reset)

		next.ServeHTTP(w, r)
	})
}
