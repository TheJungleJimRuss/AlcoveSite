# 03: Paper, tape/label and print-wear layers

**What to build:** Per-component texture layers: paper fiber on `.section-block` panels, cards and polaroid frames; tape stock on the polaroid tape `::before`; label stock on label-maker captions; a print-wear mask on h1/h2 display headings, label captions and tape. Body text, inputs and buttons stay clean.

**Blocked by:** 01, 02

**Status:** done

- [ ] Texture layers sit under content (never over text), use the 02 tokens and scale with `--tex-strength`
- [ ] Light and dark schemes both look intentional (matte stock, not dirt)
- [ ] `node tests/contrast-check.mjs` passes with Quiet and Bold
