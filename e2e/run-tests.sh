#!/bin/bash
set -e

REPORT_DIR="/Users/liucong/code/JUNziweb/e2e/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${REPORT_DIR}/test-report-${TIMESTAMP}.md"
LOG_FILE="${REPORT_DIR}/test-output-${TIMESTAMP}.log"

echo "# E2E Test Report - $(date '+%Y-%m-%d %H:%M:%S')" > "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "## Environment" >> "$REPORT_FILE"
echo "- BASE_URL: ${E2E_BASE_URL:-http://localhost}" >> "$REPORT_FILE"
echo "- Node: $(node --version)" >> "$REPORT_FILE"
echo "- Date: $(date '+%Y-%m-%d %H:%M:%S %Z')" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Pre-flight health check
echo "## Pre-flight Checks" >> "$REPORT_FILE"
HEALTH_STATUS=$(curl -sf ${E2E_BASE_URL:-http://localhost}/api/health 2>&1 || echo "FAILED")
echo "- API Health: ${HEALTH_STATUS}" >> "$REPORT_FILE"

TEST_LOGIN_STATUS=$(curl -sf -X POST ${E2E_BASE_URL:-http://localhost}/api/auth/test-login -H 'Content-Type: application/json' -d '{"role":"admin"}' 2>&1 | head -c 100 || echo "FAILED")
echo "- Test Login: ${TEST_LOGIN_STATUS}..." >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Run tests and capture output
echo "## Test Execution" >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
cd /Users/liucong/code/JUNziweb/e2e
npx playwright test --reporter=list 2>&1 | tee "$LOG_FILE"
TEST_EXIT=$?
echo '```' >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Parse results
echo "## Summary" >> "$REPORT_FILE"
TOTAL=$(grep -c "passed\|failed" "$LOG_FILE" 2>/dev/null || echo "0")
PASSED=$(grep -c "passed" "$LOG_FILE" 2>/dev/null || echo "0")
FAILED=$(grep -c "failed" "$LOG_FILE" 2>/dev/null || echo "0")
echo "- Total: ${TOTAL}" >> "$REPORT_FILE"
echo "- Passed: ${PASSED}" >> "$REPORT_FILE"
echo "- Failed: ${FAILED}" >> "$REPORT_FILE"
echo "- Exit Code: ${TEST_EXIT}" >> "$REPORT_FILE"

echo ""
echo "Report saved to: $REPORT_FILE"
echo "Log saved to: $LOG_FILE"
exit $TEST_EXIT
