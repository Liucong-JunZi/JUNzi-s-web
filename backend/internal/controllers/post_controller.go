package controllers

import (
	"log"
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
	Title      *string `json:"title"`
	Slug       *string `json:"slug"`
	Content    *string `json:"content"`
	Summary    *string `json:"summary"`
	CoverImage *string `json:"cover_image"`
	Status     *string `json:"status"`
	CategoryID uint    `json:"category_id"`
	Tags       []uint  `json:"tags"`
}

// ListPosts lists all posts with pagination
func (pc *PostController) ListPosts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", c.DefaultQuery("limit", "10")))
	page, pageSize = sanitizePagination(page, pageSize)
	categoryID := c.Query("category_id")
	tagID := c.Query("tag_id")
	tag := c.Query("tag")
	search := c.Query("search")

	offset := (page - 1) * pageSize

	query := database.DB.Model(&models.Post{}).Preload("Author").Preload("Category").Preload("Tags")

	// Always force published status for public endpoint — ignore any client-supplied status param
	query = query.Where("status = ?", "published")

	if categoryID != "" {
		query = query.Where("category_id = ?", categoryID)
	}

	// Support both tag_id and tag query params
	if tagID != "" {
		query = query.Joins("JOIN post_tags ON post_tags.post_id = posts.id AND post_tags.tag_id = ?", tagID)
	} else if tag != "" {
		query = query.Joins("JOIN post_tags ON post_tags.post_id = posts.id").Joins("JOIN tags ON tags.id = post_tags.tag_id AND tags.slug = ?", tag)
	}

	// Search on title and content
	if search != "" {
		query = query.Where("title LIKE ? OR content LIKE ?", "%"+search+"%", "%"+search+"%")
	}

	var total int64
	query.Count(&total)

	var posts []models.Post
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&posts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch posts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"posts":     toPublicPosts(posts),
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// AdminListPosts lists all posts for admin (no default status filter)
func (pc *PostController) AdminListPosts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", c.DefaultQuery("limit", "10")))
	page, pageSize = sanitizePagination(page, pageSize)
	status := c.Query("status")
	categoryID := c.Query("category_id")
	tagID := c.Query("tag_id")
	tag := c.Query("tag")
	search := c.Query("search")

	offset := (page - 1) * pageSize

	query := database.DB.Model(&models.Post{}).Preload("Author").Preload("Category").Preload("Tags")

	if status != "" {
		query = query.Where("status = ?", status)
	}
	// No default status filter for admin — return all posts

	if categoryID != "" {
		query = query.Where("category_id = ?", categoryID)
	}

	if tagID != "" {
		query = query.Joins("JOIN post_tags ON post_tags.post_id = posts.id AND post_tags.tag_id = ?", tagID)
	} else if tag != "" {
		query = query.Joins("JOIN post_tags ON post_tags.post_id = posts.id").Joins("JOIN tags ON tags.id = post_tags.tag_id AND tags.slug = ?", tag)
	}

	if search != "" {
		query = query.Where("title LIKE ? OR content LIKE ?", "%"+search+"%", "%"+search+"%")
	}

	var total int64
	query.Count(&total)

	var posts []models.Post
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&posts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch posts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"posts":     posts,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetPostBySlug gets a single post by slug
func (pc *PostController) GetPostBySlug(c *gin.Context) {
	slug := c.Param("slug")

	var post models.Post
	if err := database.DB.Preload("Author").Preload("Category").Preload("Tags").
		Where("slug = ? AND status = ?", slug, "published").First(&post).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	// Increment view count atomically to avoid race condition
	if err := database.DB.Model(&models.Post{}).Where("id = ?", post.ID).
		UpdateColumn("view_count", database.DB.Raw("view_count + 1")).Error; err != nil {
		// Log but don't fail the request — post content is still valid.
		// The returned view_count reflects the actual DB value.
		log.Printf("WARN: failed to increment view_count for post %d: %v", post.ID, err)
	} else {
		post.ViewCount++
	}

	c.JSON(http.StatusOK, gin.H{"post": toPublicPost(&post)})
}

// GetPostByID gets a single post by ID (admin only)
func (pc *PostController) GetPostByID(c *gin.Context) {
	id := c.Param("id")

	var post models.Post
	if err := database.DB.Preload("Author").Preload("Category").Preload("Tags").
		First(&post, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

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
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Slug != nil {
		updates["slug"] = *req.Slug
	}
	if req.Content != nil {
		updates["content"] = *req.Content
	}
	if req.Summary != nil {
		updates["summary"] = *req.Summary
	}
	if req.CoverImage != nil {
		updates["cover_image"] = *req.CoverImage
	}
	if req.Status != nil {
		updates["status"] = *req.Status
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

// LikePost increments the like count for a published post
func (pc *PostController) LikePost(c *gin.Context) {
	id := c.Param("id")

	var post models.Post
	if err := database.DB.Where("status = ?", "published").First(&post, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	// Increment like count atomically
	if err := database.DB.Model(&models.Post{}).Where("id = ?", post.ID).
		UpdateColumn("like_count", database.DB.Raw("COALESCE(like_count, 0) + 1")).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update like count"})
		return
	}

	// Reload to get updated like_count
	database.DB.First(&post, post.ID)

	c.JSON(http.StatusOK, gin.H{"message": "Post liked successfully", "like_count": post.LikeCount})
}