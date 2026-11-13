# 03: Save to the Content branch

**What to build:** Save commits the merged content file to the `content` branch of the repo through the GitHub contents API, creating the branch from main if missing, and tells the editor changes go live once the developer merges. While unlocked, the admin loads the Content branch file so saved-but-unmerged work shows.

**Blocked by:** 02: Unlock Admin mode and edit text in place

**Status:** done

- [ ] Save shows the change count and sends one contents PUT with correct branch, JSON and SHA
- [ ] Branch auto-created from main when absent
- [ ] SHA mismatch shows a conflict message with a reload-and-reapply path; nothing silently overwritten
- [ ] Bad, expired or under-scoped token shows a clear error
- [ ] Token only ever sent to api.github.com, never in URLs or the content file
- [ ] admin-check mocks api.github.com for all cases above
