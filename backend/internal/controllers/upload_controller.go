package controllers

import (
	"bytes"
	"fmt"
	"mime/multipart"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/liucong/personal-website/internal/config"
	"github.com/liucong/personal-website/internal/storage"
)

type UploadController struct {
	cfg *config.Config
}

func NewUploadController(cfg *config.Config) *UploadController {
	return &UploadController{cfg: cfg}
}

// UploadFile handles file upload
func (uc *UploadController) UploadFile(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File is required"})
		return
	}

	// Validate file size (max 10MB)
	if file.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File size exceeds 10MB limit"})
		return
	}

	result, err := storage.UploadFile(c.Request.Context(), &uc.cfg.MinIO, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "File uploaded successfully",
		"url":      result.URL,
		"filename": result.Filename,
		"size":     result.Size,
	})
}

// UploadImage handles image upload
func (uc *UploadController) UploadImage(c *gin.Context) {
	// Support both "file" and "image" field names for backward compatibility
	file, err := c.FormFile("file")
	if err != nil {
		file, err = c.FormFile("image")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Image is required (use 'file' or 'image' field)"})
			return
		}
	}

	// Validate file size (max 5MB)
	if file.Size > 5*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Image size exceeds 5MB limit"})
		return
	}

	// Validate content type
	contentType := file.Header.Get("Content-Type")
	if contentType != "image/jpeg" && contentType != "image/png" && contentType != "image/gif" && contentType != "image/webp" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only JPEG, PNG, GIF, and WebP images are allowed"})
		return
	}

	// Validate actual file content (not just Content-Type header which can be forged)
	if err := validateImageContent(file); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := storage.UploadFile(c.Request.Context(), &uc.cfg.MinIO, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload image"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Image uploaded successfully",
		"url":      result.URL,
		"filename": result.Filename,
		"size":     result.Size,
	})
}

// validateImageContent reads the file content to verify it's actually an image
// by checking magic bytes, not just the Content-Type header.
func validateImageContent(fileHeader *multipart.FileHeader) error {
	src, err := fileHeader.Open()
	if err != nil {
		return fmt.Errorf("failed to open file for validation")
	}
	defer src.Close()

	buf := make([]byte, 512)
	n, err := src.Read(buf)
	if err != nil {
		return fmt.Errorf("failed to read file content")
	}
	if n < 12 {
		return fmt.Errorf("file too small to be a valid image")
	}

	// Check magic bytes for each image format
	switch {
	case bytes.HasPrefix(buf[:n], []byte{0xFF, 0xD8, 0xFF}):
		// JPEG
	case bytes.HasPrefix(buf[:n], []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}):
		// PNG
	case bytes.HasPrefix(buf[:n], []byte("GIF87a")) || bytes.HasPrefix(buf[:n], []byte("GIF89a")):
		// GIF
	case bytes.HasPrefix(buf[:n], []byte("RIFF")) && n >= 12 && string(buf[8:12]) == "WEBP":
		// WebP
	default:
		return fmt.Errorf("file content is not a valid JPEG, PNG, GIF, or WebP image")
	}
	return nil
}