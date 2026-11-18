# 09 - Keys on the player, model polish, better textures

Status: resolved

## Task
Remove the button row under the player; the keys on the player become the controls. Polish the model and textures.

## Answer
- `.deck-keys` is now an absolute overlay inside `.deck-top` (sibling of the stage, so a key click never bubbles into the stage's click-to-flip). The four real `<button id="ab-key-*">` stay (aria-label, `aria-pressed` on Play, Space/F shortcuts, focus ring) but are transparent and have no glyph SVGs. `cassette-3d.js` projects each 3D key's world position to screen on every render and sets `--kx/--ky`, so a click, tap or Enter lands on the key drawn in the model. Hit areas are at least 2.75rem. Raycasting was not needed: the overlay buttons are the hit targets and also give keyboard and screen-reader access.
- Hover or keyboard focus tints the key cap (per-key cloned material); pointerdown or Enter depresses it; Play stays latched down and the LED lights while playing.
- No WebGL, reduced motion, forced colours: the SVG keys get the same buttons over them, with `:has()` hover and pressed styling.
- Model (`build_player.py`): panel-line cuts, label-border plates, key wells, rubber feet, jacks, hinges, hub teeth, corner screws, LED. GLB is about 0.95 MB.
- Textures: 1024 brushed-aluminium colour, normal and ORM maps (multi-scale anisotropic streaks, fingerprint and dust roughness, fine scratches, edge wear baked into colour); 512 leather-pebble grain normal; 256 label paper fibre. All procedural (no third-party sources, see `LICENSES.md`). The shell's roughness and metalness now come from the ORM map; `cassette-3d.js` no longer forces them when a map is present.
- Tests: `tests/ab-check.mjs` covers the key row being gone, real mouse clicks at each key centre (play, pause, stop, flip), focus plus Enter, `aria-pressed`, focus ring, pointer cursor, projected position, and the same under `?nogl`.
