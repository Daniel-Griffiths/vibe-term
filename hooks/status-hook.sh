#!/bin/bash

# Claude Code Hook Script for Vibe-Term Status Detection
# This script is called by Claude Code hooks to notify vibe-term of status changes

HOOK_TYPE="$1"
PROJECT_DIR="$2"
SESSION_ID="$3"

# Default to web server port, but allow override
VIBE_TERM_PORT=${VIBE_TERM_PORT:-6969}
IPC_ENDPOINT="http://localhost:${VIBE_TERM_PORT}/api/ipc/claude-hook"

# Extract project ID from directory name or use session ID
PROJECT_ID=$(basename "$PROJECT_DIR" 2>/dev/null || echo "$SESSION_ID")

# Create IPC args data
IPC_DATA=$(cat <<EOF
{
  "args": ["$HOOK_TYPE", "$PROJECT_ID"]
}
EOF
)

# Send hook notification to vibe-term via IPC proxy
if command -v curl >/dev/null 2>&1; then
  curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$IPC_DATA" \
    "$IPC_ENDPOINT" \
    --max-time 1 \
    --connect-timeout 1 \
    >/dev/null 2>&1
elif command -v wget >/dev/null 2>&1; then
  echo "$IPC_DATA" | wget -q -O- \
    --header="Content-Type: application/json" \
    --post-data="$IPC_DATA" \
    --timeout=1 \
    "$IPC_ENDPOINT" \
    >/dev/null 2>&1
fi

# Also write to a temporary file as backup communication method
TEMP_DIR="${TMPDIR:-/tmp}"
HOOK_FILE="$TEMP_DIR/vibe-term-hook-$PROJECT_ID"
echo "$HOOK_DATA" > "$HOOK_FILE"

exit 0