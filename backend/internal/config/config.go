package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	MinIO    MinIOConfig
	GitHub   GitHubConfig
	JWT      JWTConfig
}

type ServerConfig struct {
	Port           string
	Mode           string
	TrustedProxies string
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
}

type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
}

type MinIOConfig struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	UseSSL    bool
	PublicURL string
}

type GitHubConfig struct {
	ClientID     string
	ClientSecret string
	CallbackURL  string
}

type JWTConfig struct {
	Secret string
}

func Load() (*Config, error) {
	// Load .env file if exists
	godotenv.Load()

	cfg := &Config{
		Server: ServerConfig{
			Port:           getEnv("SERVER_PORT", "8080"),
			Mode:           getEnv("GIN_MODE", "debug"),
			TrustedProxies: getEnv("TRUSTED_PROXIES", "172.16.0.0/12"),
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "3306"),
			User:     getEnv("DB_USER", "root"),
			Password: getEnv("DB_PASSWORD", ""),
			DBName:   getEnv("DB_NAME", "personal_website"),
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnv("REDIS_PORT", "6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       0,
		},
		MinIO: MinIOConfig{
			Endpoint:  getEnv("MINIO_ENDPOINT", "localhost:9000"),
			AccessKey: getEnv("MINIO_ACCESS_KEY", "minioadmin"),
			SecretKey: getEnv("MINIO_SECRET_KEY", "minioadmin"),
			Bucket:    getEnv("MINIO_BUCKET", "uploads"),
			UseSSL:    getEnv("MINIO_USE_SSL", "false") == "true",
			PublicURL: getEnv("MINIO_PUBLIC_URL", ""),
		},
		GitHub: GitHubConfig{
			ClientID:     getEnv("GITHUB_CLIENT_ID", ""),
			ClientSecret: getEnv("GITHUB_CLIENT_SECRET", ""),
			CallbackURL:  getEnv("GITHUB_CALLBACK_URL", "http://localhost:8080/api/auth/github/callback"),
		},
		JWT: JWTConfig{
			Secret: getEnv("JWT_SECRET", ""),
		},
	}

	return cfg, validate(cfg)
}

func validate(cfg *Config) error {
	if cfg.JWT.Secret == "" {
		return fmt.Errorf("JWT_SECRET environment variable must be set")
	}
	if len(cfg.JWT.Secret) < 32 {
		return fmt.Errorf("JWT_SECRET must be at least 32 characters long")
	}
	// Reject common placeholder patterns
	lower := strings.ToLower(cfg.JWT.Secret)
	placeholders := []string{"change_me", "change-me", "changeme", "your-secret", "secret-key", "example", "placeholder", "default", "test"}
	for _, p := range placeholders {
		if strings.Contains(lower, p) {
			return fmt.Errorf("JWT_SECRET appears to contain a placeholder value, please generate a real secret (e.g., openssl rand -base64 32)")
		}
	}
	// Check minimum entropy: must contain at least 3 distinct character categories
	var hasUpper, hasLower, hasDigit, hasSpecial bool
	for _, c := range cfg.JWT.Secret {
		switch {
		case c >= 'A' && c <= 'Z':
			hasUpper = true
		case c >= 'a' && c <= 'z':
			hasLower = true
		case c >= '0' && c <= '9':
			hasDigit = true
		default:
			hasSpecial = true
		}
	}
	categories := 0
	for _, has := range []bool{hasUpper, hasLower, hasDigit, hasSpecial} {
		if has {
			categories++
		}
	}
	if categories < 3 {
		return fmt.Errorf("JWT_SECRET is too weak: must contain characters from at least 3 categories (uppercase, lowercase, digits, special characters)")
	}

	// Production-specific security validations
	if os.Getenv("APP_ENV") == "production" || os.Getenv("GIN_MODE") == "release" {
		if cfg.MinIO.AccessKey == "minioadmin" && cfg.MinIO.SecretKey == "minioadmin" {
			return fmt.Errorf("MINIO_ACCESS_KEY and MINIO_SECRET_KEY must be changed from defaults in production")
		}
		if cfg.Database.Password == "" {
			return fmt.Errorf("DB_PASSWORD must be set in production")
		}
		if cfg.Redis.Password == "" {
			return fmt.Errorf("REDIS_PASSWORD must be set in production")
		}
	}

	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}