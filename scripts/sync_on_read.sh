#!/bin/zsh
# Claude Code PreToolUse(Read) hook: sync External Notes.md before it is read.
case "$(cat)" in
  *"External Notes.md"*) "${0:A:h}/sync_external_notes.sh" ;;
esac
exit 0
