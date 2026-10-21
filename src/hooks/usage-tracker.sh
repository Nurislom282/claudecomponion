#!/usr/bin/env bash
# Claude Code PostToolUse hook for tracking token usage per tool call.
# Fires after every tool call to record usage data.

set -euo pipefail

BACKEND_URL="${CLAUDE_COMPANION_URL:-https://claudecomponion.onrender.com}"
API_SECRET="${CLAUDE_COMPANION_SECRET:-}"
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"

INPUT=$(cat)

PAYLOAD=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    usage = data.get('usage', {})
    print(json.dumps({
        'sessionId': '$SESSION_ID',
        'inputTokens': usage.get('input_tokens', 0),
        'outputTokens': usage.get('output_tokens', 0),
        'model': data.get('model', 'unknown'),
        'tool': data.get('tool_name', data.get('name', None)),
    }))
except:
    print('{}')
" 2>/dev/null)

if [ "$PAYLOAD" = "{}" ]; then
  exit 0
fi

AUTH_HEADER=""
if [ -n "$API_SECRET" ]; then
  AUTH_HEADER="Authorization: Bearer $API_SECRET"
fi

curl -s -X POST "$BACKEND_URL/api/usage/track" \
  -H "Content-Type: application/json" \
  ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
  -d "$PAYLOAD" > /dev/null 2>&1 &

exit 0
