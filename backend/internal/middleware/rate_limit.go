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

// RateLimiter creates a rate limiting middleware using Redis
func RateLimiter(client *redis.Client, limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Fail-closed: if Redis client is nil, reject the request
		if client == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Service temporarily unavailable"})
			c.Abort()
			return
		}

		ip := c.ClientIP()
		key := "rate_limit:" + ip

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
	return RateLimiter(client, requestsPerMinute, time.Minute)
}
