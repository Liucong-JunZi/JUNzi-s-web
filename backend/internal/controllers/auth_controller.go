package controllers

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/liucong/personal-website/internal/audit"
	"github.com/liucong/personal-website/internal/cache"
	"github.com/redis/go-redis/v9"
	"github.com/liucong/personal-website/internal/config"
	"github.com/liucong/personal-website/internal/database"
	"github.com/liucong/personal-website/internal/models"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"gorm.io/gorm"
)

type AuthController struct {
	cfg         *config.Config
	oauthConf   *oauth2.Config
	frontendURL string
}

func NewAuthController(cfg *config.Config) *AuthController {
	return &AuthController{
		cfg: cfg,
		oauthConf: &oauth2.Config{
			ClientID:     cfg.GitHub.ClientID,
			ClientSecret: cfg.GitHub.ClientSecret,
			Scopes:       []string{"user:email"},
			Endpoint:     github.Endpoint,
			RedirectURL:  cfg.GitHub.CallbackURL,
		},
		frontendURL: func() string {
			if v := os.Getenv("FRONTEND_URL"); v != "" {
				return v
			}
			return "http://localhost:5173"
		}(),
	}
}

type GitHubUser struct {
	ID        int    `json:"id"`
	Login     string `json:"login"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatar_url"`
	Bio       string `json:"bio"`
}

// isSecureCookie returns true when running in production.
// Checks both APP_ENV and GIN_MODE to ensure Secure flag is set
// even if APP_ENV is accidentally omitted.
func isSecureCookie() bool {
	return os.Getenv("APP_ENV") == "production" || os.Getenv("GIN_MODE") == "release"
}

// setCookie sets a cookie with SameSite=Lax using http.SetCookie.
func setCookie(c *gin.Context, name, value string, maxAge int, httpOnly bool) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     name,
		Value:    value,
		MaxAge:   maxAge,
		Path:     "/",
		Secure:   isSecureCookie(),
		HttpOnly: httpOnly,
		SameSite: http.SameSiteLaxMode,
	})
}

// generateCSRFToken generates a random CSRF token encoded as base64.
func generateCSRFToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

// generateState generates a random state string for CSRF protection
func (ac *AuthController) generateState() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// tokenHash returns a SHA-256 hex digest of the token string for use as a
// Redis blocklist key. Using a hash avoids storing raw tokens in Redis.
func tokenHash(tokenString string) string {
	h := sha256.Sum256([]byte(tokenString))
	return hex.EncodeToString(h[:])
}

// revokeRefreshToken adds a refresh token to the Redis blocklist.
// The TTL is set to the token's remaining lifetime so the entry auto-expires.
func revokeRefreshToken(tokenString string, expiresAt time.Time) error {
	key := "refresh_revoked:" + tokenHash(tokenString)
	ttl := time.Until(expiresAt)
	if ttl <= 0 {
		return nil // already expired, no need to blocklist
	}
	ctx := context.Background()
	return cache.Client.Set(ctx, key, "1", ttl).Err()
}

// isRefreshTokenRevoked checks whether a refresh token has been revoked.
// redis.Nil (key not found) means the token is NOT revoked — this is the normal case.
// Redis connection errors are treated as fail-open (not revoked) for availability.
// JWT signature validation still provides authentication security even when
// the revocation check is bypassed by a Redis outage.
func isRefreshTokenRevoked(tokenString string) bool {
	key := "refresh_revoked:" + tokenHash(tokenString)
	ctx := context.Background()
	_, err := cache.Client.Get(ctx, key).Result()
	if err == redis.Nil {
		return false // key not found → token is NOT revoked (normal case)
	}
	if err != nil {
		// Redis unavailable → fail-open for availability.
		// Log the error so operators can investigate repeated Redis failures.
		log.Printf("[WARN] Redis error during token revocation check: %v", err)
		return false
	}
	return true // key exists → token IS revoked
}

