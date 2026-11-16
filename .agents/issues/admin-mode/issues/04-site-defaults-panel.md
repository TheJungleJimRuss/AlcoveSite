# 04: Site Defaults panel

**What to build:** In Admin mode an editor picks Site Defaults (palette, font, Surface, Tape, Cards, Gradient, Texture) in a panel with live preview, reusing the toolbar's option definitions, and they save with the text through the same Save.

**Blocked by:** 03: Save to the Content branch

**Status:** done

- [ ] Panel lists every existing toolbar option with current default selected; no duplicated option definitions
- [ ] Live preview as choices change; Revert to saved
- [ ] Saved defaults appear for visitors after load (via the content file)
- [ ] Works at phone width
- [ ] admin-check extended; `node tests/contrast-check.mjs` passes
