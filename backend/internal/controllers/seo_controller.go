package controllers

import (
	"encoding/xml"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/liucong/personal-website/internal/database"
	"github.com/liucong/personal-website/internal/models"
)

type sitemapURL struct {
	Loc     string `xml:"loc"`
	LastMod string `xml:"lastmod,omitempty"`
}
type sitemapDocument struct {
	XMLName xml.Name     `xml:"urlset"`
	XMLNS   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

func seoSiteURL() string {
	u, err := url.Parse(strings.TrimSpace(os.Getenv("FRONTEND_URL")))
	if err != nil || u.Host == "" || (u.Scheme != "https" && u.Scheme != "http") || u.User != nil {
		return defaultFeedSiteURL
	}
	return u.Scheme + "://" + u.Host
}

// Robots describes public crawl policy; authentication remains the access control.
func Robots(c *gin.Context) {
	c.Header("Cache-Control", "public, max-age=300")
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte("User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /dav/\nDisallow: /login\n\nSitemap: "+seoSiteURL()+"/sitemap.xml\n"))
}

// Sitemap is generated from public records so publication and deletion take
// effect without rebuilding the frontend. GORM excludes soft-deleted records.
func Sitemap(c *gin.Context) {
	var posts []models.Post
	if err := database.DB.Select("slug", "updated_at").Where("status = ?", "published").Order("id ASC").Find(&posts).Error; err != nil {
		c.String(http.StatusInternalServerError, "Failed to generate sitemap")
		return
	}
	var projects []models.Project
	if err := database.DB.Select("id", "updated_at").Where("status IN ?", publicProjectStatuses).Order("id ASC").Find(&projects).Error; err != nil {
		c.String(http.StatusInternalServerError, "Failed to generate sitemap")
		return
	}
	doc := buildSitemap(seoSiteURL(), posts, projects)
	data, err := xml.Marshal(doc)
	if err != nil {
		c.String(http.StatusInternalServerError, "Failed to generate sitemap")
		return
	}
	c.Header("Cache-Control", "public, max-age=300")
	c.Data(http.StatusOK, "application/xml; charset=utf-8", append([]byte(xml.Header), data...))
}

func buildSitemap(base string, posts []models.Post, projects []models.Project) sitemapDocument {
	doc := sitemapDocument{XMLNS: "http://www.sitemaps.org/schemas/sitemap/0.9"}
	for _, path := range []string{"/", "/blog", "/portfolio", "/resume", "/friends"} {
		doc.URLs = append(doc.URLs, sitemapURL{Loc: base + path})
	}
	lastMod := func(t time.Time) string {
		if t.IsZero() {
			return ""
		}
		return t.UTC().Format(time.RFC3339)
	}
	for _, p := range posts {
		if p.Slug == "" {
			continue
		}
		doc.URLs = append(doc.URLs, sitemapURL{Loc: base + "/blog/" + url.PathEscape(p.Slug), LastMod: lastMod(p.UpdatedAt)})
	}
	for _, p := range projects {
		doc.URLs = append(doc.URLs, sitemapURL{Loc: base + "/portfolio/" + strconv.FormatUint(uint64(p.ID), 10), LastMod: lastMod(p.UpdatedAt)})
	}
	return doc
}
