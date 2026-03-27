package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// helper to create a Gin context with an httptest recorder
func newTestContext(t *testing.T, method, path string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

// ── CSRFProtection tests ──

func TestCSRFProtection_SafeMethodsSkip(t *testing.T) {
	methods := []string{"GET", "HEAD", "OPTIONS"}
	for _, m := range methods {
		t.Run(m, func(t *testing.T) {
			called := false
			c, _ := newTestContext(t, m, "/")
			CSRFProtection()(c)
			// simulate handler
			if !c.IsAborted() {
				called = true
			}
			if !called {
				t.Errorf("expected handler to be called for method %s", m)
			}
		})
	}
}

func TestCSRFProtection_MissingCookie(t *testing.T) {
	c, w := newTestContext(t, "POST", "/")
	CSRFProtection()(c)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
	if !c.IsAborted() {
		t.Error("expected request to be aborted")
	}
}

func TestCSRFProtection_MissingHeader(t *testing.T) {
	c, w := newTestContext(t, "POST", "/")
	c.Request.AddCookie(&http.Cookie{Name: "csrf_token", Value: "test-token"})
	CSRFProtection()(c)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestCSRFProtection_Mismatch(t *testing.T) {
	c, w := newTestContext(t, "POST", "/")
	c.Request.AddCookie(&http.Cookie{Name: "csrf_token", Value: "cookie-token"})
	c.Request.Header.Set("X-CSRF-Token", "header-token")
	CSRFProtection()(c)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestCSRFProtection_Success(t *testing.T) {
	c, _ := newTestContext(t, "POST", "/")
	c.Request.AddCookie(&http.Cookie{Name: "csrf_token", Value: "matching-token"})
	c.Request.Header.Set("X-CSRF-Token", "matching-token")
	CSRFProtection()(c)

	if c.IsAborted() {
		t.Error("expected request to pass through")
	}
}

// ── OriginRefererCheck tests ──

func TestOriginRefererCheck_ValidOrigin(t *testing.T) {
	// Default CORS_ALLOWED_ORIGINS is "http://localhost:5173"
	c, _ := newTestContext(t, "POST", "/")
	c.Request.Header.Set("Origin", "http://localhost:5173")
	OriginRefererCheck()(c)

	if c.IsAborted() {
		t.Error("expected request with valid origin to pass")
	}
}

func TestOriginRefererCheck_InvalidOrigin(t *testing.T) {
	c, w := newTestContext(t, "POST", "/")
	c.Request.Header.Set("Origin", "https://evil.com")
	OriginRefererCheck()(c)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestOriginRefererCheck_RefererFallback(t *testing.T) {
	c, _ := newTestContext(t, "POST", "/")
	c.Request.Header.Set("Referer", "http://localhost:5173/some/page")
	OriginRefererCheck()(c)

	if c.IsAborted() {
		t.Error("expected request with valid referer to pass")
	}
}

func TestOriginRefererCheck_InvalidReferer(t *testing.T) {
	c, w := newTestContext(t, "POST", "/")
	c.Request.Header.Set("Referer", "https://evil.com/page")
	OriginRefererCheck()(c)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestOriginRefererCheck_MissingBoth(t *testing.T) {
	c, w := newTestContext(t, "POST", "/")
	OriginRefererCheck()(c)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestOriginRefererCheck_OriginTakesPrecedenceOverReferer(t *testing.T) {
	c, w := newTestContext(t, "POST", "/")
	c.Request.Header.Set("Origin", "https://evil.com")
	c.Request.Header.Set("Referer", "http://localhost:5173/page")
	OriginRefererCheck()(c)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 when origin is bad even if referer is good, got %d", w.Code)
	}
}

// ── refererOrigin tests ──

func TestRefererOrigin(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"http://localhost:5173/path?q=1", "http://localhost:5173"},
		{"https://example.com", "https://example.com"},
		{"https://example.com:8443/path", "https://example.com:8443"},
		{"not-a-url", ""},
		{"://missing-scheme", ""},
		{"", ""},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := refererOrigin(tt.input)
			if got != tt.want {
				t.Errorf("refererOrigin(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
