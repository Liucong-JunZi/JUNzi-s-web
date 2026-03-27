package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID            uint           `json:"id" gorm:"primaryKey"`
	GitHubID      string         `json:"github_id" gorm:"uniqueIndex"`
	Username      string         `json:"username"`
	Email         string         `json:"email"`
	AvatarURL     string         `json:"avatar_url"`
	Bio           string         `json:"bio"`
	Role          string         `json:"role" gorm:"default:user"` // admin, user
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"-" gorm:"index"`
}

type Post struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	Title       string         `json:"title" gorm:"size:200"`
	Slug        string         `json:"slug" gorm:"uniqueIndex"`
	Content     string         `json:"content" gorm:"type:text"`
	Summary     string         `json:"summary" gorm:"size:500"`
	CoverImage  string         `json:"coverImage,cover_image"`
	Status      string         `json:"status" gorm:"default:draft"` // draft, published
	ViewCount   int            `json:"viewCount,view_count" gorm:"default:0"`
	LikeCount   int            `json:"likeCount,like_count" gorm:"default:0"`
	AuthorID    uint           `json:"authorId,author_id"`
	Author      User           `json:"author" gorm:"foreignKey:AuthorID"`
	CategoryID  uint           `json:"categoryId,category_id"`
	Category    Category       `json:"category" gorm:"foreignKey:CategoryID"`
	Tags        []Tag          `json:"tags" gorm:"many2many:post_tags;"`
	CreatedAt   time.Time      `json:"createdAt,created_at"`
	UpdatedAt   time.Time      `json:"updatedAt,updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

type Category struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	Name      string         `json:"name" gorm:"size:50;uniqueIndex"`
	Slug      string         `json:"slug" gorm:"uniqueIndex"`
	Posts     []Post         `json:"posts" gorm:"foreignKey:CategoryID"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

type Tag struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	Name      string         `json:"name" gorm:"size:50;uniqueIndex"`
	Slug      string         `json:"slug" gorm:"uniqueIndex"`
	Posts     []Post         `json:"posts" gorm:"many2many:post_tags;"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

type Project struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	Title       string         `json:"title" gorm:"size:200"`
	Description string         `json:"description" gorm:"type:text"`
	Content     string         `json:"content" gorm:"type:text"`
	CoverImage  string         `json:"imageUrl,cover_image"`
	DemoURL     string         `json:"demoUrl,demo_url"`
	GithubURL   string         `json:"githubUrl,github_url"`
	TechStack   string         `json:"techStack,tech_stack"` // JSON array or comma-separated
	Status      string         `json:"status" gorm:"default:active"` // active, archived
	SortOrder   int            `json:"sortOrder,sort_order" gorm:"default:0"`
	CreatedAt   time.Time      `json:"createdAt,created_at"`
	UpdatedAt   time.Time      `json:"updatedAt,updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

type Resume struct {
	ID           uint           `json:"id" gorm:"primaryKey"`
	Title        string         `json:"title"`
	Company      string         `json:"company"`
	Location     string         `json:"location"`
	StartDate    time.Time      `json:"startDate,start_date"`
	EndDate      *time.Time     `json:"endDate,end_date"`
	Description  string         `json:"description" gorm:"type:text"`
	Type         string         `json:"type"` // work, education, project
	SortOrder    int            `json:"sortOrder,sort_order" gorm:"default:0"`
	CreatedAt    time.Time      `json:"createdAt,created_at"`
	UpdatedAt    time.Time      `json:"updatedAt,updated_at"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`
}

type Comment struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	Content   string         `json:"content" gorm:"type:text"`
	PostID    *uint          `json:"postId,post_id"`
	Post      *Post          `json:"post" gorm:"foreignKey:PostID"`
	UserID    uint           `json:"userId,user_id"`
	User      User           `json:"user" gorm:"foreignKey:UserID"`
	ParentID  *uint          `json:"parentId,parent_id"`
	Replies   []Comment      `json:"replies" gorm:"foreignKey:ParentID"`
	Status    string         `json:"status" gorm:"default:pending"` // pending, approved, rejected
	CreatedAt time.Time      `json:"createdAt,created_at"`
	UpdatedAt time.Time      `json:"updatedAt,updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

type Setting struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Key       string    `json:"key" gorm:"uniqueIndex"`
	Value     string    `json:"value" gorm:"type:text"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}