// GitHubRedirect redirects to GitHub OAuth page
func (ac *AuthController) GitHubRedirect(c *gin.Context) {
	// Generate random state for CSRF protection
	state, err := ac.generateState()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate state"})
		return
	}

	// Store state in Redis with 10 minute expiration
	ctx := context.Background()
	if err := cache.Client.Set(ctx, "oauth_state:"+state, "1", 10*time.Minute).Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store state"})
		return
	}

	setCookie(c, "oauth_state", state, 600, true)

	url := ac.oauthConf.AuthCodeURL(state, oauth2.AccessTypeOffline)
	c.Redirect(http.StatusTemporaryRedirect, url)
}

// GitHubCallback handles GitHub OAuth callback
func (ac *AuthController) GitHubCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Code not provided"})
		return
	}

	// Validate state for CSRF protection
	state := c.Query("state")
	if state == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "State not provided"})
		return
	}

	cookieState, err := c.Cookie("oauth_state")
	if err != nil || cookieState != state {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid state"})
		return
	}
	setCookie(c, "oauth_state", "", -1, true)

	ctx := context.Background()
	stateKey := "oauth_state:" + state
	if err := cache.Client.Get(ctx, stateKey).Err(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired state"})
		return
	}
	// Delete used state
	cache.Client.Del(ctx, stateKey)

	// Exchange code for token
	token, err := ac.oauthConf.Exchange(context.Background(), code)
	if err != nil {
		audit.Log("login_failed", "OAuth token exchange failed", c)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange token"})
		return
	}

	// Get user info from GitHub
	client := ac.oauthConf.Client(context.Background(), token)
	resp, err := client.Get("https://api.github.com/user")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user info"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user info from GitHub"})
		return
	}

	var ghUser GitHubUser
	if err := json.NewDecoder(resp.Body).Decode(&ghUser); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse user info"})
		return
	}

	// Validate required fields from GitHub response
	if ghUser.ID == 0 || ghUser.Login == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user info received from GitHub"})
		return
	}

	// Check if user exists
	var user models.User
	result := database.DB.Where("github_id = ?", fmt.Sprintf("%d", ghUser.ID)).First(&user)

	if result.Error == gorm.ErrRecordNotFound {
		// Create new user
		user = models.User{
			GitHubID:  fmt.Sprintf("%d", ghUser.ID),
			Username:  ghUser.Login,
			Email:     ghUser.Email,
			AvatarURL: ghUser.AvatarURL,
			Bio:       ghUser.Bio,
			Role:      "user",
		}
		if err := database.DB.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
			return
		}
	} else if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	now := time.Now()

	// Generate access token (1 hour expiration)
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  user.ID,
		"role": user.Role,
		"type": "access",
		"exp":  now.Add(time.Hour).Unix(),
		"iat":  now.Unix(),
	})

	accessTokenString, err := accessToken.SignedString([]byte(ac.cfg.JWT.Secret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate access token"})
		return
	}

	// Generate refresh token (7 days expiration) with unique ID for revocation
	refreshJTI := uuid.New().String()
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  user.ID,
		"type": "refresh",
		"jti":  refreshJTI,
		"exp":  now.Add(time.Hour * 24 * 7).Unix(),
		"iat":  now.Unix(),
	})

	refreshTokenString, err := refreshToken.SignedString([]byte(ac.cfg.JWT.Secret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate refresh token"})
		return
	}

	// Set tokens as HttpOnly cookies with SameSite=Lax
	setCookie(c, "access_token", accessTokenString, 3600, true)    // 1 hour
	setCookie(c, "refresh_token", refreshTokenString, 604800, true) // 7 days

	// Generate CSRF token for double-submit cookie pattern
	csrfToken, err := generateCSRFToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate CSRF token"})
		return
	}
	setCookie(c, "csrf_token", csrfToken, 3600, false) // not HttpOnly so JS can read it

	audit.Log("login_success", fmt.Sprintf("user_id=%d github_login=%s", user.ID, ghUser.Login), c)

	// Redirect to frontend
	frontendURL := fmt.Sprintf("%s/auth/callback", ac.frontendURL)
	c.Redirect(http.StatusTemporaryRedirect, frontendURL)
}

