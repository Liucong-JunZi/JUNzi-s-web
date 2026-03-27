package controllers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/liucong/personal-website/internal/database"
	"github.com/liucong/personal-website/internal/models"
	"gorm.io/gorm"
)

type SettingController struct{}

func NewSettingController() *SettingController {
	return &SettingController{}
}

type UpdateSettingRequest struct {
	Value string `json:"value" binding:"required"`
}

// GetSettings gets all settings (admin only)
func (sc *SettingController) GetSettings(c *gin.Context) {
	var settings []models.Setting
	if err := database.DB.Find(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch settings"})
		return
	}

	// Convert to map for easier access
	settingMap := make(map[string]string)
	for _, s := range settings {
		settingMap[s.Key] = s.Value
	}

	c.JSON(http.StatusOK, gin.H{"settings": settingMap})
}

// UpdateSetting updates a setting (admin only)
func (sc *SettingController) UpdateSetting(c *gin.Context) {
	key := c.Param("key")
	if key == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Key is required"})
		return
	}

	var req UpdateSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var setting models.Setting
	result := database.DB.Where("key = ?", key).First(&setting)

	if result.Error != nil {
		if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query setting"})
			return
		}
		// Record not found, create new setting
		setting = models.Setting{
			Key:   key,
			Value: req.Value,
		}
		if err := database.DB.Create(&setting).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create setting"})
			return
		}
	} else {
		// Update existing setting
		if err := database.DB.Model(&setting).Update("value", req.Value).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update setting"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"setting": setting})
}

// UpdateSettings updates multiple settings (admin only)
func (sc *SettingController) UpdateSettings(c *gin.Context) {
	var req map[string]string
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Use transaction
	tx := database.DB.Begin()
	defer tx.Rollback()

	for key, value := range req {
		var setting models.Setting
		result := tx.Where("key = ?", key).First(&setting)

		if result.Error != nil {
			if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query setting"})
				return
			}
			setting = models.Setting{
				Key:   key,
				Value: value,
			}
			if err := tx.Create(&setting).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create setting"})
				return
			}
		} else {
			if err := tx.Model(&setting).Update("value", value).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update setting"})
				return
			}
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit settings"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Settings updated successfully"})
}

// GetPublicSettings gets public settings
func (sc *SettingController) GetPublicSettings(c *gin.Context) {
	publicKeys := []string{"site_name", "site_description", "site_keywords", "site_author", "footer_text"}

	var settings []models.Setting
	if err := database.DB.Where("key IN ?", publicKeys).Find(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch settings"})
		return
	}

	settingMap := make(map[string]string)
	for _, s := range settings {
		settingMap[s.Key] = s.Value
	}

	c.JSON(http.StatusOK, gin.H{"settings": settingMap})
}