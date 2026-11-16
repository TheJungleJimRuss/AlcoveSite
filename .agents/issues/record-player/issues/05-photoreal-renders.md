# 05: Photoreal record player

**What to build:** Replace the CSS/SVG drawing of the turntable, tonearm, vinyl, milk crate and sleeves with photoreal Blender renders (top-down, layered), animated by the existing record player code. See the spec's "Amendment 2026-11-13 (2): Photoreal look".

**Blocked by:** 04 (resolved). Needs Blender open with the MCP addon running.

**Status:** resolved

- [x] Blender scene with real materials (vinyl, rubber mat, aluminium platter, wood/metal plinth, chrome tonearm, plastic milk crate, printed card sleeves), CC0 sources recorded
- [x] Layered top-down exports at 1x/2x in `images/record-player/`, within the ~600 KB budget, lazy-loaded
- [x] Spin, arm swing/lift/seek, crate flip and disc travel all use the image layers and still line up (arm pivot, platter centre)
- [x] Centre labels, sleeve titles and edit keys stay live HTML
- [x] Looks real at 375, 768 and 1280 in light and dark palettes (screenshots reviewed)
- [x] `tests/record-player-check.mjs` passes; `npm run check` and `node tests/contrast-check.mjs` pass (apart from failures owned by other in-flight work, named in the report)
