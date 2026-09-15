package middleware

import "testing"

func TestRateLimitKey_IsolatedByScope(t *testing.T) {
	ip := "203.0.113.10"

	tests := []struct {
		name  string
		scope string
		want  string
	}{
		{name: "global", scope: "global", want: "rate_limit:global:203.0.113.10"},
		{name: "auth", scope: "auth", want: "rate_limit:auth:203.0.113.10"},
		{name: "comment", scope: "comment", want: "rate_limit:comment:203.0.113.10"},
		{name: "empty scope uses default", scope: "", want: "rate_limit:default:203.0.113.10"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := rateLimitKey(tt.scope, ip); got != tt.want {
				t.Fatalf("rateLimitKey(%q, %q) = %q, want %q", tt.scope, ip, got, tt.want)
			}
		})
	}

	if global, auth := rateLimitKey("global", ip), rateLimitKey("auth", ip); global == auth {
		t.Fatalf("global and auth rate-limit keys must be isolated, both were %q", global)
	}
}
