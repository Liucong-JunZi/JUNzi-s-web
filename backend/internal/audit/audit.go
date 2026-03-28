package audit

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
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

// AlertRule defines a threshold-based alert for a specific event type.
type AlertRule struct {
	Event     string
	Threshold int
	Window    time.Duration
}

// alertTracker tracks security event counts with sliding windows and triggers alerts.
type alertTracker struct {
	mu       sync.Mutex
	counts   map[string][]time.Time
	rules    map[string]AlertRule
	webhook  string
	stopCh   chan struct{}
}

var tracker *alertTracker

// defaultAlertRules returns the built-in alert rules.
func defaultAlertRules() map[string]AlertRule {
	return map[string]AlertRule{
		"login_failed":   {Event: "login_failed", Threshold: 5, Window: 5 * time.Minute},
		"csrf_rejected":  {Event: "csrf_rejected", Threshold: 10, Window: 5 * time.Minute},
		"admin_forbidden": {Event: "admin_forbidden", Threshold: 3, Window: 10 * time.Minute},
		"token_revoked_used": {Event: "token_revoked_used", Threshold: 1, Window: 1 * time.Hour},
		"origin_rejected": {Event: "origin_rejected", Threshold: 10, Window: 5 * time.Minute},
	}
}

func newAlertTracker() *alertTracker {
	t := &alertTracker{
		counts:  make(map[string][]time.Time),
		rules:   defaultAlertRules(),
		webhook: os.Getenv("AUDIT_ALERT_WEBHOOK"),
		stopCh:  make(chan struct{}),
	}
	go t.cleanupLoop()
	return t
}

// cleanupLoop periodically removes expired timestamps to prevent memory growth.
func (t *alertTracker) cleanupLoop() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			t.cleanup()
		case <-t.stopCh:
			return
		}
	}
}

// cleanup removes timestamps that have fallen outside all rule windows.
func (t *alertTracker) cleanup() {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now()
	for event, timestamps := range t.counts {
		maxWindow := time.Duration(0)
		if rule, ok := t.rules[event]; ok {
			maxWindow = rule.Window
		}
		if maxWindow == 0 {
			delete(t.counts, event)
			continue
		}

		cutoff := now.Add(-maxWindow)
		filtered := timestamps[:0]
		for _, ts := range timestamps {
			if ts.After(cutoff) {
				filtered = append(filtered, ts)
			}
		}
		if len(filtered) == 0 {
			delete(t.counts, event)
		} else {
			t.counts[event] = filtered
		}
	}
}

// check evaluates whether an event triggers an alert rule.
func (t *alertTracker) check(event string) {
	rule, ok := t.rules[event]
	if !ok {
		return
	}

	now := time.Now()
	cutoff := now.Add(-rule.Window)

	t.mu.Lock()
	timestamps := t.counts[event]
	// Filter to only timestamps within the window
	filtered := make([]time.Time, 0, len(timestamps))
	for _, ts := range timestamps {
		if ts.After(cutoff) {
			filtered = append(filtered, ts)
		}
	}
	// Add current event
	filtered = append(filtered, now)
	t.counts[event] = filtered
	count := len(filtered)

	// Only trigger when count hits exactly the threshold, then reset
	if count == rule.Threshold {
		delete(t.counts, event)
		t.mu.Unlock()

		t.emitAlert(rule, count)
		return
	}

	t.mu.Unlock()
}

// emitAlert writes an alert_triggered audit entry and optionally sends a webhook.
func (t *alertTracker) emitAlert(rule AlertRule, count int) {
	e := Entry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Event:     "alert_triggered",
		Detail:    fmt.Sprintf("event=%s threshold=%d window=%s count=%d", rule.Event, rule.Threshold, rule.Window, count),
	}

	data, err := json.Marshal(e)
	if err != nil {
		log.Printf("[AUDIT-ALERT] json_error=%s event=%s", err, rule.Event)
		return
	}

	// Write alert to the same audit output
	mu.Lock()
	output.Write(append(data, '\n'))
	mu.Unlock()

	// Send webhook asynchronously if configured
	if t.webhook != "" {
		go t.sendWebhook(data)
	}
}

// sendWebhook POSTs the alert payload as JSON to the configured webhook URL.
func (t *alertTracker) sendWebhook(payload []byte) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(t.webhook, "application/json", bytes.NewReader(payload))
	if err != nil {
		log.Printf("[AUDIT-WEBHOOK] error=%s", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		log.Printf("[AUDIT-WEBHOOK] status=%d url=%s", resp.StatusCode, t.webhook)
	}
}

func init() {
	// If AUDIT_LOG_FILE is set, also write to that file.
	if path := os.Getenv("AUDIT_LOG_FILE"); path != "" {
		if f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0640); err == nil {
			output = io.MultiWriter(os.Stdout, f)
		}
	}

	tracker = newAlertTracker()
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
	output.Write(append(data, '\n'))
	mu.Unlock()

	// Evaluate alert rules for this event
	if tracker != nil {
		tracker.check(event)
	}
}
