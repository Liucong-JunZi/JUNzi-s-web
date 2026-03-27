package controllers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/liucong/personal-website/internal/database"
	"github.com/liucong/personal-website/internal/models"
)

type PostController struct{}

func NewPostController() *PostController {
	return &PostController{}
}

type CreatePostRequest struct {
	Title      string `json:"title" binding:"required"`
	Slug       string `json:"slug" binding:"required"`
	Content    string `json:"content" binding:"required"`
	Summary    string `json:"summary"`
	CoverImage string `json:"cover_image"`
	Status     string `json:"status"`
	CategoryID uint   `json:"category_id"`
	Tags       []uint `json:"tags"`
}

type UpdatePostRequest struct {
	Title      string `json:"title"`
	Slug       string `json:"slug"`
	Content    string `json:"content"`
	Summary    string `json:"summary"`
	CoverImage string `json:"cover_image"`
	Status     string `json:"status"`
	CategoryID uint   `json:"category_id"`
	Tags       []uint `json:"tags"`
}

// ListPosts lists all posts with pagination
func (pc *PostController) ListPosts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	status := c.Query("status")
	categoryID := c.Query("category_id")
	tagID := c.Query("tag_id")

	offset := (page - 1) * pageSize

	query := database.DB.Model(&models.Post{}).Preload("Author").Preload("Category").Preload("Tags")

	if status != "" {
		query = query.Where("status = ?", status)
	} else {
		// Default to published for public requests
		query = query.Where("status = ?", "published")
	}

	if categoryID != "" {
		query = query.Where("category_id = ?", categoryID)
	}

	if tagID != "" {
		query = query.Joins("JOIN post_tags ON post_tags.post_id = posts.id AND post_tags.tag_id = ?", tagID)
	}

	var total int64
	query.Count(&total)

	var posts []models.Post
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&posts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch posts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"posts": posts,
		"total": total,
		"page":  page,
		"page_size": pageSize,
	})
}

// GetPostBySlug gets a single post by slug
func (pc *PostController) GetPostBySlug(c *gin.Context) {
	slug := c.Param("slug")

	var post models.Post
	if err := database.DB.Preload("Author").Preload("Category").Preload("Tags").
		Where("slug = ?", slug).First(&post).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	// Increment view count
	database.DB.Model(&post).Update("view_count", post.ViewCount+1)

	c.JSON(http.StatusOK, gin.H{"post": post})
}

// CreatePost creates a new post (admin only)
func (pc *PostController) CreatePost(c *gin.Context) {
	var req CreatePostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")

	post := models.Post{
		Title:      req.Title,
		Slug:       req.Slug,
		Content:    req.Content,
		Summary:    req.Summary,
		CoverImage: req.CoverImage,
		Status:     req.Status,
		AuthorID:   userID.(uint),
		CategoryID: req.CategoryID,
	}

	if post.Status == "" {
		post.Status = "draft"
	}

	// Handle tags
	if len(req.Tags) > 0 {
		var tags []models.Tag
		database.DB.Find(&tags, req.Tags)
		post.Tags = tags
	}

	if err := database.DB.Create(&post).Error; err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			c.JSON(http.StatusConflict, gin.H{"error": "Post with this slug already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create post"})
		return
	}

	// Reload with associations
	database.DB.Preload("Author").Preload("Category").Preload("Tags").First(&post, post.ID)

	c.JSON(http.StatusCreated, gin.H{"post": post})
}

// UpdatePost updates a post (admin only)
func (pc *PostController) UpdatePost(c *gin.Context) {
	id := c.Param("id")

	var post models.Post
	if err := database.DB.First(&post, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	var req UpdatePostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Slug != "" {
		updates["slug"] = req.Slug
	}
	if req.Content != "" {
		updates["content"] = req.Content
	}
	if req.Summary != "" {
		updates["summary"] = req.Summary
	}
	if req.CoverImage != "" {
		updates["cover_image"] = req.CoverImage
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	if req.CategoryID != 0 {
		updates["category_id"] = req.CategoryID
	}

	if err := database.DB.Model(&post).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update post"})
		return
	}

	// Update tags
	if req.Tags != nil {
		var tags []models.Tag
		database.DB.Find(&tags, req.Tags)
		database.DB.Model(&post).Association("Tags").Replace(tags)
	}

	// Reload with associations
	database.DB.Preload("Author").Preload("Category").Preload("Tags").First(&post, post.ID)

	c.JSON(http.StatusOK, gin.H{"post": post})
}

// DeletePost deletes a post (admin only)
func (pc *PostController) DeletePost(c *gin.Context) {
	id := c.Param("id")

	var post models.Post
	if err := database.DB.First(&post, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	if err := database.DB.Delete(&post).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete post"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Post deleted successfully"})
}