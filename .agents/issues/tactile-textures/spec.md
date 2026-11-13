Status: done (2026-11-12)

# Tactile Textures

## Problem Statement

The analog studio style (ADR 0001) has a single uniform SVG-noise grain at 9% over the whole page. Paper items (polaroids, tape, label-maker captions) and printed type look flat and digital, so the site doesn't yet feel like the tactile, printed-ephemera-plus-gear world Seth asked for.

## Solution

Layer **tactile textures** per component, at a noticeable but quiet strength. They come from small **CC0 scanned textures** (paper fiber, tape and label stock, film grain, print-wear masks), with procedural SVG noise as a fallback and fine accent. Textures adapt to light and dark palettes. The Theme Preview Toolbar gets a **Texture** control (Off / Quiet / Bold) so Seth can compare levels. This supersedes ADR 0001's "CSS and SVG only" rule; see ADR 0003.

## User Stories

1. As a visitor, I want section panels and cards to feel like paper stock, so that the site feels handmade and welcoming.
2. As a visitor, I want polaroids, tape strips and label captions to look like real paper, tape and embossed label tape.
3. As a visitor, I want headings and labels to show slight print wear, so that they feel printed rather than typed.
4. As a reader, I want body text to stay crisp and AA-contrast on every textured surface.
5. As a dark-theme visitor, I want textures to read as matte card stock (light specks), not dirt.
6. As a phone user, I want textures to load fast and not slow scrolling or the carousel.
7. As a visitor with `prefers-reduced-transparency` or `prefers-contrast: more`, I want textures off or minimal.
8. As Seth, I want to switch textures Off / Quiet / Bold in the preview toolbar and share the setting by URL.

## Implementation Decisions

- **Assets**: CC0 scans only (e.g. Poly Haven, ambientCG). Each candidate is shown to the user (file, source URL, license, size) and downloaded only after approval. Store originals out of the repo; ship processed tiles in `images/textures/` with `images/textures/LICENSES.md` (source, author, license, date).
- **Processing**: grayscale, seamless-tiled, 256–512px, WebP (AVIF where smaller). **Budget ≤150 KB total** for all shipped texture files. A script in `scripts/` builds the tiles reproducibly.
- **Module**: new `textures.css`, linked after `wireframe.css` on all four pages. Tokens on `:root`: `--tex-strength` (0 / 1 / 1.6 for Off / Quiet / Bold), `--tex-blend` (`multiply` light, `screen`/`soft-light` dark), per-texture URLs.
- **Layers**:
  - Page grain: replace today's `body::after` SVG with scanned film grain; keep SVG noise as the fallback `background-image` layer.
  - Paper fiber: `.section-block` panels, cards and polaroid frames, using a `::before` texture layer under the content (never over text).
  - Tape and label stock: polaroid tape `::before` and label-maker captions.
  - Print wear: `mask-image` speckle/edge mask on h1/h2 display headings, label captions and tape. Body text, form fields and buttons are untouched.
- **Theming**: the four palettes (`seth-*` and `seth-*-dark`) set `--tex-blend` and opacity; dark themes invert the texture via blend mode, not separate files.
- **Toolbar**: `theme-preview.js` adds a Texture select (Off / Quiet / Bold), sets `data-texture` on `<html>`, persisted in `localStorage` and the `?texture=` URL param, with Quiet as the default and included in the CSS export.
- **Accessibility**: `prefers-reduced-transparency: reduce` and `forced-colors: active` → off; `prefers-contrast: more` → off. Textures are decorative only (CSS backgrounds, no `<img>`).
- **Performance**: texture layers have no `position: fixed` repaints beyond the existing single page-grain layer, no animated textures, and no `will-change`. Non-hero textures load from CSS (no preload).

## Testing Decisions

- `npm run check` and `node tests/contrast-check.mjs` pass, and contrast is measured with Quiet and Bold textures on light and dark palettes.
- New `tests/texture-check.mjs`: texture files total ≤150 KB, every file has a `LICENSES.md` entry, `data-texture` toggles change the computed `--tex-strength`, and reduced-transparency disables layers.
- `web-runtime-verification` at phone, tablet and desktop in all four palettes × Off/Quiet/Bold; screenshots go in `.agents/issues/tactile-textures/screenshots/`.

## Out of Scope

- Material finishes on gear (fader, keys, nav switch, tape deck).
- Animated grain or flicker.
- Booking form styling (ticket 07 is still parked).

## Further Notes

Needs ADR 0003 accepted, and STYLE_GUIDE.md line 25 ("No photoreal textures or large raster texture files") rewritten to the new budget rule.
