# 01: Source and process CC0 scans

**What to build:** Approved CC0 scans (paper fiber, tape, label stock, film grain, print-wear speckle) become grayscale seamless tiles in `images/textures/`, built by a reproducible script, with `images/textures/LICENSES.md`.

**Blocked by:** None (research). The download waits for the user's per-file approval.

**Status:** done

- [ ] Candidate list (source URL, author, license, original size) shown to the user and approved
- [ ] Originals kept outside the repo; `scripts/make-textures.mjs` (or a sips/cwebp shell script) builds the tiles
- [ ] Tiles: grayscale, seamless, 256-512px, WebP; total ≤150 KB
- [ ] File names: `paper.webp`, `tape.webp`, `label.webp`, `film-grain.webp`, `print-wear.webp`
- [ ] LICENSES.md has one entry per file
