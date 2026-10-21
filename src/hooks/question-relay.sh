#!/usr/bin/env bash
# Claude Code PreToolUse hook for AskUserQuestion
# Posts the question to the companion backend so the mobile app gets notified.
# Reads the tool input JSON from stdin.

set -euo pipefail

BACKEND_URL="${CLAUDE_COMPANION_URL:-http://localhost:3847}"
API_SECRET="${CLAUDE_COMPANION_SECRET:-}"
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"

INPUT=$(cat)

QUESTION=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tool_input = data.get('tool_input', data.get('input', data))
    qs = tool_input.get('questions', [{}])
    q = qs[0] if qs else {}
    payload = {
        'sessionId': '$SESSION_ID',
        'question': q.get('question', ''),
        'header': q.get('header', ''),
        'options': q.get('options', []),
        'multiSelect': q.get('multiSelect', False),
    }
    print(json.dumps(payload))
except:
    print(json.dumps({'sessionId': '$SESSION_ID', 'question': 'Claude is asking a question', 'options': []}))
" 2>/dev/null)

AUTH_HEADER=""
if [ -n "$API_SECRET" ]; then
  AUTH_HEADER="Authorization: Bearer $API_SECRET"
fi

curl -s -X POST "$BACKEND_URL/api/questions" \
  -H "Content-Type: application/json" \
  ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
  -d "$QUESTION" > /dev/null 2>&1 &

exit 0
