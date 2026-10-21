#!/usr/bin/env bash
# PreToolUse hook — forwards AskUserQuestion to companion BEFORE terminal asks.

BACKEND="http://localhost:3847"
SECRET="1df346d299f1fafb112b948645208100d81697bf2c04b7d1"
SID="${CLAUDE_SESSION_ID:-session-$$}"

INPUT=$(cat 2>/dev/null || echo '{}')
TMPFILE=$(mktemp /tmp/companion-pre.XXXXXX)
echo "$INPUT" > "$TMPFILE"

TOOL=$(python3 -c "import json;print(json.load(open('$TMPFILE')).get('tool_name',''))" 2>/dev/null || echo "")

if [ "$TOOL" = "AskUserQuestion" ]; then
  export TMPFILE BACKEND SECRET SID
  python3 << 'PYEOF'
import json, urllib.request, os

tmpfile = os.environ["TMPFILE"]
backend = os.environ["BACKEND"]
secret = os.environ["SECRET"]
sid = os.environ["SID"]

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
PYEOF
fi

rm -f "$TMPFILE"
exit 0
