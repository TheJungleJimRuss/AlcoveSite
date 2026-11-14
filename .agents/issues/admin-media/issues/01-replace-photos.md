# 01: Replace photos end-to-end

**What to build:** With Edit mode on, Seth sees a Replace control on every photo Media slot (studio photos, hero photo, About portrait). He picks a photo, it is shrunk in the browser, previewed in place, staged with his other drafts, and one Save uploads the file and then `content.json` to the Content branch. After reload (and for visitors) the slot shows the new photo, applied before first paint, with the authored photo as fallback.

**Blocked by:** None (can start immediately).

**Status:** done

- [ ] Every photo Media slot has a stable key; saved slot paths live in the content file and are applied by the loader before first paint, falling back to the authored file if missing or malformed
- [ ] Replace control appears only while Edit mode is on; keyboard operable, labelled, 44px target on phones
- [ ] Photo is resized to about 2000px on the long edge and re-encoded before staging; wrong type or over the size cap is rejected with a clear message and no request
- [ ] In-place preview; staged replacement counted in the Save count, revertible before saving, survives reload where the browser allows, beforeunload warning while staged
- [ ] Save sends the new file PUT first, then the `content.json` PUT, with correct branch and sanitized unique file name; token only to api.github.com
- [ ] Existing alt text kept; booking form untouched
- [ ] `tests/admin-check.mjs` extended with small fixtures; `npm run check` passes
