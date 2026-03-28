package controllers

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/liucong/personal-website/internal/audit"
	"github.com/liucong/personal-website/internal/config"
	"github.com/liucong/personal-website/internal/database"
	"github.com/liucong/personal-website/internal/models"
	"gorm.io/gorm"
)

// testLoginRequest is the JSON body expected by POST /api/auth/test-login.
type testLoginRequest struct {
	Role string `json:"role" binding:"required,oneof=admin user"`
}

// testSetCookie replicates the unexported setCookie helper from auth_controller.go.
// It sets a cookie with SameSite=Lax and appropriate Secure flag.
func testSetCookie(c *gin.Context, name, value string, maxAge int, httpOnly bool) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     name,
		Value:    value,
		MaxAge:   maxAge,
		Path:     "/",
		// TEST_MODE bypasses OAuth — always use insecure cookies so
		// Playwright API contexts work over plain HTTP in CI.
		Secure:   false,
		HttpOnly: httpOnly,
		SameSite: http.SameSiteLaxMode,
	})
}

// TestLoginHandler returns a gin.HandlerFunc that creates a test user and issues
// real JWT tokens. The handler checks TEST_MODE at request time as defense-in-depth;
// route registration also gates on TEST_MODE (see routes.go).
func TestLoginHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Defense-in-depth: reject even if route is somehow registered without the gate.
		if os.Getenv("TEST_MODE") != "true" {
			c.JSON(http.StatusForbidden, gin.H{"error": "test mode is not enabled"})
			return
		}

		var req testLoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "role must be \"admin\" or \"user\""})
			return
		}

		githubID := "test_" + req.Role
		username := "test_" + req.Role + "_user"
		email := "test_" + req.Role + "_user@test.junzi.local"

		// Find or create the test user (same upsert pattern as GitHubCallback).
		var user models.User
		result := database.DB.Where("github_id = ?", githubID).First(&user)

		if result.Error == gorm.ErrRecordNotFound {
			user = models.User{
				GitHubID: githubID,
				Username: username,
				Email:    email,
				Role:     req.Role,
			}
			if err := database.DB.Create(&user).Error; err != nil {
				audit.Log("test_login", fmt.Sprintf("create_user_failed role=%s err=%s", req.Role, err), c)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create test user"})
				return
			}
		} else if result.Error != nil {
			audit.Log("test_login", fmt.Sprintf("db_error role=%s err=%s", req.Role, result.Error), c)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		// --- Token generation (mirrors auth_controller.go GitHubCallback lines 251-294) ---

		now := time.Now()

		// Access token: sub=user.ID, role=user.Role, type="access", exp=1hr, iat=now
		accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub":  user.ID,
			"role": user.Role,
			"type": "access",
			"exp":  now.Add(time.Hour).Unix(),
			"iat":  now.Unix(),
		})
		accessTokenString, err := accessToken.SignedString([]byte(cfg.JWT.Secret))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate access token"})
			return
		}

		// Refresh token: sub=user.ID, type="refresh", jti=uuid, exp=7d, iat=now
		refreshJTI := uuid.New().String()
		refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub":  user.ID,
			"type": "refresh",
			"jti":  refreshJTI,
			"exp":  now.Add(time.Hour * 24 * 7).Unix(),
			"iat":  now.Unix(),
		})
		refreshTokenString, err := refreshToken.SignedString([]byte(cfg.JWT.Secret))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate refresh token"})
			return
		}

		// Set HttpOnly cookies (same MaxAge values as GitHubCallback).
		testSetCookie(c, "access_token", accessTokenString, 3600, true)   // 1 hour
		testSetCookie(c, "refresh_token", refreshTokenString, 604800, true) // 7 days

		// CSRF token: random 32 bytes, base64 RawURL encoded (same as generateCSRFToken).
		csrfBytes := make([]byte, 32)
		if _, err := rand.Read(csrfBytes); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate CSRF token"})
			return
		}
		csrfToken := base64.RawURLEncoding.EncodeToString(csrfBytes)
		testSetCookie(c, "csrf_token", csrfToken, 3600, false) // not HttpOnly so JS can read it

		audit.Log("test_login", fmt.Sprintf("user_id=%d role=%s", user.ID, req.Role), c)

		c.JSON(http.StatusOK, gin.H{
			"user": gin.H{
				"id":         user.ID,
				"github_id":  user.GitHubID,
				"username":   user.Username,
				"email":      user.Email,
				"avatar_url": user.AvatarURL,
				"bio":        user.Bio,
				"role":       user.Role,
				"created_at": user.CreatedAt,
				"updated_at": user.UpdatedAt,
			},
			"csrf_token": csrfToken,
		})
	}
}
