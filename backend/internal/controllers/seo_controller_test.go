package controllers

import (
	"encoding/xml"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/liucong/personal-website/internal/models"
)

func TestRobots(t *testing.T) {
	t.Setenv("FRONTEND_URL", "https://example.com/")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	Robots(c)
	if w.Code != 200 || !strings.HasPrefix(w.Header().Get("Content-Type"), "text/plain") {
		t.Fatal(w.Code, w.Header())
	}
	for _, want := range []string{"User-agent: *", "Disallow: /dav/", "Disallow: /api/", "Sitemap: https://example.com/sitemap.xml"} {
		if !strings.Contains(w.Body.String(), want) {
			t.Fatal("missing", want)
		}
	}
}

func TestSEOCanonicalOrigin(t *testing.T) {
	for _, tc := range []struct{ input, want string }{
		{"", defaultFeedSiteURL},
		{"javascript:alert(1)", defaultFeedSiteURL},
		{"https://user:secret@example.com", defaultFeedSiteURL},
		{"https://example.com/path?x=1#fragment", "https://example.com"},
	} {
		t.Setenv("FRONTEND_URL", tc.input)
		if got := seoSiteURL(); got != tc.want {
			t.Fatalf("%q: got %q", tc.input, got)
		}
	}
}

func TestSitemapXML(t *testing.T) {
	updated := time.Date(2026, 11, 1, 12, 0, 0, 0, time.FixedZone("CST", 8*3600))
	doc := buildSitemap("https://example.com", []models.Post{{Slug: "数学 & proof", UpdatedAt: updated}, {Slug: ""}}, []models.Project{{ID: 2, UpdatedAt: updated}})
	b, err := xml.Marshal(doc)
	if err != nil {
		t.Fatal(err)
	}
	var decoded sitemapDocument
	if err := xml.Unmarshal(b, &decoded); err != nil {
		t.Fatal(err)
	}
	if len(decoded.URLs) != 7 || decoded.XMLNS != "http://www.sitemaps.org/schemas/sitemap/0.9" {
		t.Fatal(string(b))
	}
	if decoded.URLs[5].Loc != "https://example.com/blog/%E6%95%B0%E5%AD%A6%20&%20proof" || decoded.URLs[5].LastMod != "2026-11-01T04:00:00Z" {
		t.Fatal(decoded.URLs[5])
	}
	if strings.Contains(string(b), "<lastmod></lastmod>") || !strings.Contains(string(b), "&amp;") {
		t.Fatal(string(b))
	}
	for _, u := range decoded.URLs {
		if strings.Contains(u.Loc, "/admin") || strings.Contains(u.Loc, "/login") {
			t.Fatal(u)
		}
	}
}
