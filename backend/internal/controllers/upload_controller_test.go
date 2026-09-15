package controllers

import "testing"

func TestParsePublicObjectPath(t *testing.T) {
	tests := []struct {
		name      string
		path      string
		bucket    string
		want      string
		wantValid bool
	}{
		{name: "valid object", path: "/uploads/2026/image.png", bucket: "uploads", want: "2026/image.png", wantValid: true},
		{name: "wrong bucket", path: "/private/2026/image.png", bucket: "uploads"},
		{name: "missing object", path: "/uploads", bucket: "uploads"},
		{name: "path traversal", path: "/uploads/2026/../secret.txt", bucket: "uploads"},
		{name: "backslash", path: "/uploads/2026\\secret.txt", bucket: "uploads"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, valid := parsePublicObjectPath(tt.path, tt.bucket)
			if valid != tt.wantValid || got != tt.want {
				t.Fatalf("parsePublicObjectPath(%q, %q) = (%q, %v), want (%q, %v)", tt.path, tt.bucket, got, valid, tt.want, tt.wantValid)
			}
		})
	}
}
