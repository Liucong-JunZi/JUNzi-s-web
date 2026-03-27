package controllers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/liucong/personal-website/internal/database"
	"github.com/liucong/personal-website/internal/models"
)

type ResumeController struct{}

func NewResumeController() *ResumeController {
	return &ResumeController{}
}

type CreateResumeRequest struct {
	Title       string     `json:"title" binding:"required"`
	Company     string      `json:"company"`
	Location    string      `json:"location"`
	StartDate   string      `json:"start_date" binding:"required"`
	EndDate     *string     `json:"end_date"`
	Description string      `json:"description"`
	Type        string      `json:"type" binding:"required"`
	SortOrder   int         `json:"sort_order"`
}

type UpdateResumeRequest struct {
	Title       string  `json:"title"`
	Company     string  `json:"company"`
	Location    string  `json:"location"`
	StartDate   string  `json:"start_date"`
	EndDate     *string `json:"end_date"`
	Description string  `json:"description"`
	Type        string  `json:"type"`
	SortOrder   *int    `json:"sort_order"`
}

// ListResume lists all resume items
func (rc *ResumeController) ListResume(c *gin.Context) {
	resumeType := c.Query("type")

	query := database.DB.Model(&models.Resume{})

	if resumeType != "" {
		query = query.Where("type = ?", resumeType)
	}

	var resumeItems []models.Resume
	if err := query.Order("sort_order ASC, start_date DESC").Find(&resumeItems).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch resume items"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"resume": resumeItems})
}

// GetResumeItem gets a single resume item
func (rc *ResumeController) GetResumeItem(c *gin.Context) {
	id := c.Param("id")

	var resume models.Resume
	if err := database.DB.First(&resume, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Resume item not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"resume": resume})
}

// CreateResume creates a new resume item (admin only)
func (rc *ResumeController) CreateResume(c *gin.Context) {
	var req CreateResumeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	startDate, err := parseDate(req.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_date format"})
		return
	}

	resume := models.Resume{
		Title:       req.Title,
		Company:     req.Company,
		Location:    req.Location,
		StartDate:   startDate,
		Description: req.Description,
		Type:        req.Type,
		SortOrder:   req.SortOrder,
	}

	if req.EndDate != nil && *req.EndDate != "" {
		endDate, err := parseDate(*req.EndDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end_date format"})
			return
		}
		resume.EndDate = &endDate
	}

	if err := database.DB.Create(&resume).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create resume item"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"resume": resume})
}

// UpdateResume updates a resume item (admin only)
func (rc *ResumeController) UpdateResume(c *gin.Context) {
	id := c.Param("id")

	var resume models.Resume
	if err := database.DB.First(&resume, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Resume item not found"})
		return
	}

	var req UpdateResumeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Company != "" {
		updates["company"] = req.Company
	}
	if req.Location != "" {
		updates["location"] = req.Location
	}
	if req.StartDate != "" {
		startDate, err := parseDate(req.StartDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_date format"})
			return
		}
		updates["start_date"] = startDate
	}
	if req.EndDate != nil {
		if *req.EndDate == "" {
			updates["end_date"] = nil
		} else {
			endDate, err := parseDate(*req.EndDate)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end_date format"})
				return
			}
			updates["end_date"] = endDate
		}
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Type != "" {
		updates["type"] = req.Type
	}
	// Use pointer for SortOrder: nil means not provided (preserve existing),
	// non-nil means update (even if value is 0)
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}

	if err := database.DB.Model(&resume).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update resume item"})
		return
	}

	database.DB.First(&resume, resume.ID)

	c.JSON(http.StatusOK, gin.H{"resume": resume})
}

// DeleteResume deletes a resume item (admin only)
func (rc *ResumeController) DeleteResume(c *gin.Context) {
	id := c.Param("id")

	var resume models.Resume
	if err := database.DB.First(&resume, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Resume item not found"})
		return
	}

	if err := database.DB.Delete(&resume).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete resume item"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Resume item deleted successfully"})
}

func parseDate(dateStr string) (time.Time, error) {
	return time.Parse("2006-01-02", dateStr)
}