#!/usr/bin/env bash
# Registers this Claude Code session with the companion backend on startup.

BACKEND="http://localhost:3847"
SECRET="1df346d299f1fafb112b948645208100d81697bf2c04b7d1"
SID="${CLAUDE_SESSION_ID:-session-$$}"

curl -s --max-time 3 -X POST "$BACKEND/api/sessions" \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SID\",\"workingDir\":\"$PWD\",\"model\":\"${CLAUDE_MODEL:-unknown}\"}" \
  > /dev/null 2>&1 &

exit 0
