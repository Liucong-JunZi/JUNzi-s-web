package storage

import (
	"context"
	"fmt"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"github.com/liucong/personal-website/internal/config"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/google/uuid"
)

var MinioClient *minio.Client

func Connect(cfg *config.MinIOConfig) error {
	var err error
	MinioClient, err = minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return fmt.Errorf("failed to connect minio: %w", err)
	}

	// Create bucket if not exists
	ctx := context.Background()
	exists, err := MinioClient.BucketExists(ctx, cfg.Bucket)
	if err != nil {
		return fmt.Errorf("failed to check bucket: %w", err)
	}
	if !exists {
		if err := MinioClient.MakeBucket(ctx, cfg.Bucket, minio.MakeBucketOptions{}); err != nil {
			return fmt.Errorf("failed to create bucket: %w", err)
		}
	}

	return nil
}

type UploadResult struct {
	URL      string `json:"url"`
	Filename string `json:"filename"`
	Size     int64  `json:"size"`
}

func UploadFile(ctx context.Context, cfg *config.MinIOConfig, file *multipart.FileHeader) (*UploadResult, error) {
	src, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer src.Close()

	// Generate unique filename
	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	objectName := fmt.Sprintf("%d/%s", time.Now().Year(), filename)

	// Upload to MinIO
	info, err := MinioClient.PutObject(ctx, cfg.Bucket, objectName, src, file.Size, minio.PutObjectOptions{
		ContentType: file.Header.Get("Content-Type"),
	})
	if err != nil {
		return nil, err
	}

	// Generate URL
	var fileURL string
	if cfg.PublicURL != "" {
		fileURL = fmt.Sprintf("%s/%s/%s", strings.TrimRight(cfg.PublicURL, "/"), cfg.Bucket, objectName)
	} else {
		scheme := "http"
		if cfg.UseSSL {
			scheme = "https"
		}
		fileURL = fmt.Sprintf("%s://%s/%s/%s", scheme, cfg.Endpoint, cfg.Bucket, objectName)
	}

	return &UploadResult{
		URL:      fileURL,
		Filename: filename,
		Size:     info.Size,
	}, nil
}

func DeleteFile(ctx context.Context, cfg *config.MinIOConfig, objectName string) error {
	return MinioClient.RemoveObject(ctx, cfg.Bucket, objectName, minio.RemoveObjectOptions{})
}
