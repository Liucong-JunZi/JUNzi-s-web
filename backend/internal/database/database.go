package database

import (
	"fmt"
	"os"

	"github.com/liucong/personal-website/internal/config"
	"github.com/liucong/personal-website/internal/models"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect(cfg *config.DatabaseConfig) error {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.User,
		cfg.Password,
		cfg.Host,
		cfg.Port,
		cfg.DBName,
	)

	var err error
	logLevel := logger.Info
	if os.Getenv("GIN_MODE") == "release" || os.Getenv("APP_ENV") == "production" {
		logLevel = logger.Warn
	}
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return fmt.Errorf("failed to connect database: %w", err)
	}

	// Auto migrate — in production, only create missing tables to avoid
	// ALTER-ing existing columns (GORM would change VARCHAR → longtext,
	// breaking indexes).  In development, run full AutoMigrate.
	autoMigrate := os.Getenv("AUTO_MIGRATE")
	isProd := os.Getenv("APP_ENV") == "production" || os.Getenv("GIN_MODE") == "release"
	if autoMigrate == "true" {
		if isProd {
			// Production: only create tables that don't exist yet.
			if err := DB.Exec(`CREATE TABLE IF NOT EXISTS user_likes (
				id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
				user_id BIGINT UNSIGNED NOT NULL,
				post_id BIGINT UNSIGNED NOT NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				UNIQUE INDEX idx_user_post_like (user_id, post_id),
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
				FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).Error; err != nil {
				return fmt.Errorf("failed to create user_likes table: %w", err)
			}
		} else {
			// Development: full AutoMigrate is safe (tables start empty).
			if err := DB.AutoMigrate(
				&models.User{},
				&models.Category{},
				&models.Tag{},
				&models.Post{},
				&models.Project{},
				&models.Resume{},
				&models.Comment{},
				&models.Setting{},
				&models.UserLike{},
			); err != nil {
				return fmt.Errorf("failed to migrate database: %w", err)
			}
		}
	} else if autoMigrate == "" && !isProd {
		if err := DB.AutoMigrate(
			&models.User{},
			&models.Category{},
			&models.Tag{},
			&models.Post{},
			&models.Project{},
			&models.Resume{},
			&models.Comment{},
			&models.Setting{},
			&models.UserLike{},
		); err != nil {
			return fmt.Errorf("failed to migrate database: %w", err)
		}
	} else {
		fmt.Println("AutoMigrate skipped (AUTO_MIGRATE=false)")
	}

	return nil
}

func GetDB() *gorm.DB {
	return DB
}
