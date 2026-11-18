# 07 Realistic cassette player

Status: resolved
Blocked by: none (follows 06)

User request: a realistic model of a real cassette player replaces the deck; remove the dials; reference real players; remove the progress bar; icons only on the buttons.

## Answer

Status: resolved (2026-11-16).

- Reference design: a top-loading portable recorder in the style of the Sony TC-D5M (also Panasonic RQ-series): flat slab body, silver-grey upper shell over a dark base with a visible seam, cassette bay on top with a hinged clear door, a recessed row of four chunky transport keys at the front, stereo speaker slots either side, screws, rubber feet, headphone jacks. Looked up by text search only (no photos copied into the repo); shapes are original.
- Model: `assets-src/cassette-player/build_player.py` (+ `cassette-player.blend`), exported to `models/cassette-player.glb` (about 230 KB, about 6.1k triangles, matte materials). Cassette nodes keep their ADR 0007 names; new nodes `player`, `cassette`, `door`, `keyPlay`, `keyPause`, `keyStop`, `keyFlip`. Old `models/cassette.glb` deleted (`assets-src/cassette/` kept).
- `cassette-3d.js`: loads the player, frames it, palette-tinted lights plus a shadow-casting key light, Play key latches down while playing, Flip = door opens, tape lifts, turns over, drops back, door closes (driven by `ab:flip-start`/`ab:flip-end`; `ab-compare.js` timing 700+700 ms). Fallback SVG (`?nogl`, no WebGL, reduced motion, forced colors) redrawn as a simple player. `window.__cassette3d.pose(t)` is a test/screenshot hook.
- Removed: both VU dials (markup, CSS, `vu-meters.js`, its script tag, its test lines), the `#ab-seek` progress bar (`__abDeck.seek` stays). Kept: counter digits, side lamps, J-card, edit keys, `data-media-clip`.
- Page keys: inline SVG glyphs only (play, pause, stop, flip) with `aria-label`, no visible text.
- Tests: `tests/ab-check.mjs` updated (dials/scrubber gone, icon-only keys, door closes after flip). See the report for the suite results and screenshot paths.
