# 01 Approach spike: Blender GLB in three.js

Status: resolved
Blocked by: none

Model a cassette (two-sided label, two reels, tape window) in Blender (skill `blender-asset-pipeline`), export GLB, load it with three.js via import map (no build step; vendor the module under `vendor/`). Prove: renders on Work page, flip rotation, reel spin, tape-pack scale. Record result and the three.js dependency in a new ADR. Done when it runs at 60fps on a phone-class device or the ADR says to fall back to Blender stills + CSS.

## Answer

Status: resolved (2026-11-16). Hybrid approach confirmed.

- Model: `models/cassette.glb`, 72 KB, ~2,000 triangles, no textures embedded. Source `assets-src/cassette/build_cassette.py` + `cassette.blend` (Blender 5.2, headless; the Blender MCP was not connected, so the script was run from the command line).
- three.js 0.187.0 vendored in `vendor/three/` (see its README.txt), import map, no build. About 2.1 MB raw, ~420 KB gzip; load it lazily on Work only.
- Spike page `.agents/issues/cassette-ab/spike/index.html` (served at `/.agents/issues/cassette-ab/spike/index.html`): flip, reel spin, pack scale, palette-tinted light, canvas label textures, `?nogl` fallback state. Zero console errors, no overflow at 375 px, 60 fps in the desktop pane. Not measured on a real phone (ticket 03 should).
- Node names: `cassette` (root), `shell`, `sideA` (front label plane, faces +Z), `sideB` (back label plane, faces -Z), `reelL`, `reelR` (origin on hub centre, spin about local Z), `reelCoreL`, `reelCoreR` (children of the reels), `packL`, `packR` (origin on hub centre, scale local X/Y only; scale 0.5 = empty, 0.9 = full), `trim_f`, `trim_b`, `screw_f*`, `screw_b*`.
- Label planes are 8.4 x 2.95 units with UV 0..1 and V down the image (use `texture.flipY = false`), mirrored on side B so text reads correctly. Draw a 1024 x 360 canvas.
- Units are cm: cassette is 10.04 wide x 6.38 high x 1.2 deep, centred on the origin, front facing +Z. Camera: FOV 28, distance about 32 fits the width with a small margin.
- Fallback: SVG cassette when WebGL is missing, the GLB fails, or reduced motion is set. ADR `docs/adr/0007-cassette-3d.md`.