// GetCurrentUser returns current user info
func (ac *AuthController) GetCurrentUser(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": gin.H{
		"id":         user.ID,
		"username":   user.Username,
		"email":      user.Email,
		"avatar_url": user.AvatarURL,
		"bio":        user.Bio,
		"role":       user.Role,
		"created_at": user.CreatedAt,
		"updated_at": user.UpdatedAt,
	}})
}

// RefreshToken refreshes the access token using a valid refresh token.
// The old refresh token is blocklisted in Redis to prevent reuse (rotation).
func (ac *AuthController) RefreshToken(c *gin.Context) {
	refreshTokenStr, err := c.Cookie("refresh_token")
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Refresh token not found"})
		return
	}

	// Check if the token has been revoked (fail-closed)
	if isRefreshTokenRevoked(refreshTokenStr) {
		audit.Log("token_revoked_used", "revoked refresh token presented", c)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Refresh token has been revoked"})
		return
	}

	token, err := jwt.Parse(refreshTokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(ac.cfg.JWT.Secret), nil
	})

	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid refresh token"})
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
		return
	}

	// Verify it's a refresh token
	tokenType, ok := claims["type"].(string)
	if !ok || tokenType != "refresh" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token type"})
		return
	}

	userID := claims["sub"]

	// Verify user still exists
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	// Revoke the old refresh token now that we've validated it
	// (rotation: each refresh token can only be used once)
	if exp, ok := claims["exp"].(float64); ok {
		revokeRefreshToken(refreshTokenStr, time.Unix(int64(exp), 0))
	}

	now := time.Now()

	// Generate new access token (1 hour expiration)
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  user.ID,
		"role": user.Role,
		"type": "access",
		"exp":  now.Add(time.Hour).Unix(),
		"iat":  now.Unix(),
	})

	accessTokenString, err := accessToken.SignedString([]byte(ac.cfg.JWT.Secret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate access token"})
		return
	}

	// Generate new refresh token with rotation
	newRefreshJTI := uuid.New().String()
	newRefreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  user.ID,
		"type": "refresh",
		"jti":  newRefreshJTI,
		"exp":  now.Add(time.Hour * 24 * 7).Unix(),
		"iat":  now.Unix(),
	})

	newRefreshTokenString, err := newRefreshToken.SignedString([]byte(ac.cfg.JWT.Secret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate refresh token"})
		return
	}

	// Set new token cookies
	setCookie(c, "access_token", accessTokenString, 3600, true)
	setCookie(c, "refresh_token", newRefreshTokenString, 604800, true)

	// Generate new CSRF token
	csrfToken, err := generateCSRFToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate CSRF token"})
		return
	}
	setCookie(c, "csrf_token", csrfToken, 3600, false)

	c.JSON(http.StatusOK, gin.H{"message": "Token refreshed successfully", "csrf_token": csrfToken})
}

// Logout handles user logout — revokes the refresh token and clears cookies.
func (ac *AuthController) Logout(c *gin.Context) {
	// Revoke the refresh token if present
	if refreshTokenStr, err := c.Cookie("refresh_token"); err == nil && refreshTokenStr != "" {
		// Parse to get expiry for blocklist TTL
		if token, err := jwt.Parse(refreshTokenStr, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(ac.cfg.JWT.Secret), nil
		}); err == nil && token.Valid {
			if claims, ok := token.Claims.(jwt.MapClaims); ok {
				if exp, ok := claims["exp"].(float64); ok {
					revokeRefreshToken(refreshTokenStr, time.Unix(int64(exp), 0))
				}
			}
		}
	}

	// Clear cookies by setting max age to -1
	setCookie(c, "access_token", "", -1, true)
	setCookie(c, "refresh_token", "", -1, true)
	setCookie(c, "csrf_token", "", -1, false)
	audit.Log("logout", "user logged out", c)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}