# 01: Content loader

**What to build:** Visitors get saved Site Content and Site Defaults applied before first paint on every page, from one JSON content file that stores only differences from the authored HTML. Editable text carries stable keys. The public theme toolbar is hidden from visitors. A missing or malformed file silently falls back to authored values. Starts `tests/admin-check.mjs` (added to `npm run check`) on the one Playwright seam.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] Text keys on headings, paragraphs and captions on all four pages; booking form copy and Session Type names have none
- [ ] A content file changes text and defaults on load with no visible flash
- [ ] Missing or malformed file leaves the site unchanged, no console errors
- [ ] Text applied with textContent only
- [ ] Theme toolbar not shown to visitors; reduced-motion and contrast preferences still win
- [ ] admin-check covers the above and passes in `npm run check`
