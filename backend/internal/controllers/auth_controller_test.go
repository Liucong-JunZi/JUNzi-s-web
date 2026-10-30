package controllers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"golang.org/x/oauth2"
)

func TestGitHubOAuthTokenExchange(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Error(err)
		}
		if r.Form.Get("code") != "test-code" {
			t.Errorf("unexpected authorization code: %q", r.Form.Get("code"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"test-token","token_type":"bearer"}`))
	}))
	defer server.Close()
	cfg := oauth2.Config{ClientID: "test-client", ClientSecret: "test-secret", Endpoint: oauth2.Endpoint{TokenURL: server.URL}}
	ctx := context.WithValue(context.Background(), oauth2.HTTPClient, githubOAuthHTTPClient(""))
	token, err := cfg.Exchange(ctx, "test-code")
	if err != nil {
		t.Fatal(err)
	}
	if token.AccessToken != "test-token" {
		t.Fatal("unexpected access token")
	}
}

func TestGitHubOAuthProxy(t *testing.T) {
	client := githubOAuthHTTPClient("http://127.0.0.1:7897")
	transport := client.Transport.(*http.Transport)
	req, err := http.NewRequest(http.MethodGet, "https://github.com/login/oauth/access_token", nil)
	if err != nil {
		t.Fatal(err)
	}
	proxy, err := transport.Proxy(req)
	if err != nil || proxy == nil || proxy.String() != "http://127.0.0.1:7897" {
		t.Fatalf("unexpected proxy: %v, error: %v", proxy, err)
	}
}

func TestIsSecureCookieExplicitOverride(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("GIN_MODE", "release")
	t.Setenv("FRONTEND_URL", "http://example.com")

	tests := []struct {
		name  string
		value string
		want  bool
	}{
		{name: "true", value: "true", want: true},
		{name: "false", value: "false", want: false},
		{name: "numeric true", value: "1", want: true},
		{name: "numeric false", value: "0", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("COOKIE_SECURE", tt.value)
			if got := isSecureCookie(); got != tt.want {
				t.Fatalf("isSecureCookie() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsSecureCookieUsesFrontendURLScheme(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("GIN_MODE", "release")
	t.Setenv("COOKIE_SECURE", "")

	tests := []struct {
		name        string
		frontendURL string
		want        bool
	}{
		{name: "https", frontendURL: "https://example.com", want: true},
		{name: "http", frontendURL: "http://example.com", want: false},
		{name: "missing URL fails closed", frontendURL: "", want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("FRONTEND_URL", tt.frontendURL)
			if got := isSecureCookie(); got != tt.want {
				t.Fatalf("isSecureCookie() = %v, want %v", got, tt.want)
			}
		})
	}
}
