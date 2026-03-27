package controllers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/liucong/personal-website/internal/database"
	"github.com/liucong/personal-website/internal/models"
)

type ProjectController struct{}

func NewProjectController() *ProjectController {
	return &ProjectController{}
}

type CreateProjectRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	Content     string `json:"content"`
	CoverImage  string `json:"cover_image"`
	DemoURL     string `json:"demo_url"`
	GithubURL   string `json:"github_url"`
	TechStack   string `json:"tech_stack"`
	Status      string `json:"status"`
	SortOrder   int    `json:"sort_order"`
}

type UpdateProjectRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Content     string `json:"content"`
	CoverImage  string `json:"cover_image"`
	DemoURL     string `json:"demo_url"`
	GithubURL   string `json:"github_url"`
	TechStack   string `json:"tech_stack"`
	Status      string `json:"status"`
	SortOrder   int    `json:"sort_order"`
}

// ListProjects lists all projects
func (pc *ProjectController) ListProjects(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	status := c.Query("status")

	offset := (page - 1) * pageSize

	query := database.DB.Model(&models.Project{})

	if status != "" {
		query = query.Where("status = ?", status)
	} else {
		query = query.Where("status = ?", "active")
	}

	var total int64
	query.Count(&total)

	var projects []models.Project
	if err := query.Order("sort_order ASC, created_at DESC").Offset(offset).Limit(pageSize).Find(&projects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch projects"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"projects":  projects,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetProject gets a single project by ID
func (pc *ProjectController) GetProject(c *gin.Context) {
	id := c.Param("id")

	var project models.Project
	if err := database.DB.First(&project, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"project": project})
}

// CreateProject creates a new project (admin only)
func (pc *ProjectController) CreateProject(c *gin.Context) {
	var req CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	project := models.Project{
		Title:       req.Title,
		Description: req.Description,
		Content:     req.Content,
		CoverImage:  req.CoverImage,
		DemoURL:     req.DemoURL,
		GithubURL:   req.GithubURL,
		TechStack:   req.TechStack,
		Status:      req.Status,
		SortOrder:   req.SortOrder,
	}

	if project.Status == "" {
		project.Status = "active"
	}

	if err := database.DB.Create(&project).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create project"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"project": project})
}

// UpdateProject updates a project (admin only)
func (pc *ProjectController) UpdateProject(c *gin.Context) {
	id := c.Param("id")

	var project models.Project
	if err := database.DB.First(&project, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	var req UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Content != "" {
		updates["content"] = req.Content
	}
	if req.CoverImage != "" {
		updates["cover_image"] = req.CoverImage
	}
	if req.DemoURL != "" {
		updates["demo_url"] = req.DemoURL
	}
	if req.GithubURL != "" {
		updates["github_url"] = req.GithubURL
	}
	if req.TechStack != "" {
		updates["tech_stack"] = req.TechStack
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	updates["sort_order"] = req.SortOrder

	if err := database.DB.Model(&project).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}

	database.DB.First(&project, project.ID)

	c.JSON(http.StatusOK, gin.H{"project": project})
}

// DeleteProject deletes a project (admin only)
func (pc *ProjectController) DeleteProject(c *gin.Context) {
	id := c.Param("id")

	var project models.Project
	if err := database.DB.First(&project, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	if err := database.DB.Delete(&project).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete project"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Project deleted successfully"})
}