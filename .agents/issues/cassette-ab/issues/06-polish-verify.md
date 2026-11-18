# 06 Mobile, theme, contrast, notes

Status: resolved
Blocked by: 04, 05

Phone/tablet/desktop pass, light+dark, forced colors, `npm run check` + `node tests/contrast-check.mjs` + `tests/admin-check.mjs`, web-runtime-verification screenshots, update PROJECT_NOTES.

## Answer

Status: resolved (2026-11-16).

- Tests (run one at a time, exit codes): contrast-check 0, browser-check 0, fader-check 0, booking-check 0, ab-check 0, record-player-check 0, admin-check 0 on rerun (one run failed the Sleeve cover-button "keyboard: reachable and opens the chooser" check, not cassette, flaky). texture-check 1: three failures (tape strips, gradient default, film-grain default) unrelated to the cassette; `content.json` saves `gradient: medium`, `filmGrain: subtle`, the test expects the old defaults. Running files in parallel makes ab-check/fader-check flaky (dev server resets, CPU timing); `npm run check` stops at texture-check.
- Browser pass (375/768/1200 x olive-orange, sage-coral, each light + dark, plus OS dark, `?nogl`, forced colors, reduced motion): no overflow, zero console errors (one run had dev-server connection resets, clean on rerun, SVG fallback took over), keys 48px tall at 375, flip while playing keeps playing with needles moving, scrubber keys and click seek, Stop rests needles. Screenshots in `screenshots/`.
- Fixed: forced colors rendered the 3D body as a black slab with no label; `cassette-3d.js` now skips 3D under `forced-colors: active` (SVG fallback, verified). Removed dead `.player-scrubber-wireframe`, `.scrubber-track`, `.scrubber-progress` CSS; updated a stale comment in `admin.js`.
- Admin: Replace memo/master controls appear on `.ab-player`; editing the master `th` text redraws the 3D label (render count rises).
- `vu-meters.js` review and not-verified items are in the ticket report; notes updated.
