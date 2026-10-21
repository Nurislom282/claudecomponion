#!/usr/bin/env bash
# Companion app hook — reports Claude's tool usage automatically.
# Also forwards AskUserQuestion to the companion app's Questions tab.

BACKEND="http://localhost:3847"
SECRET="1df346d299f1fafb112b948645208100d81697bf2c04b7d1"
SID="${CLAUDE_SESSION_ID:-session-$$}"

INPUT=$(cat 2>/dev/null || echo '{}')

# Save to temp file so python can read it cleanly
TMPFILE=$(mktemp /tmp/companion-hook.XXXXXX)
echo "$INPUT" > "$TMPFILE"

TOOL=$(python3 -c "import json;print(json.load(open('$TMPFILE')).get('tool_name',''))" 2>/dev/null || echo "")
[ -z "$TOOL" ] && rm -f "$TMPFILE" && exit 0

# If AskUserQuestion, forward each question to the companion questions API
if [ "$TOOL" = "AskUserQuestion" ]; then
  python3 << 'PYEOF'
import json, urllib.request, os

tmpfile = os.environ.get("TMPFILE", "")
backend = os.environ.get("BACKEND", "")
secret = os.environ.get("SECRET", "")
sid = os.environ.get("SID", "")

try:
    data = json.load(open(tmpfile))
    questions = data.get("tool_input", {}).get("questions", [])
    for q in questions:
        payload = json.dumps({
            "sessionId": sid,
            "question": q.get("question", ""),
            "header": q.get("header", ""),
            "options": q.get("options", []),
            "multiSelect": q.get("multiSelect", False)
        }).encode()
        req = urllib.request.Request(
            f"{backend}/api/questions",
            data=payload,
            headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"},
            method="POST"
        )
        urllib.request.urlopen(req, timeout=3)
except Exception:
    pass
PYEOF
fi

# Build activity message
if [ "$TOOL" = "AskUserQuestion" ]; then
  MSG=$(python3 -c "import json;qs=json.load(open('$TMPFILE')).get('tool_input',{}).get('questions',[]);print('Asking: '+qs[0].get('question','')[:100] if qs else 'Asking question')" 2>/dev/null || echo "Asking question")
else
  FPATH=$(python3 -c "import json;i=json.load(open('$TMPFILE')).get('tool_input',{});print(i.get('file_path',i.get('file','')))" 2>/dev/null || echo "")
  CMD=$(python3 -c "import json;print(json.load(open('$TMPFILE')).get('tool_input',{}).get('command','')[:200])" 2>/dev/null || echo "")
  if [ -n "$CMD" ]; then
    MSG="Running: $(echo "$CMD" | head -c 100)"
  elif [ -n "$FPATH" ]; then
    MSG="$TOOL: $FPATH"
  else
    MSG="Using $TOOL"
  fi
fi

# Send to activity feed
ACTIVITY_JSON=$(python3 -c "
import json
print(json.dumps({
    'sessionId': '$SID',
    'type': 'tool_use',
    'tool': '$TOOL',
    'message': '''$MSG''',
    'filePath': '${FPATH:-}',
    'command': ''
}))
" 2>/dev/null || echo '{}')

curl -s --max-time 3 -X POST "$BACKEND/api/activity" \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d "$ACTIVITY_JSON" > /dev/null 2>&1 &

rm -f "$TMPFILE"
exit 0
