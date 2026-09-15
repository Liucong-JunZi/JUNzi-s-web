package controllers

import (
	"bytes"
	"mime/multipart"
	"net/http/httptest"
	"testing"
)

func multipartFileHeader(t *testing.T, filename string, content []byte) *multipart.FileHeader {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest("POST", "/", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if err := req.ParseMultipartForm(2 << 20); err != nil {
		t.Fatal(err)
	}
	return req.MultipartForm.File["file"][0]
}

func TestValidateAttachmentContent(t *testing.T) {
	tests := []struct {
		name        string
		filename    string
		content     []byte
		wantType    string
		wantInvalid bool
	}{
		{name: "pdf", filename: "report.pdf", content: []byte("%PDF-1.7\n"), wantType: "application/pdf"},
		{name: "zip", filename: "archive.zip", content: []byte("PK\x03\x04"), wantType: "application/zip"},
		{name: "markdown", filename: "notes.md", content: []byte("# Notes\n"), wantType: "text/plain; charset=utf-8"},
		{name: "html extension", filename: "page.html", content: []byte("<html></html>"), wantInvalid: true},
		{name: "svg extension", filename: "image.svg", content: []byte("<svg></svg>"), wantInvalid: true},
		{name: "javascript extension", filename: "script.js", content: []byte("alert(1)"), wantInvalid: true},
		{name: "mismatched signature", filename: "page.pdf", content: []byte("<html></html>"), wantInvalid: true},
		{name: "empty text file", filename: "empty.txt", content: nil, wantInvalid: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotType, err := validateAttachmentContent(multipartFileHeader(t, tt.filename, tt.content))
			if tt.wantInvalid {
				if err == nil {
					t.Fatalf("validateAttachmentContent() accepted %q", tt.filename)
				}
				return
			}
			if err != nil {
				t.Fatalf("validateAttachmentContent() error = %v", err)
			}
			if gotType != tt.wantType {
				t.Fatalf("validateAttachmentContent() type = %q, want %q", gotType, tt.wantType)
			}
		})
	}
}

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

func TestParseLegacyObjectPath(t *testing.T) {
	tests := []struct {
		name      string
		path      string
		want      string
		wantValid bool
	}{
		{name: "valid legacy object", path: "/2026/image.png", want: "2026/image.png", wantValid: true},
		{name: "missing object", path: "/"},
		{name: "path traversal", path: "/2026/../secret.txt"},
		{name: "backslash", path: "/2026\\secret.txt"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, valid := parseLegacyObjectPath(tt.path)
			if valid != tt.wantValid || got != tt.want {
				t.Fatalf("parseLegacyObjectPath(%q) = (%q, %v), want (%q, %v)", tt.path, got, valid, tt.want, tt.wantValid)
			}
		})
	}
}
