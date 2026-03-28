package audit

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
)

// Logger writes structured security events to stdout.
var Logger = log.New(os.Stdout, "[AUDIT] ", log.LstdFlags|log.LUTC)

// Log records a security-relevant event with request context.
func Log(event, detail string, c *gin.Context) {
	ip := "-"
	ua := "-"
	path := "-"
	if c != nil {
		ip = c.ClientIP()
		ua = c.Request.UserAgent()
		path = c.Request.URL.Path
	}
	Logger.Printf("event=%s path=%s ip=%s ua=%q detail=%s", event, path, ip, ua, detail)
}
