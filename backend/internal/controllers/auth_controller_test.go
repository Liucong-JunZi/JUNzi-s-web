package controllers

import "testing"

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
