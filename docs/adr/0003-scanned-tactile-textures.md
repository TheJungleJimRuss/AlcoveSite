# 0003: Allow small CC0 scanned textures

Status: accepted (2026-11-12)

ADR 0001 limited the analog studio style to CSS and SVG. Procedural noise can't convincingly render paper fiber, tape stock or print wear, and the site still feels flat.

**Decision:** allow small, grayscale, seamless CC0 scanned textures (≤150 KB total, WebP/AVIF), layered per component through `textures.css`, with procedural SVG noise kept as the fallback. Licenses are recorded in `images/textures/LICENSES.md`. Spec: `.agents/issues/tactile-textures/spec.md`.

**Consequences:** this supersedes the "CSS and SVG only" clause of ADR 0001 and the "no photoreal textures or large raster files" line in STYLE_GUIDE.md. A size-and-license test guards the budget. The guardrails from ADR 0001 (AA contrast, reduced-motion, reduced-transparency, no inline styles) still apply.

**Amendment (2026-11-12, user decision):** paper and tape looked generated as tinted grain, so they are now the scans themselves: grayscale photos multiplied onto a palette colour with `background-blend-mode` inside one element (page paper, card stock, polaroid tape; the tape's alpha is its torn outline). They keep the palette's hue, so they need not be seamless-alpha tiles. `mix-blend-mode`, `mask-composite` and multi-layer masks stay banned; print wear and metal stay alpha-only tiles.

**Amendment 2 (2026-11-12, user decision):** paper is no longer a page surface. The page is brushed metal (default and only surface, two strengths); the scanned paper (Paper001) is used only on paper things: polaroid frames and Card Stock.
