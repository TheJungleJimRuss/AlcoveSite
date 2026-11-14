# 03: Songs on Work (add, remove, rename, reorder)

**What to build:** The Work page's Songs become an editable list stored in the content file and rendered by script, with the authored HTML as fallback. In Edit mode Seth can add a Song (title plus audio file), remove one, rename it in place and move it up or down, up to 20. The genre tabs, genre labels and genre filtering are retired, and the player plays the saved order.

**Blocked by:** 01: Replace photos end-to-end

**Status:** done

- [x] Songs are an ordered list (title, audio file) in the content file; Work builds the Crate/Sleeves or rows from it; missing or malformed data falls back to authored HTML
- [x] Genre tabs, genre wording and the genre filter are gone from markup, script and styles; glossary wording for Sleeve/Crate updated
- [x] Add (title + audio file with type/size checks), remove, rename in place, up/down buttons (work on phones); 20-song cap with a clear message
- [x] Player, now-playing label and accessible names follow titles and order; titles via `textContent` only
- [x] Staged songs count in Save; Save uploads new audio first, then `content.json`; revert before saving
- [x] `tests/admin-check.mjs` and `tests/browser-check.mjs` pass; `npm run check` passes
