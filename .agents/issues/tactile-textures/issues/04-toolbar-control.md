# 04: Theme Preview Toolbar texture control

**What to build:** A Texture group (Off / Quiet / Bold) in the toolbar that sets `data-texture` on `<html>`. It persists in `localStorage` (`alcove_theme_texture`) and the `?texture=` param, defaults to Quiet and is included in the CSS export. The toolbar also sets `data-scheme="dark|light"` on `<html>` from the active palette (`*-dark` = dark).

**Blocked by:** None (contract defined in 02)

**Status:** done

- [ ] Same button pattern and `aria-pressed` as the palette/font groups
- [ ] `data-scheme` is updated on every palette change and on load
- [ ] `npm run check` passes
