# 02 Deck markup, J-card, CSS fallback

Status: resolved
Blocked by: none

Replace the `.ab-compare` block in `work.html`: canvas slot (with the prototype's SVG cassette as the no-WebGL / reduced-motion fallback), key row, counter, scrubber, VU meters, J-card table. Keep `data-edit-key`s and `data-media-clip` hooks. Style in `wireframe.css` per Analog Studio (matte, palette tokens, light+dark).

## Answer

Done 2026-11-16. `work.html` `.ab-compare` section replaced with the cassette deck (static, both sides); styles in `wireframe.css`.

Markup contract for ticket 03+ (all in `work.html`):
- Section `.ab-compare[data-version="memo|master"]` drives everything visual (cassette side text/stripe, lamps, J-card column). Setting `section.dataset.version` is the only state hook CSS needs.
- Deck root `.cassette-deck.ab-player` (`data-playing="false|true"` reserved, no CSS keyed on it yet); admin.js uses `.ab-player` as the host of audio Replace controls.
- Audio: `audio[data-version=memo|master][data-media-clip=work.ab.memo|master][data-src]` unchanged.
- Canvas slot `#cassette-stage.cassette-stage`; SVG fallback `#cassette-svg`, flip target `#cassette-face`. Add a `<canvas>` as a child and set `data-webgl` on the stage to hide the SVG (CSS ready).
- Reels `#cs-reel-l`, `#cs-reel-r`: set `--reel` (e.g. `40deg`) via `style.setProperty`. Tape pack circles `#cs-pack-l` (r 12..24, starts 22), `#cs-pack-r` (r starts 12): set the `r` attribute. Side text is static per side (`.cs-side[data-version]`), no JS needed.
- Needles `#ab-needle-l`, `#ab-needle-r` (`.vu-needle`): set `--needle` (rest `-40deg`, full `40deg`).
- Keys: `#ab-key-play` (`aria-pressed`), `#ab-key-pause`, `#ab-key-stop`, `#ab-key-flip` (all `.deck-key`, real buttons; Play key's `aria-pressed="true"` is the latched look).
- Counter `#ab-time.ab-time`, `#ab-dur.ab-dur` (`.deck-digits`); scrubber `#ab-seek.ab-seek` (range, `--pct` for the fill); side readout `.deck-label` (aria-live) as before; lamps `.side-lamps .side-lamp[data-version]`.
- Edit keys: kept all `work.ab.*`, `work.h2/p.*` keys; side lamps reuse `work.ab.label-memo` / `work.ab.label-master` (no new keys). Hint key `work.p.slide-the-switch-while-it-plays` kept, copy now says "Flip the tape". Keys and SVG text are unkeyed (controls / aria-hidden decoration).
- J-card: `.jcard > table.ab-specs` (paper, ink hairlines; head cells get "A . " / "B . " via CSS).

Removed: `.ab-slide*`, `.ab-slide-label*`, `.ab-slide-row`, old `.audio-widget` faceplate block (glossy; ADR 0005 gloss no longer used), `.deck-display`, `.deck-reels`/`.reel`, `.transport*` (all only used by the old deck). Kept: `.ab-strip`, `.ab-hint`, `.ab-seek`, `.ab-specs`, generic `.player-scrubber-wireframe` / `.scrubber-*`. `textures.css`: removed the etched spec-table rules (the J-card is paper, not metal).

`ab-compare.js`: one-line guard only (`if (!root || !root.querySelector('.ab-slide')) return;`), so it is inert (no errors) until ticket 03 rewrites it.

Dependents on removed/changed things (tests need updating by 03/06): `tests/ab-check.mjs` (whole file: `.ab-slide`, `.deck-label` text), `tests/admin-check.mjs` lines ~723-725, 1048-1067, 1092-1098, 1260 (`.ab-slide`, `.ab-play`, `.ab-slide-labels`), `tests/record-player-check.mjs` lines 63 (`.ab-player .deck-reels` count === 1), 192-201 (`.ab-play`). `admin.js` 1073 (`.ab-player`, kept) and 1165 (comment only), `content-loader.js` (only a comment), `record-player.js` (comment) need no change.

Verified: 375px and 1100px, light + dark themes, no horizontal overflow, zero console errors (Playwright, reduced motion); keys 48px tall; `node tests/contrast-check.mjs` all PASS; `browser-check` PASS.
Failures seen, not fixed: `ab-check` (timeout, old selectors), `record-player-check` (deck-reels check + A/B timeouts), `admin-check` (not run to completion; uses `.ab-slide`), `texture-check` (tape strips, gradient stops, film grain default; unrelated to this ticket, likely pre-existing).
