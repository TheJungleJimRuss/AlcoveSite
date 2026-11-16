# 04: Cleanup, failure ordering and media conflicts

**What to build:** Saving media is safe: replaced or removed files are deleted from the repo only if nothing else still uses them, a failed upload stops the Save without writing the content file, and a conflict on a staged slot or Song shows the existing conflict message and keeps the drafts.

**Blocked by:** 02: Replace audio and video slots; 03: Songs on Work

**Status:** done

- [ ] After a successful Save, replaced/removed files are deleted only when no remaining slot, Song or authored page markup references them; shared files are kept
- [ ] A failed file upload stops Save, names the failed file, keeps drafts, and the content file is not written
- [ ] If the branch changed for a slot or Song being saved, conflict message with reload-and-reapply; drafts kept; other-key changes still merge
- [ ] File names sanitized and unique (slug plus short hash); editors cannot choose paths
- [ ] `tests/admin-check.mjs` covers all of the above; `npm run check` passes
