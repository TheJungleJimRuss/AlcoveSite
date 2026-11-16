# 06: Sleeve covers

**What to build:** In Edit mode the Sleeve sticking out of the Work page pile has a Replace cover button; the picked photo shows on that Sleeve at once (clean, unblended), is staged like other photos, and Save stores it as the song's `cover` in `content.json`. The Add song form takes an optional cover. Covers can be replaced, not removed. See "Amendment 2026-11-13: Sleeve covers" in `../spec.md`.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] `songs[].cover` (optional, `images/` whitelist) is read by `content-loader.js`; an invalid cover is dropped without invalidating the song
- [x] Record player draws a cover unblended, centre-cropped over the Sleeve face, pattern hidden; cover follows its song on reorder
- [x] Replace cover button follows the sticking-out Sleeve, only in Edit mode, keyboard reachable, labelled "Replace cover: <title>"
- [x] Photo shrunk to 1200px long edge, staged in IndexedDB, previewed, kept in the songs draft across reload
- [x] Changes panel shows "Cover changed: <title>" with revert
- [x] Add song form has an optional cover
- [x] Save uploads covers before `content.json`; cleanup deletes replaced covers that nothing references
- [x] Tests in `tests/admin-check.mjs` and `tests/record-player-check.mjs`; `npm run check` passes
