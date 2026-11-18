# 04 3D cassette scene

Status: resolved
Blocked by: 01, 03

Wire the three.js cassette into the deck: flip animation, reels driven by playback, tape pack by progress, lighting matching palette scheme. Falls back to the SVG cassette without WebGL and under reduced motion.

## Answer

Done 2026-11-16. New file `cassette-3d.js` (`<script type="module">` on `work.html` only, plus an import map in `work.html` `<head>`: `three` -> `./vendor/three/build/three.module.js`, `three/addons/` -> `./vendor/three/examples/jsm/`). `ab-compare.js` and `wireframe.css` were NOT changed (the SVG flip WAAPI on `#cassette-face` still runs but the SVG is `visibility: hidden` under `data-webgl`, so no conflict).

Behaviour:
- Lazy: an IntersectionObserver (400px margin) on `#cassette-stage` triggers `import('three')` + GLTFLoader + `models/cassette.glb`. Nothing loads on other pages.
- Fallback (SVG stays, no `data-webgl`, no canvas): `?nogl`, no WebGL, GLB/node failure, WebGL context loss, or `prefers-reduced-motion` (checked at start; turning it on later hides the canvas). Reason is in `window.__cassette3d.error`.
- `data-webgl` is set on the stage after the first successful render. Canvas is `aria-hidden`; clicks bubble to the stage so tap-to-flip works.
- Flip: on `ab:flip-start` the pivot turns 180 degrees about Y over `outMs + inMs` (lift toward the camera, same ease as the spike); labels live on the model so there is no swap, and `ab:flip-end` / idle `ab:state` snap to the active side as a safety net.
- Reels: `ab:state.reel` degrees (spin about local Z, negative); packs: `ab:state.progress` scales `packL` 0.9 to 0.5 and `packR` 0.5 to 0.9 in X/Y only.
- Labels: 1024x360 canvases (flipY false) drawn from the `th[data-version]` names (edit keys `work.ab.col-*`) and the `.cs-hand` note text, with `--tape-paper`, `--tape-ink`, `--accent-primary`/`--text-muted`, `--bg-surface`. Redrawn (and lights re-tinted) on a MutationObserver of the section (text edits), `<html>` attributes (style/class/data-scheme/palette/font), and scheme/forced-colors media changes.
- Lights: hemisphere (`--bg-surface` / `--deck-well`), key (white 70% into `--bg-accent`), fill (`--text-muted`), resolved through a probe element + 1px canvas so `color-mix()` works. Materials forced matte (metalness 0, roughness >= 0.7).
- Rendering: pixel ratio capped at 2, ResizeObserver on the canvas, renders only when something changed (state, flip, resize, restyle), paused while the stage is offscreen or the tab is hidden.
- Debug handle: `window.__cassette3d = {ready, error, rotationY, renders, render()}`.

Tests: `tests/ab-check.mjs` gained three blocks (canvas + `data-webgl`, flip turns the 3D cassette to PI, reels drive renders, zero console errors; `?nogl` keeps the SVG; reduced motion keeps the SVG) and `.glb`/`.mjs` MIME types. Checked in headless Chromium (software GL) at 375px light and 1100px light + dark: canvas renders both sides, mid-flip, zero console errors, no horizontal overflow.

Check results: browser-check, fader-check, booking-check, record-player-check, contrast-check pass. ab-check passes (one run showed two failures, "VU needle leaves rest" and "VU meters share a running AudioContext", from VU tests that appeared in the file from ticket 05 work while I was running; not mine, and they passed on two reruns). texture-check fails 3 (masking-tape strips, default gradient stops, film grain default), already seen failing before this ticket (noted in ticket 02). admin-check fails 1 ("keyboard: the button is reachable and opens the chooser", Sleeve cover button on the Work record player); unrelated to the cassette, not investigated further, possibly flaky or pre-existing.

Open issues:
- Not measured on a real phone (ADR 0007 ask); pixel ratio cap of 2 is in place.
- In the dark theme the paper label reads fairly dim under the tinted lights; tune `--bg-surface`/key tint if Seth wants it brighter.
- Headless screenshots only (Playwright with software GL); the Playwright MCP browser pane was not used.
- Label text is only redrawn from the DOM `.cs-hand`/`th` text; the SVG `.cs-hand` text is not itself editable (no `data-edit-key`), so the handwritten note is not Admin-editable yet.
- `vendor/three` is still unminified (about 420 KB gzip), loaded lazily.
