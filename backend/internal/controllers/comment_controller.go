package controllers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/liucong/personal-website/internal/database"
	"github.com/liucong/personal-website/internal/models"
)

type CommentController struct{}

func NewCommentController() *CommentController {
	return &CommentController{}
}

type CreateCommentRequest struct {
	Content  string `json:"content" binding:"required"`
	PostID   uint   `json:"post_id" binding:"required"`
	ParentID *uint  `json:"parent_id"`
}

type UpdateCommentStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type UpdateCommentRequest struct {
	Content string `json:"content" binding:"required"`
}

// ListComments lists comments for a post (public)
func (cc *CommentController) ListComments(c *gin.Context) {
	slug := c.Param("slug")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	offset := (page - 1) * pageSize

	// Get post ID from slug — only allow published posts
	var post models.Post
	if err := database.DB.Where("slug = ? AND status = ?", slug, "published").First(&post).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	query := database.DB.Model(&models.Comment{}).
		Where("post_id = ? AND status = ? AND parent_id IS NULL", post.ID, "approved").
		Preload("User").
		Preload("Replies", "status = ?", "approved").Preload("Replies.User")

	var total int64
	query.Count(&total)

	var comments []models.Comment
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&comments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch comments"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"comments":  comments,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// CreateComment creates a new comment (authenticated users)
func (cc *CommentController) CreateComment(c *gin.Context) {
	var req CreateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")

	// Verify post exists and is published
	var post models.Post
	if err := database.DB.Where("id = ? AND status = ?", req.PostID, "published").First(&post).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	comment := models.Comment{
		Content: req.Content,
		PostID:  &req.PostID,
		UserID:  userID.(uint),
		Status:  "pending", // Comments need approval
	}

	if req.ParentID != nil {
		// Verify parent comment belongs to the same post to prevent cross-post tree pollution
		var parentComment models.Comment
		if err := database.DB.First(&parentComment, *req.ParentID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parent comment not found"})
			return
		}
		if parentComment.PostID == nil || *parentComment.PostID != req.PostID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parent comment does not belong to the specified post"})
			return
		}
		comment.ParentID = req.ParentID
	}

	if err := database.DB.Create(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create comment"})
		return
	}

	// Reload with associations
	database.DB.Preload("User").First(&comment, comment.ID)

	c.JSON(http.StatusCreated, gin.H{"comment": comment})
}

// ListAllComments lists all comments (admin only)
func (cc *CommentController) ListAllComments(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", c.DefaultQuery("limit", "100")))
	status := c.Query("status")

	offset := (page - 1) * pageSize

	query := database.DB.Model(&models.Comment{}).
		Preload("User").
		Preload("Post")

	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var comments []models.Comment
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&comments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch comments"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"comments":  comments,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// UpdateCommentStatus updates comment status (admin only)
func (cc *CommentController) UpdateCommentStatus(c *gin.Context) {
	id := c.Param("id")

	var comment models.Comment
	if err := database.DB.First(&comment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
		return
	}

	var req UpdateCommentStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Status != "pending" && req.Status != "approved" && req.Status != "rejected" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
		return
	}

	if err := database.DB.Model(&comment).Update("status", req.Status).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update comment status"})
		return
	}

	database.DB.Preload("User").First(&comment, comment.ID)

	c.JSON(http.StatusOK, gin.H{"comment": comment})
}

// UpdateComment updates comment content (admin only)
func (cc *CommentController) UpdateComment(c *gin.Context) {
	id := c.Param("id")

	var comment models.Comment
	if err := database.DB.First(&comment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
		return
	}

	var req UpdateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := database.DB.Model(&comment).Update("content", req.Content).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update comment"})
		return
	}

	database.DB.Preload("User").First(&comment, comment.ID)

	c.JSON(http.StatusOK, gin.H{"comment": comment})
}

// DeleteComment deletes a comment (admin only)
func (cc *CommentController) DeleteComment(c *gin.Context) {
	id := c.Param("id")

	var comment models.Comment
	if err := database.DB.First(&comment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
		return
	}

	if err := database.DB.Delete(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete comment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Comment deleted successfully"})
}