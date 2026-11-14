# 04: Flip through a milk crate

**What to build:** The Crate becomes a realistic plastic milk crate you flip through, replacing the 2x2 grid of Sleeves. See the spec's "Amendment 2026-11-13: Milk crate" for look, flipping, selecting, genre and motion rules.

**Blocked by:** 01, 02, 03 (all resolved)

**Status:** resolved

- [x] Milk crate drawn in CSS/SVG (grid sides, rim, handle), palette-tinted, Sleeves stand on end with the front cover visible and the edges behind showing titles
- [x] Flip forward/back by buttons, arrow keys, wheel and swipe; stops at the ends; announces "Record N of M: Title"
- [x] Selecting the front Sleeve: Sleeve lifts, disc slides out and travels to the platter, Sleeve drops back, arm swings in; loaded Sleeve marked in the crate; clicking it again toggles pause
- [x] Genre tabs filter the crate and flip to the first match without stopping playback
- [x] Reduced motion: instant state changes; forced colors: controls stay visible
- [x] Desktop beside the turntable, phones below it; no horizontal overflow at 375px
- [x] Admin Edit mode still edits Sleeve titles; `tests/record-player-check.mjs` and `tests/admin-check.mjs` updated; `npm run check` and `node tests/contrast-check.mjs` pass
