# Task: Add OptionalAuth middleware to GET /posts/:slug

## Problem
`GET /posts/:slug` is in the public route group with no auth middleware.
So `c.Get("userID")` always returns nil → `liked` is always false after page reload.

## Files to modify
- `backend/internal/middleware/auth.go`
- `backend/internal/routes/routes.go`

## Fix

### 1. Add OptionalAuth middleware to auth.go

Add a new function `OptionalAuth(cfg *config.Config) gin.HandlerFunc` after `AuthRequired`.
It works the same as AuthRequired but does NOT abort — if token is missing/invalid, it just calls `c.Next()` silently.

```go
// OptionalAuth extracts the user from the JWT token if present, but does not
// abort the request if the token is missing or invalid.
func OptionalAuth(cfg *config.Config) gin.HandlerFunc {
    return func(c *gin.Context) {
        var tokenString string
        cookieToken, err := c.Cookie("access_token")
        if err == nil && cookieToken != "" {
            tokenString = cookieToken
        } else {
            authHeader := c.GetHeader("Authorization")
            if strings.HasPrefix(authHeader, "Bearer ") {
                tokenString = authHeader[7:]
            }
        }
        if tokenString == "" {
            c.Next()
            return
        }
        token, err := jwt.ParseWithClaims(tokenString, &jwt.MapClaims{}, func(token *jwt.Token) (interface{}, error) {
            if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
                return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
            }
            return []byte(cfg.JWT.Secret), nil
        })
        if err != nil || !token.Valid {
            c.Next()
            return
        }
        if claims, ok := token.Claims.(*jwt.MapClaims); ok {
            if userIDFloat, ok := (*claims)["user_id"].(float64); ok {
                userID := uint(userIDFloat)
                // Load user from DB to verify they still exist
                var user models.User
                if err := database.DB.First(&user, userID).Error; err == nil {
                    c.Set("userID", userID)
                    c.Set("user", &user)
                }
            }
        }
        c.Next()
    }
}
```

### 2. Apply OptionalAuth to GET /posts/:slug in routes.go

In routes.go, find where `api.GET("/posts/:slug", ...)` is registered and add OptionalAuth middleware.

Change:
```go
api.GET("/posts/:slug", postController.GetPostBySlug)
```
To:
```go
api.GET("/posts/:slug", middleware.OptionalAuth(cfg), postController.GetPostBySlug)
```

## Rules
- Read both files before editing
- Only modify the two files listed
- Do NOT run tests
- Use Edit tool for changes
