package routes

import (
	"log"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/liucong/personal-website/internal/cache"
	"github.com/liucong/personal-website/internal/config"
	"github.com/liucong/personal-website/internal/controllers"
	"github.com/liucong/personal-website/internal/middleware"
)

func Setup(cfg *config.Config) *gin.Engine {
	// Set Gin mode
	gin.SetMode(cfg.Server.Mode)

	// Create router
	router := gin.New()

	// Configure trusted proxies: use X-Real-IP header set by Nginx proxy
	// In Docker, Nginx runs in a separate container (not 127.0.0.1), so we
	// trust the header directly rather than listing specific proxy IPs.
	// Only trust X-Real-IP header in production (behind Nginx proxy).
	// In debug mode, accept direct connections without proxy header spoofing risk.
	if cfg.Server.Mode == "release" {
		router.TrustedPlatform = "X-Real-IP"
		// Only trust X-Real-IP from the Docker internal network (Nginx proxy).
		// Default: 172.16.0.0/12 covers Docker's default bridge subnet range.
		if cfg.Server.TrustedProxies != "" {
			proxies := strings.Split(cfg.Server.TrustedProxies, ",")
			for i := range proxies {
				proxies[i] = strings.TrimSpace(proxies[i])
			}
			if err := router.SetTrustedProxies(proxies); err != nil {
				router.TrustedPlatform = ""
			}
		}
	}

	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(middleware.CORS())

	// Add rate limiting middleware — relaxed in test mode to avoid E2E flakiness
	// (all Playwright workers share the same IP in Docker network)
	rateLimit := 100
	if os.Getenv("TEST_MODE") == "true" {
		rateLimit = 10000
	}
	router.Use(middleware.RateLimiterWithConfig(cache.Client, rateLimit))

	// Static files
	router.Static("/uploads", "./uploads")

	// Initialize controllers
	authController := controllers.NewAuthController(cfg)
	postController := controllers.NewPostController()
	projectController := controllers.NewProjectController()
	resumeController := controllers.NewResumeController()
	commentController := controllers.NewCommentController()
	settingController := controllers.NewSettingController()
	uploadController := controllers.NewUploadController(cfg)
	categoryController := controllers.NewCategoryController()
	tagController := controllers.NewTagController()

	// API routes
	api := router.Group("/api")
	{
		// Health check
		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok", "timestamp": time.Now().Unix()})
		})

		// Public routes
		// Posts
		api.GET("/posts", postController.ListPosts)
		api.GET("/posts/:slug", middleware.OptionalAuth(cfg), postController.GetPostBySlug)

		// Projects
		api.GET("/projects", projectController.ListProjects)
		api.GET("/projects/:id", projectController.GetProject)

		// Resume
		api.GET("/resume", resumeController.ListResume)

		// Comments
		api.GET("/posts/:slug/comments", commentController.ListComments)

		// Categories & Tags
		api.GET("/categories", categoryController.ListCategories)
		api.GET("/categories/:id", categoryController.GetCategory)
		api.GET("/tags", tagController.ListTags)
		api.GET("/tags/:id", tagController.GetTag)

		// Public settings
		api.GET("/settings/public", settingController.GetPublicSettings)

		// Test-only login endpoint (bypasses GitHub OAuth). Registered on the
		// api group (not the stricter auth group) to avoid E2E rate-limit issues.
		// Only available when TEST_MODE=true.
		if os.Getenv("TEST_MODE") == "true" {
			log.Println("[TEST MODE] /api/auth/test-login endpoint registered")
			api.POST("/auth/test-login", controllers.TestLoginHandler(cfg))
		}

		// Auth routes — relaxed rate limit in test mode
		authRateLimit := 10
		if os.Getenv("TEST_MODE") == "true" {
			authRateLimit = 10000
		}
		auth := api.Group("/auth")
		auth.Use(middleware.RateLimiter(cache.Client, authRateLimit, time.Minute))
		{
			auth.GET("/github", authController.GitHubRedirect)
			auth.GET("/github/callback", authController.GitHubCallback)
			auth.POST("/logout", middleware.CSRFProtection(), authController.Logout)
			// /refresh uses Origin/Referer check instead of double-submit CSRF —
			// the csrf_token cookie expires alongside the access_token so the
			// standard CSRF check would always fail when refresh is actually needed.
			auth.POST("/refresh", middleware.OriginRefererCheck(), authController.RefreshToken)
			auth.GET("/me", middleware.AuthRequired(cfg), authController.GetCurrentUser)
		}

		// Protected routes (require authentication)
		protected := api.Group("")
		protected.Use(middleware.AuthRequired(cfg))
		{
			// User routes (authenticated users)
			commentRateLimit := 20
		if os.Getenv("TEST_MODE") == "true" {
			commentRateLimit = 10000
		}
		protected.POST("/comments", middleware.CSRFProtection(), middleware.RateLimiter(cache.Client, commentRateLimit, time.Minute), commentController.CreateComment)
		protected.POST("/posts/:id/like", middleware.CSRFProtection(), postController.LikePost)

			// Admin routes
			admin := protected.Group("/admin")
			admin.Use(middleware.AdminRequired())
			admin.Use(middleware.CSRFProtection())
			{
				// Posts management
				admin.GET("/posts/:id", postController.GetPostByID)
				admin.POST("/posts", postController.CreatePost)
				admin.PUT("/posts/:id", postController.UpdatePost)
				admin.DELETE("/posts/:id", postController.DeletePost)

				// Projects management
				admin.GET("/projects/:id", projectController.GetProjectAdmin)
				admin.POST("/projects", projectController.CreateProject)
				admin.PUT("/projects/:id", projectController.UpdateProject)
				admin.GET("/posts", postController.AdminListPosts)
				admin.GET("/projects", projectController.AdminListProjects)
				admin.DELETE("/projects/:id", projectController.DeleteProject)

				// Resume management
				admin.POST("/resume", resumeController.CreateResume)
				admin.PUT("/resume/:id", resumeController.UpdateResume)
				admin.DELETE("/resume/:id", resumeController.DeleteResume)

				// Comments management
				admin.GET("/comments", commentController.ListAllComments)
				admin.PUT("/comments/:id", commentController.UpdateComment)
				admin.PUT("/comments/:id/status", commentController.UpdateCommentStatus)
				admin.DELETE("/comments/:id", commentController.DeleteComment)

				// Categories management
				admin.POST("/categories", categoryController.CreateCategory)
				admin.PUT("/categories/:id", categoryController.UpdateCategory)
				admin.DELETE("/categories/:id", categoryController.DeleteCategory)

				// Tags management
				admin.POST("/tags", tagController.CreateTag)
				admin.PUT("/tags/:id", tagController.UpdateTag)
				admin.DELETE("/tags/:id", tagController.DeleteTag)

				// Settings
				admin.GET("/settings", settingController.GetSettings)
				admin.PUT("/settings", settingController.UpdateSettings)
				admin.PUT("/settings/:key", settingController.UpdateSetting)

				// Upload
				admin.POST("/upload", uploadController.UploadFile)
				admin.POST("/upload/image", uploadController.UploadImage)
			}
		}
	}

	return router
}