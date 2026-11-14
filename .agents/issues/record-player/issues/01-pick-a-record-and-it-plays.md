# 01: Pick a record and it plays

**What to build:** On the Work page, the "Recent Recordings" tape deck and track rows are replaced by the Record player: a flat top-down turntable (plinth, platter, slip mat, record with grooves and centre label, tonearm at rest) and a Crate of four Sleeves (placeholder typographic designs in palette tokens, one per genre, with a cover-art slot). Clicking a Sleeve (or Enter/Space) puts its record on the platter, sets the arm on the record and plays; clicking the current Sleeve toggles pause; another Sleeve swaps records. At track end the arm returns to rest and nothing else starts. Genre tabs show/hide Sleeves by `data-genre` without stopping playback. A play/pause button and the timeline stay below the turntable; prev/next keys go. Phones (<=640px): turntable full width, Sleeves in a horizontal scroll-snap row below. Static states only here (no animation yet); the arm simply shows rest vs on-record.

See spec: `.agents/issues/record-player/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Tape deck display, reels, track rows and Play Preview buttons removed from the sampler; A/B deck untouched
- [x] Sleeve click/keyboard loads, plays, toggles pause, swaps; track end stops and rests the arm (no auto-advance)
- [x] Current record title and play state announced (live region) and shown on the centre label
- [x] Genre filter hides non-matching Sleeves; filtering does not stop playback
- [x] Only one media element plays at once (record player vs A/B deck); header oscilloscope still reacts
- [x] Sampler script moved out of the page into its own JS file
- [x] `work.track.<genre>.title`/`.sub` edit keys live on Sleeve text; `.play` keys removed; Admin Edit mode edits Sleeve text instead of loading the record
- [x] Works with all four palette variants; no horizontal overflow at 375px
- [x] New `tests/record-player-check.mjs` in `npm run check`; `tests/admin-check.mjs` updated; `npm run check` and `node tests/contrast-check.mjs` pass
- [x] GLOSSARY: Record player, Crate, Sleeve, Tonearm
