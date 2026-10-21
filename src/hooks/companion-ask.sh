#!/usr/bin/env bash
# Posts a question to companion app, polls until answered from phone/browser.
# Usage: companion-ask.sh "question" "header" "opt1|desc1" "opt2|desc2" ...

BACKEND="http://localhost:3847"
SECRET="1df346d299f1fafb112b948645208100d81697bf2c04b7d1"
SID="${CLAUDE_SESSION_ID:-session-$$}"

QUESTION="$1"
HEADER="${2:-Question}"
shift 2 2>/dev/null

# Build and post question via python (avoids all shell quoting issues)
QID=$(python3 << PYEOF
import json, urllib.request, sys

question = """$QUESTION"""
header = "$HEADER"
backend = "$BACKEND"
secret = "$SECRET"
sid = "$SID"

opts = []
raw_opts = """$@""".strip()
if raw_opts:
    for arg in raw_opts.split('" "'):
        arg = arg.strip('"')
        parts = arg.split('|', 1)
        opts.append({'label': parts[0], 'description': parts[1] if len(parts) > 1 else ''})

payload = json.dumps({
    'sessionId': sid,
    'question': question,
    'header': header,
    'options': opts,
    'multiSelect': False
}).encode()

req = urllib.request.Request(
    f"{backend}/api/questions",
    data=payload,
    headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"},
    method="POST"
)
resp = urllib.request.urlopen(req, timeout=5)
data = json.loads(resp.read())
print(data.get('questionId', ''))
PYEOF
)

if [ -z "$QID" ]; then
  echo "ERROR: Failed to post question" >&2
  exit 1
fi

echo "Question sent to companion app (ID: $QID)" >&2
echo "Waiting for answer from phone/browser..." >&2

# Poll every 2 seconds for up to 5 minutes
for i in $(seq 1 150); do
  ANSWER=$(python3 << PYEOF
import json, urllib.request
req = urllib.request.Request(
    "$BACKEND/api/questions/$QID/poll",
    headers={"Authorization": "Bearer $SECRET"}
)
resp = urllib.request.urlopen(req, timeout=3)
data = json.loads(resp.read())
if data.get('status') == 'answered':
    print(data.get('answer', ''))
PYEOF
  )

  if [ -n "$ANSWER" ]; then
    echo "$ANSWER"
    exit 0
  fi

  sleep 2
done

echo "TIMEOUT" >&2
exit 1
