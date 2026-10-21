#!/usr/bin/env bash
# Claude Code hook that reports tool usage activity to the companion backend.
# Install as a NotificationHook on tool_use events.

set -euo pipefail

BACKEND_URL="${CLAUDE_COMPANION_URL:-https://claudecomponion.onrender.com}"
API_SECRET="${CLAUDE_COMPANION_SECRET:-}"
SESSION_ID="${CLAUDE_SESSION_ID:-session-$(date +%s)}"

AUTH_HEADER=""
if [ -n "$API_SECRET" ]; then
  AUTH_HEADER="Authorization: Bearer $API_SECRET"
fi

# Read the hook input from stdin
INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); i=d.get('tool_input',{}); print(i.get('file_path',i.get('file','')))" 2>/dev/null || echo "")
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")
CONTENT=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); i=d.get('tool_input',{}); c=i.get('content',i.get('new_string','')); print(c[:300] if c else '')" 2>/dev/null || echo "")

# Build message
if [ -n "$COMMAND" ]; then
  MESSAGE="Running: $COMMAND"
elif [ -n "$FILE_PATH" ]; then
  MESSAGE="$TOOL_NAME: $FILE_PATH"
else
  MESSAGE="Using $TOOL_NAME"
fi

curl -s -X POST "$BACKEND_URL/api/activity" \
  -H "Content-Type: application/json" \
  ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
  -d "$(python3 -c "
import json
print(json.dumps({
    'sessionId': '$SESSION_ID',
    'type': 'tool_use',
    'tool': '$TOOL_NAME',
    'message': $(python3 -c "import json; print(json.dumps('$MESSAGE'))" 2>/dev/null || echo '""'),
    'filePath': '$FILE_PATH',
    'command': $(python3 -c "import json; print(json.dumps('''$COMMAND'''))" 2>/dev/null || echo '""'),
    'content': $(python3 -c "import json; print(json.dumps('''$CONTENT'''))" 2>/dev/null || echo '""'),
}))
")" > /dev/null 2>&1 &

exit 0
