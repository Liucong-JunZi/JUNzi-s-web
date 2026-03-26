package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/liucong/personal-website/internal/config"
	"github.com/liucong/personal-website/internal/middleware"
)

func Setup(cfg *config.Config) *gin.Engine {
	// Set Gin mode
	gin.SetMode(cfg.Server.Mode)

	// Create router
	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(middleware.CORS())

	// Static files
	router.Static("/uploads", "./uploads")

	// API routes
	api := router.Group("/api")
	{
		// Health check
		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok"})
		})

		// Public routes
		// Posts
		api.GET("/posts", nil)           // List posts
		api.GET("/posts/:slug", nil)      // Get post by slug

		// Projects
		api.GET("/projects", nil)         // List projects
		api.GET("/projects/:id", nil)     // Get project

		// Resume
		api.GET("/resume", nil)           // Get resume items

		// Comments
		api.GET("/posts/:slug/comments", nil) // List comments

		// Auth routes
		auth := api.Group("/auth")
		{
			auth.GET("/github", nil)                      // GitHub OAuth redirect
			auth.GET("/github/callback", nil)             // GitHub OAuth callback
			auth.POST("/logout", nil)                     // Logout
			auth.GET("/me", nil)                          // Get current user
		}

		// Protected routes (require authentication)
		protected := api.Group("")
		protected.Use(middleware.AuthRequired(cfg))
		{
			// Admin routes
			admin := protected.Group("/admin")
			admin.Use(middleware.AdminRequired())
			{
				// Posts management
				admin.POST("/posts", nil)
				admin.PUT("/posts/:id", nil)
				admin.DELETE("/posts/:id", nil)

				// Projects management
				admin.POST("/projects", nil)
				admin.PUT("/projects/:id", nil)
				admin.DELETE("/projects/:id", nil)

				// Resume management
				admin.POST("/resume", nil)
				admin.PUT("/resume/:id", nil)
				admin.DELETE("/resume/:id", nil)

				// Comments management
				admin.GET("/comments", nil)
				admin.PUT("/comments/:id/status", nil)
				admin.DELETE("/comments/:id", nil)

				// Settings
				admin.GET("/settings", nil)
				admin.PUT("/settings", nil)

				// Upload
				admin.POST("/upload", nil)
			}

			// User routes (authenticated users)
			protected.POST("/comments", nil) // Create comment
		}
	}

	return router
}