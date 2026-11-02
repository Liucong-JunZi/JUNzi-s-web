package controllers

import (
	"html"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/liucong/personal-website/internal/database"
	"github.com/liucong/personal-website/internal/models"
)

const (
	defaultShellURL = "http://frontend"
	maxShellBytes   = 512 << 10
	maxDescription  = 160
)

type pageMeta struct {
	Title       string
	Description string
	Canonical   string
	Type        string
	NoIndex     bool
}

type shellCache struct {
	mu   sync.Mutex
	body string
	at   time.Time
}

var shell = &shellCache{}

func shellURL() string {
	u := strings.TrimRight(strings.TrimSpace(os.Getenv("FRONTEND_INTERNAL_URL")), "/")
	if u == "" || !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") {
		return defaultShellURL
	}
	return u
}

// loadShell returns the built index.html. It requests the static file directly: It is cached briefly so page views do
// not each hit the frontend container, but a redeploy is picked up quickly.
func loadShell(client *http.Client) (string, error) {
	shell.mu.Lock()
	defer shell.mu.Unlock()
	if shell.body != "" && time.Since(shell.at) < 60*time.Second {
		return shell.body, nil
	}
	client.Timeout = 5 * time.Second
	resp, err := client.Get(shellURL() + "/index.html")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", io.ErrUnexpectedEOF
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxShellBytes))
	if err != nil {
		return "", err
	}
	shell.body, shell.at = string(body), time.Now()
	return shell.body, nil
}

func truncateDescription(s string) string {
	s = strings.Join(strings.Fields(s), " ")
	r := []rune(s)
	if len(r) > maxDescription {
		return string(r[:maxDescription-1]) + "…"
	}
	return s
}

func metaTags(m pageMeta) string {
	var b strings.Builder
	b.WriteString("<title>" + html.EscapeString(m.Title) + "</title>\n")
	if m.Description != "" {
		b.WriteString(`<meta name="description" content="` + html.EscapeString(m.Description) + `">` + "\n")
		b.WriteString(`<meta property="og:description" content="` + html.EscapeString(m.Description) + `">` + "\n")
	}
	if m.Canonical != "" {
		b.WriteString(`<link rel="canonical" href="` + html.EscapeString(m.Canonical) + `">` + "\n")
		b.WriteString(`<meta property="og:url" content="` + html.EscapeString(m.Canonical) + `">` + "\n")
	}
	ogType := m.Type
	if ogType == "" {
		ogType = "website"
	}
	b.WriteString(`<meta property="og:type" content="` + html.EscapeString(ogType) + `">` + "\n")
	b.WriteString(`<meta property="og:title" content="` + html.EscapeString(m.Title) + `">` + "\n")
	if m.NoIndex {
		b.WriteString(`<meta name="robots" content="noindex">` + "\n")
	}
	b.WriteString(`<meta name="twitter:card" content="summary">` + "\n")
	b.WriteString(`<meta name="twitter:title" content="` + html.EscapeString(m.Title) + `">` + "\n")
	return b.String()
}

// injectPageMeta replaces the static head metadata so non-executing crawlers and
// link-preview fetchers see per-page title, description and canonical URL.
func injectPageMeta(body string, m pageMeta) string {
	idx := strings.Index(strings.ToLower(body), "</head>")
	if idx < 0 {
		return body
	}
	head, tail := body[:idx], body[idx:]
	head = removeElement(head, "<title", "</title>")
	for _, void := range []string{`<meta name="description"`, `<meta property="og:`, `<meta name="twitter:`, `<link rel="canonical"`} {
		head = removeElement(head, void, "")
	}
	return head + metaTags(m) + tail
}

// removeElement deletes every element whose opening tag starts with open. When
// close is empty the tag is treated as void and only the tag itself is removed.
func removeElement(head, open, close string) string {
	for {
		start := strings.Index(head, open)
		if start < 0 {
			return head
		}
		end := strings.Index(head[start:], ">")
		if end < 0 {
			return head
		}
		end += start + 1
		if close != "" {
			if c := strings.Index(head[end:], close); c >= 0 {
				end += c + len(close)
			}
		}
		lineStart := strings.LastIndex(head[:start], "\n") + 1
		if strings.TrimSpace(head[lineStart:start]) != "" {
			lineStart = start
		}
		for end < len(head) && (head[end] == ' ' || head[end] == '\t') {
			end++
		}
		if end < len(head) && head[end] == '\n' {
			end++
		}
		head = head[:lineStart] + head[end:]
	}
}

func writePage(c *gin.Context, client *http.Client, m pageMeta, status int) {
	body, err := loadShell(client)
	if err != nil {
		c.String(http.StatusBadGateway, "Service temporarily unavailable")
		return
	}
	c.Header("Cache-Control", "public, max-age=300")
	c.Data(status, "text/html; charset=utf-8", []byte(injectPageMeta(body, m)))
}

// HomeMeta serves the site root with page-level metadata.
func HomeMeta(client *http.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		base := seoSiteURL()
		writePage(c, client, pageMeta{
			Title:       "JUNzi · Liu Cong",
			Description: "Liu Cong's personal site: essays, selected projects, and a resume.",
			Canonical:   base + "/",
		}, http.StatusOK)
	}
}

// BlogIndexMeta serves /blog with page-level metadata.
func BlogIndexMeta(client *http.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		base := seoSiteURL()
		writePage(c, client, pageMeta{Title: "Blog | JUNzi", Description: "Learning notes and technical write-ups.", Canonical: base + "/blog"}, http.StatusOK)
	}
}

func dbReady() bool { return database.DB != nil }

// BlogPostMeta serves /blog/:slug with metadata taken from the stored post.
func BlogPostMeta(client *http.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		base := seoSiteURL()
		var post models.Post
		if !dbReady() || database.DB.Where("slug = ? AND status = ?", c.Param("slug"), "published").First(&post).Error != nil {
			writePage(c, client, pageMeta{Title: "Not Found | JUNzi", Canonical: base + "/blog", NoIndex: true}, http.StatusNotFound)
			return
		}
		writePage(c, client, pageMeta{
			Title:       post.Title + " | JUNzi",
			Description: truncateDescription(firstNonEmpty(post.Summary, post.Content)),
			Canonical:   base + "/blog/" + post.Slug,
			Type:        "article",
		}, http.StatusOK)
	}
}

// PortfolioIndexMeta serves /portfolio.
func PortfolioIndexMeta(client *http.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		base := seoSiteURL()
		writePage(c, client, pageMeta{Title: "Projects | JUNzi", Description: "Selected projects and experiments.", Canonical: base + "/portfolio"}, http.StatusOK)
	}
}

// PortfolioDetailMeta serves /portfolio/:id using the stored project.
func PortfolioDetailMeta(client *http.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		base := seoSiteURL()
		id, err := strconv.ParseUint(c.Param("id"), 10, 64)
		var project models.Project
		if err != nil || !dbReady() || database.DB.Where("id = ? AND status IN ?", id, publicProjectStatuses).First(&project).Error != nil {
			writePage(c, client, pageMeta{Title: "Not Found | JUNzi", Canonical: base + "/portfolio", NoIndex: true}, http.StatusNotFound)
			return
		}
		writePage(c, client, pageMeta{
			Title:       project.Title + " | JUNzi",
			Description: truncateDescription(firstNonEmpty(project.Description, project.Content)),
			Canonical:   base + "/portfolio/" + c.Param("id"),
			Type:        "article",
		}, http.StatusOK)
	}
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
