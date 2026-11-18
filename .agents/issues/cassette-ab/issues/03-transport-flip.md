# 03 Transport and flip logic

Status: resolved
Blocked by: 02

Rewrite `ab-compare.js`: Play/Pause/Stop/Flip keys, side state, playhead carry-over, blob-URL clip loading (keep current logic), scrubber, keyboard (Space, F). Rewrite `tests/ab-check.mjs`; keep it in `npm run check`.

## Answer

Done 2026-11-16. `ab-compare.js` rewritten for the cassette deck; no markup/CSS changes were needed (all hooks existed).

Behaviour: Play/Pause/Stop/Flip keys, tap on `#cassette-stage` flips, Space/F when focus is not in a control/text/link and the deck is on screen. Flip = WAAPI on `#cassette-face` (260ms out, version swap, 300ms in), skipped under `prefers-reduced-motion`; a second flip while one runs is ignored; transport keys and seek are ignored while flipping. Flip while playing resumes on the other side. Stop returns to 0:00. Reels (`--reel` on `#cs-reel-l/r`) turn at 200deg/s only while playing and not flipping (rAF, none under reduced motion); tape packs `r` = 12..24 (`#cs-pack-l` shrinks, `#cs-pack-r` grows). Blob-URL loading, IntersectionObserver preload, pendingTime/seekTo, `names` from `th[data-version]`, `data-src`/`data-src-fallback` handling kept.

Event contract (bubbles from `section.ab-compare`):
- `ab:state`: detail `{version, playing, flipping, progress (0-1), time, duration, reel (deg), audio}`; fired on every sync (play/pause/ended/timeupdate/loadedmetadata/seeked, seeks, flips) and each animation frame while playing and not flipping. `playing` is `!audio.paused`, so it is false during a flip (audio is paused for the flip and resumes after).
- `ab:flip-start`: `{from, to, outMs, inMs}` (outMs/inMs are 0 when reduced motion); the version/`data-version` swap happens after `outMs`.
- `ab:flip-end`: `{version}` (after the in animation and after play resumes).
- `window.__abDeck = {flip (returns a promise), play, pause, stop, seek(t), state()}`.

Tests: `tests/ab-check.mjs` rewritten (flip keeps playhead, double flip guard, events, tap, F/Space, aria-pressed, reels, pack, flip while playing, pause, seek, stop, edit keys, reduced motion, late-seek, early-flip). `tests/admin-check.mjs` and `tests/record-player-check.mjs` cassette lines updated.
