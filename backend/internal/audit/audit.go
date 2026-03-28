package audit

import (
	"encoding/json"
	"io"
	"log"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Entry represents a structured security audit log entry.
type Entry struct {
	Timestamp string `json:"timestamp"`
	Event     string `json:"event"`
	Path      string `json:"path,omitempty"`
	IP        string `json:"ip,omitempty"`
	UserAgent string `json:"user_agent,omitempty"`
	Detail    string `json:"detail,omitempty"`
}

var (
	mu     sync.Mutex
	output io.Writer = os.Stdout
)

func init() {
	// If AUDIT_LOG_FILE is set, also write to that file.
	if path := os.Getenv("AUDIT_LOG_FILE"); path != "" {
		if f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0640); err == nil {
			output = io.MultiWriter(os.Stdout, f)
		}
	}
}

// Log records a security-relevant event with request context as structured JSON.
func Log(event, detail string, c *gin.Context) {
	e := Entry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Event:     event,
		Detail:    detail,
	}
	if c != nil {
		e.Path = c.Request.URL.Path
		e.IP = c.ClientIP()
		e.UserAgent = c.Request.UserAgent()
	}

	data, err := json.Marshal(e)
	if err != nil {
		// Fallback to plain text if JSON marshalling fails
		log.Printf("[AUDIT] json_error=%s event=%s detail=%s", err, event, detail)
		return
	}

	mu.Lock()
	defer mu.Unlock()
	output.Write(append(data, '\n'))
}
