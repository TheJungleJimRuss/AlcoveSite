#!/bin/bash
# Sync Google Doc to Project Charter.md
DOC_ID="1pKumu8AMftI42kU4cJL_V7S-5Z1vxSb3Tmt0WJ_V64Q"
TARGET_FILE="Project Charter.md"

echo "Syncing $TARGET_FILE from Google Docs..."
curl -sL "https://docs.google.com/document/d/${DOC_ID}/export?format=txt" | sed '1s/^\xef\xbb\xbf//' > "$TARGET_FILE"

if [ -s "$TARGET_FILE" ]; then
  echo "Successfully updated $TARGET_FILE from Google Docs!"
else
  echo "Error: Failed to fetch or file is empty."
  exit 1
fi
