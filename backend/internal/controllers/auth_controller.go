package controllers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/liucong/personal-website/internal/cache"
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

// isSecureCookie returns true when running in production
func isSecureCookie() bool {
	return os.Getenv("APP_ENV") == "production"
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

	// Generate refresh token (7 days expiration)
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  user.ID,
		"type": "refresh",
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

	c.JSON(http.StatusOK, gin.H{"user": user})
}

// RefreshToken refreshes the access token using a valid refresh token
func (ac *AuthController) RefreshToken(c *gin.Context) {
	refreshTokenStr, err := c.Cookie("refresh_token")
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Refresh token not found"})
		return
	}

	token, err := jwt.Parse(refreshTokenStr, func(token *jwt.Token) (interface{}, error) {
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

	// Set new access token cookie
	setCookie(c, "access_token", accessTokenString, 3600, true)

	// Generate new CSRF token
	csrfToken, err := generateCSRFToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate CSRF token"})
		return
	}
	setCookie(c, "csrf_token", csrfToken, 3600, false)

	c.JSON(http.StatusOK, gin.H{"message": "Token refreshed successfully", "csrf_token": csrfToken})
}

// Logout handles user logout
func (ac *AuthController) Logout(c *gin.Context) {
	// Clear cookies by setting max age to -1
	setCookie(c, "access_token", "", -1, true)
	setCookie(c, "refresh_token", "", -1, true)
	setCookie(c, "csrf_token", "", -1, false)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}