package controllers

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/liucong/personal-website/internal/database"
	"github.com/liucong/personal-website/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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
	CategoryID *uint  `json:"category_id"`
	Tags       []uint `json:"tags"`
}

type UpdatePostRequest struct {
	Title      *string `json:"title"`
	Slug       *string `json:"slug"`
	Content    *string `json:"content"`
	Summary    *string `json:"summary"`
	CoverImage *string `json:"cover_image"`
	Status     *string `json:"status"`
	CategoryID *uint   `json:"category_id"`
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

	userID, _ := c.Get("userID")
	if uid, ok := userID.(uint); ok {
		c.JSON(http.StatusOK, gin.H{"post": toPublicPostWithLike(&post, uid)})
	} else {
		c.JSON(http.StatusOK, gin.H{"post": toPublicPost(&post)})
	}
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

	// Treat category_id=0 (or absent) as NULL so the foreign key constraint is not violated.
	categoryID := req.CategoryID
	if categoryID != nil && *categoryID == 0 {
		categoryID = nil
	}

	post := models.Post{
		Title:      req.Title,
		Slug:       req.Slug,
		Content:    req.Content,
		Summary:    req.Summary,
		CoverImage: req.CoverImage,
		Status:     req.Status,
		AuthorID:   userID.(uint),
		CategoryID: categoryID,
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
	if req.CategoryID != nil {
		if *req.CategoryID == 0 {
			updates["category_id"] = nil
		} else {
			updates["category_id"] = *req.CategoryID
		}
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

var errLikePostNotFound = errors.New("published post not found")

// LikePost toggles the like for a published post (authenticated users only).
// The post row is locked for the whole transaction so concurrent toggles for
// the same post cannot both observe the same pre-mutation state.
func (pc *PostController) LikePost(c *gin.Context) {
	id := c.Param("id")
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	uid := userID.(uint)

	var post models.Post
	liked := false
	if err := database.DB.Transaction(func(tx *gorm.DB) error {
		// Lock the post before inspecting the like. Every toggle for this post
		// therefore observes the result committed by the previous toggle.
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("status = ?", "published").First(&post, id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errLikePostNotFound
			}
			return err
		}

		var existingLike models.UserLike
		result := tx.Where("user_id = ? AND post_id = ?", uid, post.ID).First(&existingLike)
		switch {
		case result.Error == nil:
			// Already liked → unlike. A failed delete aborts the transaction, so
			// the counter is never changed without removing the like row.
			deleteResult := tx.Delete(&existingLike)
			if deleteResult.Error != nil {
				return deleteResult.Error
			}
			if deleteResult.RowsAffected != 1 {
				return errors.New("like row was not deleted")
			}
			if err := tx.Model(&models.Post{}).Where("id = ?", post.ID).
				UpdateColumn("like_count", tx.Raw("GREATEST(COALESCE(like_count, 0) - 1, 0)")).Error; err != nil {
				return err
			}
			liked = false
		case errors.Is(result.Error, gorm.ErrRecordNotFound):
			// Not liked → like. The unique index remains a final safeguard for
			// writes coming from outside this handler; on failure the transaction
			// rolls back and the counter is left untouched.
			createResult := tx.Create(&models.UserLike{UserID: uid, PostID: post.ID})
			if createResult.Error != nil {
				return createResult.Error
			}
			if createResult.RowsAffected != 1 {
				return errors.New("like row was not created")
			}
			if err := tx.Model(&models.Post{}).Where("id = ?", post.ID).
				UpdateColumn("like_count", tx.Raw("COALESCE(like_count, 0) + 1")).Error; err != nil {
				return err
			}
			liked = true
		default:
			return result.Error
		}

		return tx.First(&post, post.ID).Error
	}); err != nil {
		if errors.Is(err, errLikePostNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
			return
		}
		log.Printf("WARN: failed to toggle like for post %s and user %d: %v", id, uid, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update like"})
		return
	}

	if liked {
		c.JSON(http.StatusOK, gin.H{"message": "Post liked successfully", "like_count": post.LikeCount, "liked": true})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Post unliked", "like_count": post.LikeCount, "liked": false})
}
