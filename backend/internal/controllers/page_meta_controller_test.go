package controllers

import (
	"net/http"
	"net/http/httptest"

	"github.com/gin-gonic/gin"
	"strings"
	"testing"
	"time"
)

func newMetaContext() *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/blog/missing", nil)
	c.Params = gin.Params{{Key: "slug", Value: "missing"}}
	return c
}

const testShell = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="description" content="generic" />
    <title>JUNzi - Personal Website</title>
  </head>
  <body><div id="root"></div></body>
</html>`

func TestInjectPageMeta(t *testing.T) {
	out := injectPageMeta(testShell, pageMeta{
		Title:       `A & B <script>`,
		Description: `quote " and ' apostrophe`,
		Canonical:   "https://example.com/blog/x?y=1&z=2",
		Type:        "article",
	})
	if strings.Count(out, "<title>") != 1 || strings.Contains(out, "generic") || strings.Contains(out, "JUNzi - Personal Website") {
		t.Fatalf("static metadata not replaced: %s", out)
	}
	for _, want := range []string{
		"<title>A &amp; B &lt;script&gt;</title>",
		`<meta name="description" content="quote &#34; and &#39; apostrophe">`,
		`<link rel="canonical" href="https://example.com/blog/x?y=1&amp;z=2">`,
		`<meta property="og:type" content="article">`,
		`<meta property="og:title" content="A &amp; B &lt;script&gt;">`,
		`<meta name="twitter:card" content="summary">`,
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("missing %q in %s", want, out)
		}
	}
	if strings.Contains(out, "<script>A") || strings.Count(out, "<body>") != 1 {
		t.Fatal("unescaped value or damaged body")
	}
}

func TestInjectPageMetaNoIndex(t *testing.T) {
	out := injectPageMeta(testShell, pageMeta{Title: "Not Found | JUNzi", NoIndex: true})
	if !strings.Contains(out, `<meta name="robots" content="noindex">`) {
		t.Fatalf("missing noindex: %s", out)
	}
	if strings.Contains(injectPageMeta(testShell, pageMeta{Title: "X"}), `name="robots"`) {
		t.Fatal("indexable pages must not be marked noindex")
	}
}

func TestInjectPageMetaWithoutHead(t *testing.T) {
	if got := injectPageMeta("no head here", pageMeta{Title: "x"}); got != "no head here" {
		t.Fatal(got)
	}
}

func TestTruncateDescription(t *testing.T) {
	long := strings.Repeat("中", 300)
	got := truncateDescription(long)
	if len([]rune(got)) != maxDescription || !strings.HasSuffix(got, "…") {
		t.Fatalf("got %d runes", len([]rune(got)))
	}
	if got := truncateDescription("  a\n\n b  "); got != "a b" {
		t.Fatal(got)
	}
}

func TestBlogPostMetaNotFoundAndHit(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte(testShell))
	}))
	defer upstream.Close()
	t.Setenv("FRONTEND_INTERNAL_URL", upstream.URL)
	t.Setenv("FRONTEND_URL", "https://example.com")
	shell = &shellCache{}

	if got, err := loadShell(&http.Client{Timeout: time.Second}); err != nil || got != testShell {
		t.Fatal("shell not loaded")
	}
	c := newMetaContext()
	BlogPostMeta(&http.Client{Timeout: time.Second})(c)
	if c.Writer.Status() != http.StatusNotFound {
		t.Fatalf("expected 404 for unknown slug without DB record, got %d", c.Writer.Status())
	}
	if v := c.Writer.Header().Get("Cache-Control"); v != "public, max-age=300" {
		t.Fatal(v)
	}
}

func TestLoadShellRejectsBadUpstream(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer upstream.Close()
	t.Setenv("FRONTEND_INTERNAL_URL", upstream.URL)
	shell = &shellCache{}
	if _, err := loadShell(&http.Client{Timeout: time.Second}); err == nil {
		t.Fatal("expected error for non-200 shell")
	}
}

func TestLoadShellRequestsStaticFile(t *testing.T) {
	var path string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path = r.URL.Path
		if r.URL.Path != "/index.html" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_, _ = w.Write([]byte(testShell))
	}))
	defer upstream.Close()
	t.Setenv("FRONTEND_INTERNAL_URL", upstream.URL)
	shell = &shellCache{}
	if _, err := loadShell(&http.Client{Timeout: time.Second}); err != nil {
		t.Fatal(err)
	}
	if path != "/index.html" {
		t.Fatalf("shell must bypass the proxied root route, requested %q", path)
	}
}

func TestShellURLDefault(t *testing.T) {
	t.Setenv("FRONTEND_INTERNAL_URL", "")
	if got := shellURL(); got != defaultShellURL {
		t.Fatal(got)
	}
	t.Setenv("FRONTEND_INTERNAL_URL", "ftp://nope")
	if got := shellURL(); got != defaultShellURL {
		t.Fatal(got)
	}
}
