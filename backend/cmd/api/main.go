package main

import (
	"log"

	"github.com/liucong/personal-website/internal/cache"
	"github.com/liucong/personal-website/internal/config"
	"github.com/liucong/personal-website/internal/database"
	"github.com/liucong/personal-website/internal/routes"
	"github.com/liucong/personal-website/internal/storage"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	if err := database.Connect(&cfg.Database); err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}
	log.Println("Database connected successfully")

	// Connect to Redis
	if err := cache.Connect(&cfg.Redis); err != nil {
		log.Fatalf("Failed to connect redis: %v", err)
	}
	log.Println("Redis connected successfully")

	// Connect to MinIO
	if err := storage.Connect(&cfg.MinIO); err != nil {
		log.Fatalf("Failed to connect MinIO: %v", err)
	}
	log.Println("MinIO connected successfully")

	// Initialize router
	router := routes.Setup(cfg)

	// Start server
	log.Printf("Server starting on port %s", cfg.Server.Port)
	if err := router.Run(":" + cfg.Server.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}