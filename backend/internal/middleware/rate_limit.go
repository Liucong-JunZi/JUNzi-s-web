package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// rateLimitScript atomically checks and increments the rate limit counter in Redis.
// Returns the current count after increment.
// KEYS[1] = rate limit key
// ARGV[1] = limit
// ARGV[2] = window in seconds
var rateLimitScript = redis.NewScript(`
local current = redis.call('INCR', KEYS[1])
if tonumber(current) == 1 then
	redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return tonumber(current)
`)

const defaultRateLimitScope = "default"

// RateLimiter creates a rate limiting middleware using the default scope.
//
// Keep this wrapper for callers that do not need separate buckets. Route
// groups should use RateLimiterWithScope so their quotas do not interfere.
func RateLimiter(client *redis.Client, limit int, window time.Duration) gin.HandlerFunc {
	return RateLimiterWithScope(client, defaultRateLimitScope, limit, window)
}

// RateLimiterWithScope creates a Redis-backed rate limiter with an isolated
// counter for the given scope and client IP.
func RateLimiterWithScope(client *redis.Client, scope string, limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Fail-closed: if Redis client is nil, reject the request
		if client == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Service temporarily unavailable"})
			c.Abort()
			return
		}

		ip := c.ClientIP()
		key := rateLimitKey(scope, ip)

		ctx := context.Background()

		result, err := rateLimitScript.Run(ctx, client, []string{key}, limit, int(window.Seconds())).Int()
		if err != nil {
			// Fail-closed: if Redis returns an error, reject the request
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Service temporarily unavailable"})
			c.Abort()
			return
		}

		if result > limit {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded. Please try again later.",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RateLimiterWithConfig creates a rate limiter with custom config
func RateLimiterWithConfig(client *redis.Client, requestsPerMinute int) gin.HandlerFunc {
	return RateLimiterWithScope(client, "global", requestsPerMinute, time.Minute)
}

func rateLimitKey(scope, ip string) string {
	if scope == "" {
		scope = defaultRateLimitScope
	}
	return "rate_limit:" + scope + ":" + ip
}
