package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// RateLimiter creates a rate limiting middleware using Redis
func RateLimiter(client *redis.Client, limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get client IP
		ip := c.ClientIP()
		key := "rate_limit:" + ip

		ctx := context.Background()

		// Get current count
		count, err := client.Get(ctx, key).Int()
		if err != nil && err != redis.Nil {
			// If Redis error, allow request (fail open)
			c.Next()
			return
		}

		if count >= limit {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded. Please try again later.",
			})
			c.Abort()
			return
		}

		// Increment counter
		if err == redis.Nil {
			// First request, set with expiration
			client.Set(ctx, key, 1, window)
		} else {
			// Increment existing counter
			client.Incr(ctx, key)
		}

		c.Next()
	}
}

// RateLimiterWithConfig creates a rate limiter with custom config
func RateLimiterWithConfig(client *redis.Client, requestsPerMinute int) gin.HandlerFunc {
	return RateLimiter(client, requestsPerMinute, time.Minute)
}
