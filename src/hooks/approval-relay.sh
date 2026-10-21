#!/usr/bin/env bash
# Claude Code PreToolUse hook for tool calls that need approval.
# Posts the tool call details to the companion backend for remote approval.

set -euo pipefail

BACKEND_URL="${CLAUDE_COMPANION_URL:-http://localhost:3847}"
API_SECRET="${CLAUDE_COMPANION_SECRET:-}"
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"

INPUT=$(cat)

PAYLOAD=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tool_name = data.get('tool_name', data.get('name', 'unknown'))
    tool_input = data.get('tool_input', data.get('input', {}))

    description = tool_input.get('description', '')
    command = tool_input.get('command', '')
    file_path = tool_input.get('file_path', '')

    risk = 'normal'
    risky_tools = ['Bash', 'Write', 'Edit']
    risky_cmds = ['rm ', 'git push', 'git reset', 'git checkout']
    if tool_name in risky_tools:
        risk = 'medium'
    if any(c in command for c in risky_cmds):
        risk = 'high'

    print(json.dumps({
        'sessionId': '$SESSION_ID',
        'toolName': tool_name,
        'description': description,
        'command': command,
        'filePath': file_path,
        'riskLevel': risk,
    }))
except:
    print(json.dumps({'sessionId': '$SESSION_ID', 'toolName': 'unknown', 'riskLevel': 'normal'}))
" 2>/dev/null)

AUTH_HEADER=""
if [ -n "$API_SECRET" ]; then
  AUTH_HEADER="Authorization: Bearer $API_SECRET"
fi

curl -s -X POST "$BACKEND_URL/api/approvals" \
  -H "Content-Type: application/json" \
  ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
  -d "$PAYLOAD" > /dev/null 2>&1 &

exit 0
