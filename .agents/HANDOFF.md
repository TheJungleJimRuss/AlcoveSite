# Handoff: cassette deck realism pass (2026-11-20)

## Goal
User wants the Work-page cassette deck (Blender image layers in `images/cassette/`) to look real, not like a flat 3D model: screws, base, buttons, then door and cassette. Follow-up requests, all mid-task:
- Lighting looked flat.
- Remove the playing-indicator light on the base.
- Door handle must not go over the buttons.
- Cassette image at rest and during the flip must match.

## Done (not yet verified in the browser)
- `assets-src/cassette-player/refine_deck.py` (new, re-runnable) patches `cassette-player.blend`:
  - Deck: countersunk domed Phillips screws, rolled base edge, satin dished keys with raised glyphs.
  - LED objects `led` and `led_ring` removed.
  - Door: satin frame, 4 corner screws, grip ribs, handle moved onto the frame's front edge (`latch.location.y = -DD + 0.05`), glass with a soft diagonal glare.
  - Cassette: Phillips screws in wells (4 per face), clear window pane with glare, light clear coat on `bone_plastic`.
  - Re-run only from the original blend (backup below), because earlier steps are not fully idempotent.
- `render_layers.py`:
  - World is now the studio HDRI (`assets-src/record-player/tex/pav_studio_03_2k.hdr`, strength 0.55, rotation 200). Lights are a low raking sun (5 degree angle) plus a dim fill and rim.
  - Flip render no longer softens the key light, so flip frames use the same lights as the resting shell.
  - `CLOSE="cx,cy,w,h,px,out.png"` renders a close-up of the deck. `CLOSE_SHOW=all` adds the cassette and door.
  - `layout.json` no longer has a `led` entry.
- Site: removed `<span class="cd-led">` from `work.html` and the `.cd-led` CSS from `wireframe.css`.
- Fixed a bug where the glass colour ramp's last stop was white, which turned the glass and window pane opaque.

## In flight
A full re-render was started in the background (task `blfjkegmq`): `render_layers.py`, then `ONLY=shellb`, then `ONLY=flip`, then `node scripts/make-door-sheet.mjs`, then `SHEET=flip node scripts/make-door-sheet.mjs`. Check that `images/cassette/*.webp` and `layout.json` have fresh timestamps and that `/tmp/r?.log` has no Traceback. If it died, re-run the same sequence.

## Still to do
1. Check flip frame 0 (`renders/flip_00.png`) against `renders/shell.png`, and the last flip frame against `renders/shell-b.png`. They should look the same (screws, window glare, colours); the previous check was done before the glass fix.
2. Check the page in the browser (`work.html`) at 375, 768 and 1200 wide: deck, door open and shut, flip, Side B. Confirm the HTML packs, reels and label still line up with the new shell. Run `node tests/ab-check.mjs` and `node tests/cassette-perf.mjs`. Serve with `scripts/dev-server.py` and cache-bust `wireframe.css`.
3. Check image sizes against `PROJECT_NOTES.md` (flip sheets were 160/466 KB; the new ones were about 143/450 KB).
4. Update `.agents/PROJECT_NOTES.md` (Status plus Cassette notes: no LED, refined deck, HDRI lighting, `refine_deck.py`), and add a dated entry to `NOTES_ARCHIVE.md`.
5. Tidy up: the HDRI is now used by the cassette render, so add it to `assets-src/cassette-player/LICENSES.md` (CC0, Poly Haven).

## Gotchas
- The project is not a git repo. Backups of the original blend, `render_layers.py` and `images/cassette` are in the session scratchpad: `/private/tmp/claude-503/-Users-alex--claude-spares-spare-H0ySmO/cc8538cf-bbd3-4a20-ab8a-8d50a7e7683f/scratchpad/backup/`.
- `rm` commands were blocked by the harness. Avoid them, and avoid `pkill` inside background commands, which makes the task report exit code 144.
- BSD `sed -i` needs `''`; use python for edits.
- The cassette's retro stripes and screws are children of the `cassette` object, so the shell and flip renders pick them up automatically.

## Suggested skills
`web-runtime-verification` (final browser check), `blender-asset-pipeline` (any further Blender changes), `diagnosing-bugs` if the flip and rest images still differ, `writing-for-agents` if editing the notes.
