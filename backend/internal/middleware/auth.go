package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/liucong/personal-website/internal/config"
)

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get allowed origin from environment variable
		// Format: comma-separated list of origins (e.g., "https://example.com,https://app.example.com")
		allowedOrigins := getEnvOrDefault("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
		origin := c.Request.Header.Get("Origin")

		// Check if the request origin is in the allowed list
		if isOriginAllowed(origin, allowedOrigins) {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Vary", "Origin")
		}

		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func isOriginAllowed(origin string, allowedOrigins string) bool {
	if origin == "" {
		return false
	}
	origins := strings.Split(allowedOrigins, ",")
	for _, allowed := range origins {
		if strings.TrimSpace(allowed) == origin {
			return true
		}
	}
	return false
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return defaultValue
}

func AuthRequired(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		// First try to get token from cookie
		cookieToken, err := c.Cookie("access_token")
		if err == nil && cookieToken != "" {
			tokenString = cookieToken
		} else {
			// Fall back to Authorization header for backward compatibility
			authHeader := c.GetHeader("Authorization")
			if authHeader == "" {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization required"})
				c.Abort()
				return
			}

			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
			if tokenString == authHeader {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Bearer token required"})
				c.Abort()
				return
			}
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.JWT.Secret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		// Verify it's an access token (type claim must exist and equal "access")
		tokenType, ok := claims["type"].(string)
		if !ok || tokenType != "access" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token type"})
			c.Abort()
			return
		}

		// Store user info in context
		// Convert userID from float64 to uint (JWT parses numbers as float64)
		userIDFloat, ok := claims["sub"].(float64)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID in token"})
			c.Abort()
			return
		}
		c.Set("userID", uint(userIDFloat))
		c.Set("userRole", claims["role"])
		c.Next()
	}
}

func AdminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("userRole")
		if !exists || role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// OriginRefererCheck validates that the request's Origin or Referer header
// matches an allowed origin. Unlike CSRFProtection, this does not depend on
// any cookie lifetime — suitable for endpoints like /auth/refresh where the
// CSRF cookie may have already expired.
func OriginRefererCheck() gin.HandlerFunc {
	allowedOrigins := getEnvOrDefault("CORS_ALLOWED_ORIGINS", "http://localhost:5173")

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		referer := c.Request.Header.Get("Referer")

		// At least one must be present
		if origin == "" && referer == "" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Origin or Referer header required"})
			c.Abort()
			return
		}

		if origin != "" {
			if !isOriginAllowed(origin, allowedOrigins) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Origin not allowed"})
				c.Abort()
				return
			}
		} else {
			// Extract origin from Referer URL
			rOrigin := refererOrigin(referer)
			if rOrigin == "" || !isOriginAllowed(rOrigin, allowedOrigins) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Referer origin not allowed"})
				c.Abort()
				return
			}
		}

		c.Next()
	}
}

// refererOrigin extracts the origin (scheme://host[:port]) from a URL string.
func refererOrigin(raw string) string {
	// Find the end of scheme://host[:port] — first '/' after "://"
	schemeIdx := strings.Index(raw, "://")
	if schemeIdx < 0 {
		return ""
	}
	rest := raw[schemeIdx+3:]
	slashIdx := strings.Index(rest, "/")
	if slashIdx < 0 {
		return raw // no path — entire string is origin
	}
	return raw[:schemeIdx+3+slashIdx]
}

// CSRFProtection implements the double-submit cookie pattern for CSRF protection.
// It skips safe methods (GET, HEAD, OPTIONS) and validates that the X-CSRF-Token
// header matches the csrf_token cookie on state-changing requests.
func CSRFProtection() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip safe methods
		if c.Request.Method == "GET" || c.Request.Method == "HEAD" || c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		cookieToken, err := c.Cookie("csrf_token")
		if err != nil || cookieToken == "" {
			c.JSON(http.StatusForbidden, gin.H{"error": "CSRF token missing from cookie"})
			c.Abort()
			return
		}

		headerToken := c.GetHeader("X-CSRF-Token")
		if headerToken == "" {
			c.JSON(http.StatusForbidden, gin.H{"error": "CSRF token missing from header"})
			c.Abort()
			return
		}

		if cookieToken != headerToken {
			c.JSON(http.StatusForbidden, gin.H{"error": "CSRF token mismatch"})
			c.Abort()
			return
		}

		c.Next()
	}
}