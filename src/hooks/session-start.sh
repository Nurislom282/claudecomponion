#!/usr/bin/env bash
# Claude Code hook that fires on session start to register with the companion backend.

set -euo pipefail

BACKEND_URL="${CLAUDE_COMPANION_URL:-https://claudecomponion.onrender.com}"
API_SECRET="${CLAUDE_COMPANION_SECRET:-}"
SESSION_ID="${CLAUDE_SESSION_ID:-session-$(date +%s)}"
WORKING_DIR="${PWD}"

AUTH_HEADER=""
if [ -n "$API_SECRET" ]; then
  AUTH_HEADER="Authorization: Bearer $API_SECRET"
fi

curl -s -X POST "$BACKEND_URL/api/sessions" \
  -H "Content-Type: application/json" \
  ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
  -d "$(python3 -c "
import json, os
print(json.dumps({
    'sessionId': '$SESSION_ID',
    'workingDir': '$WORKING_DIR',
    'startedAt': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
    'model': os.environ.get('CLAUDE_MODEL', 'unknown'),
}))
")" > /dev/null 2>&1 &

exit 0
