package controllers

import (
	"html"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"encoding/xml"
	"github.com/gin-gonic/gin"
	"github.com/liucong/personal-website/internal/database"
	"github.com/liucong/personal-website/internal/models"
)

const defaultFeedSiteURL = "https://junziliucong.online"

var (
	feedImagePattern       = regexp.MustCompile(`!\[([^\]]*)\]\([^)]+\)`)
	feedLinkPattern        = regexp.MustCompile(`\[([^\]]+)\]\([^)]+\)`)
	feedHTMLPattern        = regexp.MustCompile(`<[^>]*>`)
	feedMarkdownPrefix     = regexp.MustCompile(`(?m)^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)`)
	feedMarkdownFormatting = regexp.MustCompile("[*_~`]")
)

type rssFeed struct {
	XMLName xml.Name   `xml:"rss"`
	Version string     `xml:"version,attr"`
	Channel rssChannel `xml:"channel"`
}

type rssChannel struct {
	Title       string    `xml:"title"`
	Link        string    `xml:"link"`
	Description string    `xml:"description"`
	Language    string    `xml:"language"`
	LastBuild   string    `xml:"lastBuildDate"`
	Items       []rssItem `xml:"item"`
}

type rssItem struct {
	Title       string  `xml:"title"`
	Link        string  `xml:"link"`
	GUID        rssGUID `xml:"guid"`
	Description string  `xml:"description"`
	PubDate     string  `xml:"pubDate"`
}

type rssGUID struct {
	Value       string `xml:",chardata"`
	IsPermaLink bool   `xml:"isPermaLink,attr"`
}

type FeedController struct{}

func NewFeedController() *FeedController {
	return &FeedController{}
}

// RSS serves the latest published blog posts as an RSS 2.0 feed.
func (fc *FeedController) RSS(c *gin.Context) {
	var posts []models.Post
	if err := database.DB.Where("status = ?", "published").
		Order("created_at DESC").Limit(50).Find(&posts).Error; err != nil {
		c.String(http.StatusInternalServerError, "Failed to generate RSS feed")
		return
	}

	siteURL := strings.TrimRight(os.Getenv("FRONTEND_URL"), "/")
	if siteURL == "" {
		siteURL = defaultFeedSiteURL
	}

	items := make([]rssItem, 0, len(posts))
	var lastBuild time.Time
	for _, post := range posts {
		publishedAt := post.CreatedAt
		if publishedAt.After(lastBuild) {
			lastBuild = publishedAt
		}
		items = append(items, rssItem{
			Title:       post.Title,
			Link:        siteURL + "/blog/" + post.Slug,
			GUID:        rssGUID{Value: siteURL + "/blog/" + post.Slug, IsPermaLink: true},
			Description: feedDescription(post),
			PubDate:     publishedAt.Format("Mon, 02 Jan 2006 15:04:05 -0700"),
		})
	}
	if lastBuild.IsZero() {
		lastBuild = time.Now()
	}

	feed := rssFeed{
		Version: "2.0",
		Channel: rssChannel{
			Title:       "JUNzi Blog",
			Link:        siteURL + "/blog",
			Description: "Learning notes, tinkering logs, and occasional thoughts.",
			Language:    "en",
			LastBuild:   lastBuild.Format("Mon, 02 Jan 2006 15:04:05 -0700"),
			Items:       items,
		},
	}

	c.Header("Content-Type", "application/rss+xml; charset=utf-8")
	c.Header("Cache-Control", "public, max-age=300")
	c.XML(http.StatusOK, feed)
}

func feedDescription(post models.Post) string {
	description := strings.TrimSpace(post.Summary)
	if description == "" {
		description = post.Content
	}
	description = feedImagePattern.ReplaceAllString(description, "$1")
	description = feedLinkPattern.ReplaceAllString(description, "$1")
	description = feedHTMLPattern.ReplaceAllString(description, " ")
	description = feedMarkdownPrefix.ReplaceAllString(description, "")
	description = feedMarkdownFormatting.ReplaceAllString(description, "")
	description = strings.Join(strings.Fields(html.UnescapeString(description)), " ")
	runes := []rune(description)
	if len(runes) > 300 {
		return string(runes[:300]) + "…"
	}
	return description
}
