#!/bin/zsh
# Refresh "External Notes.md" from its Google Doc. Safe: keeps the old file on any failure.
DOC_ID="1pKumu8AMftI42kU4cJL_V7S-5Z1vxSb3Tmt0WJ_V64Q"
ROOT="${0:A:h:h}"
OUT="$ROOT/External Notes.md"
TMP="$(mktemp)"
if curl -fsSL --max-time 10 "https://docs.google.com/document/d/$DOC_ID/export?format=md" -o "$TMP" && [ -s "$TMP" ]; then
  cmp -s "$TMP" "$OUT" || mv "$TMP" "$OUT"
fi
rm -f "$TMP"
exit 0
