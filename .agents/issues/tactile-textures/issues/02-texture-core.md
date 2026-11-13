# 02: textures.css core module, page grain, theming, a11y

**What to build:** A new `textures.css`, linked after `logo.css` on all four pages, owns every texture. The fixed page grain moves out of `wireframe.css` into it.

**Blocked by:** None (uses SVG data-URI fallbacks until 01 lands)

**Status:** done

Contract (other tickets rely on it):
- `<html data-texture="off|quiet|bold">`; a missing attribute means quiet. `--tex-strength`: 0 / 1 / 1.6.
- `<html data-scheme="dark">` → `--tex-blend: screen` (or soft-light) with inverted specks; otherwise `multiply`.
- Image tokens `--tex-paper`, `--tex-tape`, `--tex-label`, `--tex-film`, `--tex-wear`, each a layered `url(images/textures/x.webp), <svg data-uri fallback>`.
- Layer opacities are `calc(base * var(--tex-strength))`.

- [ ] `body::after` grain moves from wireframe.css to textures.css and uses `--tex-film`
- [ ] Off under `prefers-reduced-transparency: reduce`, `prefers-contrast: more` and `forced-colors: active`
- [ ] No inline styles, no animation, a single fixed layer only
- [ ] `npm run check` passes
