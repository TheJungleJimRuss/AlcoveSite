# Spec: Cassette A/B (rework of "Voice Memo vs. Finished Song")

Status: APPROVED 2026-11-16. Prototype (`prototype/index.html`) approved as layout reference. Render approach: Hybrid (Blender-modelled cassette GLB in three.js; keys, meters and J-card stay HTML), recommended because the user is undecided; revisit in ticket 01.

## Problem
The current memo/master deck (`ab-compare.js`, `.ab-*` CSS in `wireframe.css`) is a slide switch + seek bar + 4-row table. It looks generic next to the Record player, and flipping with a slide switch is not a physical, memorable interaction.

## Goal
Replace the deck with a matte Analog Studio **cassette player**. One cassette: **Side A = Voice Memo, Side B = Finished Master**. Flipping the tape is the A/B action. Same single clip pair as today (`media/voice-memo-rough.wav`, `media/track-3-acoustic.wav`).

## Behaviour
- Cassette sits in a deck with a tape window. Reels turn while playing; the tape pack moves from the left reel to the right with progress.
- **Flip** (Eject key, or tap the cassette): cassette lifts out, turns over, drops back in showing the other side. The playhead position carries over (as today); if it was playing, it keeps playing on the other side after the flip.
- Mechanical keys: Play, Pause, Stop (back to 0:00), Eject/Flip. Keys press down and latch (Play stays down while playing). Real `<button>`s, `aria-pressed` on Play.
- Analog VU meter needles (SVG/CSS) driven by a Web Audio `AnalyserNode` on the active clip; needle eases, rests at zero when stopped. Replaces nothing in the oscilloscope (`now-playing.js` stays).
- Seek: a counter plus a scrubber (`role="slider"`/range, keyboard + drag), tape pack follows.
- Clips still load whole into blob URLs near the viewport (seeking without Range support), unchanged logic from `ab-compare.js`.
- Side labels and J-card notes keep `data-edit-key` text so Admin Edit mode works; side names feed the deck display. `data-media-clip="work.ab.memo|master"` stays so Admin media can replace either clip.
- Spec table (Mic / Room / Takes / Mix) is kept, restyled as a printed J-card under the deck; the active side's column is highlighted.

## Style
Matte, no gloss or gradient keys (ADR 0001). Tape window and reels are CSS/SVG; textures from `textures.css` (paper for the cassette label). Etched lines per the existing rule. Palette tokens only, light + dark.

## Accessibility and fallbacks
- `prefers-reduced-motion`: no flip animation or reel spin; state still changes instantly; meters step instead of ease.
- Forced colors / increased contrast: plain borders, labels visible.
- Web Audio blocked or failing: meters rest at zero; playback unaffected.
- Mobile (<=640px): deck scales fluidly, keys 44px tap targets.

## Out of scope
More song pairs, intermediate mix stages, waveform drawing, new audio files.

## Done when
- `npm run check` and `node tests/contrast-check.mjs` pass; `tests/ab-check.mjs` is rewritten for the cassette (flip keeps playhead, play/pause/stop, seek, keyboard, Admin keys still present); `tests/admin-check.mjs` still passes.
- Checked in a real browser at phone, tablet and desktop widths, light + dark, with zero console errors and no horizontal overflow.
- Notes updated (PROJECT_NOTES, ADR if the flip model is worth recording).

## Slices (for to-tickets once approved)
1. Cassette + deck markup/CSS, static, both sides, J-card table.
2. Keys + transport + flip behaviour in a new `ab-compare.js`, with test.
3. Reels, tape-pack progress, flip animation, reduced motion.
4. VU meters (Web Audio) + fallbacks.
5. Mobile/theme/contrast pass and notes.
