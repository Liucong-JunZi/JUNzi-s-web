package controllers

import (
	"time"

	"github.com/liucong/personal-website/internal/models"
)

// PublicUser contains only fields safe for public API responses.
type PublicUser struct {
	ID        uint   `json:"id"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
	Bio       string `json:"bio"`
}

func toPublicUser(u *models.User) PublicUser {
	return PublicUser{
		ID:        u.ID,
		Username:  u.Username,
		AvatarURL: u.AvatarURL,
		Bio:       u.Bio,
	}
}

// PublicPost is the public response DTO for posts (strips sensitive User fields from Author).
type PublicPost struct {
	ID         uint            `json:"id"`
	Title      string          `json:"title"`
	Slug       string          `json:"slug"`
	Content    string          `json:"content"`
	Summary    string          `json:"summary"`
	CoverImage string          `json:"cover_image"`
	Status     string          `json:"status"`
	ViewCount  int             `json:"view_count"`
	LikeCount  int             `json:"like_count"`
	AuthorID   uint            `json:"author_id"`
	Author     PublicUser      `json:"author"`
	CategoryID *uint           `json:"category_id"`
	Category   models.Category `json:"category"`
	Tags       []models.Tag    `json:"tags"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

func toPublicPost(p *models.Post) PublicPost {
	return PublicPost{
		ID:         p.ID,
		Title:      p.Title,
		Slug:       p.Slug,
		Content:    p.Content,
		Summary:    p.Summary,
		CoverImage: p.CoverImage,
		Status:     p.Status,
		ViewCount:  p.ViewCount,
		LikeCount:  p.LikeCount,
		AuthorID:   p.AuthorID,
		Author:     toPublicUser(&p.Author),
		CategoryID: p.CategoryID,
		Category:   p.Category,
		Tags:       p.Tags,
		CreatedAt:  p.CreatedAt,
		UpdatedAt:  p.UpdatedAt,
	}
}

func toPublicPosts(posts []models.Post) []PublicPost {
	result := make([]PublicPost, len(posts))
	for i := range posts {
		result[i] = toPublicPost(&posts[i])
	}
	return result
}

// PublicComment is the public response DTO for comments (strips sensitive User fields).
type PublicComment struct {
	ID        uint            `json:"id"`
	Content   string          `json:"content"`
	PostID    *uint           `json:"post_id"`
	Author    PublicUser      `json:"author"`
	ParentID  *uint           `json:"parent_id"`
	Replies   []PublicComment `json:"replies"`
	Status    string          `json:"status"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

func toPublicComment(c *models.Comment) PublicComment {
	replies := make([]PublicComment, len(c.Replies))
	for i := range c.Replies {
		replies[i] = toPublicComment(&c.Replies[i])
	}
	return PublicComment{
		ID:        c.ID,
		Content:   c.Content,
		PostID:    c.PostID,
		Author:    toPublicUser(&c.User),
		ParentID:  c.ParentID,
		Replies:   replies,
		Status:    c.Status,
		CreatedAt: c.CreatedAt,
		UpdatedAt: c.UpdatedAt,
	}
}

func toPublicComments(comments []models.Comment) []PublicComment {
	result := make([]PublicComment, len(comments))
	for i := range comments {
		result[i] = toPublicComment(&comments[i])
	}
	return result
}
