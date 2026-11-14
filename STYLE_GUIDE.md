# Alcove Recording — Design System & Style Guide

A comprehensive guide to visual styling, design tokens, UI components, responsive layout rules, and editorial conventions for the Alcove Recording website. Reference this document whenever building new pages, sections, or interactive elements to ensure visual coherence, accessibility, and fidelity to the studio brand.

---

## 1. Brand Identity & Design Principles

Alcove Recording is an independent music production studio founded by music producer Seth Miller.

### Target Audience
- High school and teen musicians, young alternative/indie bands, bedroom songwriters, vocalists, and first-time recording artists who have never set foot in a professional studio.

### Core Experience Goals
1. **Unintimidating & Welcoming**: Strip away gear elitism and technical gatekeeping. The site should feel as friendly and inviting as sitting down on a couch in the live room.
2. **Focus on the Creative Process**: Celebrate the progression from rough bedroom phone memo to polished streaming release.
3. **Warm, Analog & Cozy Aesthetic**: Evoke natural studio light, acoustic wood baffles, warm vacuum tubes, and tactile console controls.
4. **Analog Studio Tactility**: Stylized recording gear (faders, knobs, buttons, VU meters, tape) mixed equally with printed ephemera (labels, stickers, polaroids), built only from CSS and SVG. Keep generous whitespace and a legible layout so young artists stay calm and curious. See `docs/adr/0001-analog-studio-style.md`.
5. **Transparent & Frictionless**: Clear next steps, demystified recording workflows, and low-pressure contact points.

### The Analog Studio Philosophy
- **Breathing Room**: Ample vertical rhythm (`margin-bottom: 3.5rem`) and fluid padding remain; tactile surfaces sit on open layouts, not crowded ones.
- **Gear Treatment**: Audio player, buttons, navigation (including the mobile tab bar), booking pre-filter questions and photo captions look like hardware: soft gradients, bevels, highlights, pressed states. Hairlines are used only where they help.
- **Fill Panels Welcome**: Saturated accent panels from Seth's palettes, colored fader caps and knobs; no page-wide film grain (removed 2026-11-12). Text must stay AA on every surface.
- **Soft Shadows and Depth**: Raised and inset shadows signal what can be pressed. Filters and tabs may use chunky toggle or button shapes; steps keep mono numerals `01`-`03`. Small CC0 scanned texture tiles are allowed (ADR 0003): at most 150 KB in total, licenses recorded in `images/textures/LICENSES.md`, all wired up in `textures.css`, scaled by `--tex-strength`, and switched off under reduced transparency, increased contrast and forced colors. No other raster texture files.

### Textures
Tactile textures live only in `textures.css` (spec `.agents/issues/tactile-textures/spec.md`, ADR 0003). They are decorative CSS layers, never `<img>`, and never sit over body text. Every texture is painted in the active palette's own colours (via `color-mix` of `--text-main`, `--accent-*`, `--tint-*`), so it recolours with all four palettes and stays matte.

Paper and tape are real scans kept as grayscale photos (`paper.webp`, `tape.webp`): the layer's `background-color` is a palette colour and the scan is multiplied onto it with `background-blend-mode: multiply` inside that one element, so the hue follows the palette. The other tiles in `images/textures/` are alpha-only WebP (white RGB, alpha = intensity): a pseudo-element with `background-color: <palette mix>` and ONE `mask-image` tile (plus `-webkit-mask-image`). Never use `mask-composite`, `mask-mode`, multi-layer masks or `mix-blend-mode`: engines disagree (headless Chromium 131 ignored the union and knocked out the ink).

| Token | Value / use |
|---|---|
| `--tex-strength` | Scales every layer: `0` Off, `1` Quiet (default), `1.6` Bold. Set by `html[data-texture]` and the toolbar's Off/Quiet/Bold control (`?texture=`). Off removes the layers. |
| `--tex-*-base` | Base opacity per layer (tape, label, wear); layer opacity = base x strength. |
| `--tex-fiber-color`, `--tex-polaroid-fiber`, `--tex-label-color` | Palette tints: deeper tints on light palettes, lighter on dark (`html[data-scheme="dark"]`). Grain uses `--text-main`. |
| `--tex-under` | The surface colour under type (`--bg-page`). |
| `--tex-paper-img`, `--tex-tape-img` | The scanned photos (multiplied onto a palette colour). |
| `--tex-wear-img`, `--tex-metal-img`, `--tex-film-img` | The alpha tiles. |

Layers: tape (polaroid `::before`: a scanned strip of Tape005 masking tape multiplied onto the palette's tan tape colour and masked by its own outline; masking is the only tape, there is no tape option in the toolbar; three different strips (`tape.webp`, `tape-2.webp`, `tape-3.webp`, all without a wrinkle or scratch) rotate across cards, and strips also differ in angle, flip, length, sideways shift and shade, all keyed on the card's `:nth-child()` position; a flat strip at Off), page surface (brushed metal, the only surface: `body::before` is a sheet of `metal.webp` streaks behind all content, absolute over the whole body so it scrolls with the page, and `body::after` is a fixed steel wash with diagonal sheen bands; toolbar "Surface" / `?surface=` picks `metal` (default) or `metal-subtle`, the same layers at 0.45 strength; there is no page paper), paper things (polaroid frames and Card Stock: the scanned white Paper001 sheet multiplied onto the frame or card colour, strength `--tex-paper-base` on Card Stock and the lower `--tex-polaroid-base` on polaroid frames, which read as smoother coated photo paper), cards (always card stock, no option: off-white card sheet with the scanned paper, 3px corners and a layered soft shadow), hero logo edge (`h1.studio-wordmark` filter `#logo-edge-grain`: a subtle grainy blur, 1.2px blur dithered by fine noise so the outline breaks into grain; the SVG filter is inline in `index.html`). Print wear is an OVERLAY, not a mask: `h1::after` and `h2::after` are painted in the surface colour under the type (`--tex-under`) and cut by the wear tile; the hero wordmark gets none. Body text, form fields and buttons stay clean.

Textures are off under `prefers-reduced-transparency: reduce`, `prefers-contrast: more` and `forced-colors: active`. `tests/texture-check.mjs` guards the budget (150 KB), alpha tiles, licenses, no `mask-composite`, the hero at `?texture=off` and these switches.

---|---|
| `--tex-strength` | Scales every layer: `0` Off, `1` Quiet (default), `1.6` Bold. Set by `html[data-texture]` and the toolbar's Off/Quiet/Bold control (`?texture=`). |
| `--tex-blend` | `multiply` on light palettes, `screen` on dark ones. |
| `--tex-tape` | Tape stock: polaroid tape. |
| `--tex-label` | Label stock: label-maker captions. |
| `--tex-wear` | Print wear mask: h1/h2, captions, tape. Body text, form fields and buttons stay clean. |

Each image token lists the scanned WebP first and an SVG-noise data URI as fallback. Textures are off under `prefers-reduced-transparency: reduce`, `prefers-contrast: more` and `forced-colors: active`. `tests/texture-check.mjs` guards the budget, licenses and these switches.

---

## 2. Design Tokens & CSS Custom Properties

All colors, typography, and core visual properties are managed via CSS custom properties on `:root` in [`wireframe.css`](file:///Users/alex/Downloads/AlcoveSite/wireframe.css).

### 2.1 Color Palettes

#### Palettes: Seth's Picks (Light + Dark)
Only these four themes ship in the Theme Dock. Colors were sampled from the swatches Seth supplied; page/surface tints and dark backgrounds are derived. The default is **Olive & Orange (Light)**.

```css
:root {
  --bg-page: #FBF3E2;        /* Light tint of the yellow */
  --bg-surface: #FFFBF2;
  --bg-accent: #F6E3BC;
  --border-color: #E8CE98;
  --border-focus: #F58448;   /* Orange focus ring */
  --text-main: #3B1A0F;
  --text-muted: #575021;     /* Olive */
  --accent-primary: #762E1A; /* Deep brick red */
  --color-error: #d93025;    /* Form error red */
  --color-valid: #188038;    /* Form success green */
}
```

| Theme | Page | Surface | Text | Accent | Focus |
|---|---|---|---|---|---|
| Olive & Orange (Light) | `#FBF3E2` | `#FFFBF2` | `#3B1A0F` | `#762E1A` | `#F58448` |
| Olive & Orange (Dark) | `#1F1A0C` | `#292212` | `#FBF0D8` | `#F58448` | `#EDC070` |
| Sage & Coral (Light) | `#FFF5E0` | `#FFFBF3` | `#472D2E` | `#723D45` | `#E16C5B` |
| Sage & Coral (Dark) | `#2A1B1D` | `#352326` | `#FEEFD0` | `#E16C5B` | `#FEE0A6` |

Each theme also defines `--accent-secondary`, `--accent-tertiary`, `--tint-1`, `--tint-2` so all five swatch colors appear on the site: a five-color stripe under the header and above the footer, cycling card/section top borders, gradient wordmark, colored numerals, soft washes. Text-safe colors (primary, tertiary) carry text; secondary and tints carry borders and washes.

Accent is used as text/border color only (never a fill behind white text), so bright accents work on dark themes.

### 2.2 Color Usage Rules
- **High Contrast Main Text**: Use `var(--text-main)` for all headings, labels, button text, and primary content (always maintains WCAG AA / AAA contrast).
- **Secondary / Supporting Text**: Use `var(--text-muted)` for intro paragraphs, hints, audio timestamps, and step descriptions.
- **Card Backgrounds**: Alternate between `var(--bg-surface)` for floating elevation cards and `var(--bg-page)` for nested cards inside section blocks.
- **Borders & Dividers**: Always use `var(--border-color)` (1px solid for cards/sections, 1px dashed for media placeholders or dividers).

---

## 3. Typography Scale & Hierarchy

All fonts are imported from Google Fonts in [`wireframe.css`](file:///Users/alex/Downloads/AlcoveSite/wireframe.css).

### Font Stacks
```css
:root {
  /* Headings: Clean, modern, warm geometric grotesk */
  --font-heading: "Fraunces", Georgia, serif;

  /* Body text: High-legibility humanist sans-serif */
  --font-sans: "Fraunces", Georgia, serif;

  /* Technical / Audio Specs: Monospace for timecodes, gear specs, badges, and labels */
  --font-mono: "Fraunces", Georgia, serif;
}
```

### Typographic Scale
Use fluid `clamp()` values to ensure titles scale naturally between mobile and wide screens without breakpoint jumps:

| Element | CSS Selector / Class | Fluid Size Rule | Weight | Letter Spacing | Line Height |
|---|---|---|---|---|---|
| **Studio Wordmark** | `.studio-wordmark` | `clamp(3.75rem, 11vw, 7.5rem)` | 800 | `-0.035em` | `1.0` |
| **Page / Hero H1** | `h1` | `clamp(1.85rem, 4vw, 2.5rem)` | 800 | `-0.02em` | `1.25` |
| **Section H2** | `h2` | `clamp(1.35rem, 2.8vw, 1.75rem)` | 700 | `-0.01em` | `1.25` |
| **Card / Feature H3**| `h3` | `clamp(1.05rem, 2vw, 1.2rem)` | 600 | `0` | `1.3` |
| **Sub-item H4** | `h4` | `0.95rem` | 600 | `0` | `1.3` |
| **Lead / Intro Text** | `.page-intro`, `.hero-wordmark-subline` | `clamp(1.05rem, 2.2vw, 1.35rem)` | 400 | `0` | `1.55` |
| **Body Paragraph** | `p` | `1rem` | 400 | `0` | `1.6` |
| **Mono / Badges / Meta**| `.track-meta`, `.step-badge` | `0.8rem` – `0.85rem` | 600 / 700 | `0.02em` | `1.4` |

---

## 4. Spacing, Grid & Layout Rules

### 4.1 Page Container
All subpage content and body sections use `.container`:
```css
.container {
  width: min(1080px, 100% - 2rem);
  margin-inline: auto;
  padding-block: 2.5rem;
}
```
*Note: For the Home Page hero, `.container:has(.hero-wordmark-viewport)` resets `padding-block-start: 0` to preserve full 100dvh framing.*

### 4.2 Standard Section Blocks
Wrap distinct thematic sections inside `.section-block`:
```html
<section class="section-block">
  <h2>Section Title</h2>
  <p class="placeholder-text">[Brief section introduction or overview copy...]</p>
  <!-- Content Grid / Cards -->
</section>
```
Styling: unboxed. No border, background, padding, radius or texture; sections are separated by space only (`margin-bottom: clamp(3rem, 7vw, 5rem)`).

### 4.3 Subpage Header (`.page-header`)
Subpages (`work.html`, `about.html`, `contact.html`) use an open, uncluttered header at the top of the container:
```html
<header class="page-header">
  <h1>Page Title</h1>
  <p class="page-intro">[Engaging, warm summary explaining what this page offers...]</p>
</header>
```

### 4.4 Grid Variations

#### Standard Multi-Card Grid (`.grid-cards`)
Auto-wrapping responsive cards:
```html
<div class="grid-cards">
  <div class="card">
    <h3>Card Title</h3>
    <p class="placeholder-text">[Description...]</p>
  </div>
  <!-- Additional cards -->
</div>
```
- CSS: `display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem;`

#### Studio Showcase Split (`.grid-showcase`)
Featured 1.2fr gear/story slot paired with stacked side cards (used on Home):
```html
<div class="grid-showcase">
  <div class="card card-featured">...</div>
  <div class="showcase-side-cards">
    <div class="card">...</div>
    <div class="card">...</div>
  </div>
</div>
```
- Stacks vertically to `1fr` on screens `<= 768px`.

#### 3-Step Journey / Roadmap (`.roadmap-steps`)
Numbered circular badge steps:
```html
<div class="roadmap-steps">
  <div class="roadmap-step">
    <div class="step-badge">1</div>
    <h3>Step Title</h3>
    <p class="placeholder-text">[Step explanation...]</p>
  </div>
</div>
```

#### Creative Evolution / Before & After (`.comparison-container`)
Two comparative cards joined by an evolution arrow:
```html
<div class="comparison-container">
  <div class="card">
    <div class="media-box ratio-16-9">[Audio / Before Memo]</div>
    <h3>The Voice Memo</h3>
  </div>
  <div class="comparison-arrow">→</div>
  <div class="card">
    <div class="media-box ratio-16-9">[Master / Finished Release]</div>
    <h3>The Studio Master</h3>
  </div>
</div>
```
- Arrow rotates 90° (`↓`) on mobile screens `<= 768px`.

---

## 5. UI Components & Patterns

### 5.1 Navigation

#### Global Sticky Header (`.site-header`)
- Sticks to top of screen on subpages: `z-index: 100`, `background-color: var(--bg-surface)`.
- Left-aligned studio wordmark / logo (`.logo-placeholder`).
- Right-aligned navigation links (`.nav-links`).
- Active link marked with `class="active"` and `aria-current="page"`.
- Underline style: `border-bottom: 2px solid transparent` with pre-allocated border to prevent hover layout shift.

#### Home Page Smart Scroll Header (`.site-header--smart`)
- Hidden above the fold (`transform: translateY(-100%)`).
- Transitions smoothly into view (`.site-header--visible`) when the user scrolls down into content.
- Instantly revealed if focused via keyboard (`:focus-within`).

#### Home Hero Centered Nav (`.hero-nav`)
- Located directly below the subheader in the 100dvh hero viewport.
- Unadorned, clean text links without button frames.
- Equal visual weight on initial load (no default active line).

### 5.2 Buttons & Action Links

#### Primary CTA Button (`.btn-primary`)
Used for high-priority actions ("Send Inquiry", "Book a Session"):
```html
<a href="contact.html" class="btn-placeholder btn-primary">Book a Session</a>
```
- Dark filled background (`var(--text-main)`) with crisp light text (`var(--bg-surface)`).

#### Secondary / Outline Button (`.btn-placeholder`)
Used for secondary actions, audio previews, or filters:
```html
<button type="button" class="btn-placeholder">Listen to Preview</button>
```
- Subtle accent background (`var(--bg-accent)`) with 2px accent border (`var(--border-focus)`).

#### Compact Button (`.btn-sm`)
Used inside tight card rows, table rows, or scrubbers:
- `padding: 0.4rem 0.85rem; font-size: 0.8rem;`

### 5.3 Filter Tabs (`.filter-pill`, `.filter-btn`)
Clean typographic text tabs for switching between a few views or filters (the Work page no longer has a filter bar; songs are a plain list):
```html
<div class="filter-bar" role="toolbar" aria-label="Filters">
  <button type="button" class="filter-pill active" aria-pressed="true">Option A</button>
  <button type="button" class="filter-pill" aria-pressed="false">Option B</button>
  <button type="button" class="filter-pill" aria-pressed="false">Option C</button>
</div>
```
- Superseded by the analog studio style: tactile toggle or button shapes (see ADR 0001); the flat text-tab rules below describe the pre-reskin baseline.
- Active state indicates selection cleanly via bottom border (`border-bottom-color: var(--border-focus)`).
- Monospace typography (`font-family: var(--font-mono); font-size: 0.85rem`).
- Smooth hover and active color transitions with zero pill background.

### 5.4 Audio Player & Scrubber (`.audio-widget`)
```html
<div class="audio-widget">
  <div class="track-row">
    <div class="track-info">
      <strong>[Track Title]</strong>
      <span class="track-meta">
        <span class="track-duration">2:45</span>
      </span>
    </div>
    <button type="button" class="btn-placeholder btn-sm" aria-label="Play track">▶ Play</button>
  </div>
  <div class="player-scrubber-wireframe" role="region" aria-label="Audio timeline">
    <span class="player-timestamp">0:42</span>
    <div class="scrubber-track">
      <div class="scrubber-progress" style="width: 35%;"></div>
    </div>
    <span class="player-timestamp">2:45</span>
  </div>
</div>
```

### 5.5 Native Semantic FAQ Accordions (`.faq-accordion-group`)
Accessible, zero-JS expanding question cards:
```html
<div class="faq-accordion-group">
  <details class="faq-item">
    <summary class="faq-summary">Do I need to be a professional musician?</summary>
    <div class="faq-content">
      <p class="placeholder-text">[Reassuring answer welcoming beginners and bedroom songwriters...]</p>
    </div>
  </details>
</div>
```
- Uses native `<details>` and `<summary>`.
- `::after` pseudo-element provides smooth `+` and `−` state indicator.
- Automatically handles keyboard navigation (`Enter` / `Space` to toggle).

### 5.6 Form Controls & Validation
Modern, accessible input architecture:
```html
<div class="field-group">
  <label for="artist-name">Your Name or Band Name <span aria-hidden="true">*</span></label>
  <span class="hint" id="name-hint">What should Seth call you?</span>
  <input type="text" id="artist-name" name="name" required aria-describedby="name-hint">
  <span class="error-msg" role="alert">Please enter your name or band name.</span>
</div>
```
Validation rules:
- Uses `:user-invalid` so inputs do not show harsh red errors while the user is actively typing.
- Soft red background (`#fff5f5`) and border when invalid after losing focus.
- Validated inputs receive subtle green border (`--color-valid`).
- Outlines always maintain 2px solid `var(--border-focus)` on `:focus-visible`.

### 5.7 Audio / File Upload Dropzone (`.upload-dropzone-wireframe`)
Encouraging bedroom artists to drop rough audio phone memos:
```html
<div class="upload-dropzone-wireframe" tabindex="0" role="button">
  <span class="upload-icon" aria-hidden="true">🎙</span>
  <div class="upload-label">Drop a Voice Memo or Rough Demo Here</div>
  <span class="upload-note">or <span class="upload-browse">browse audio files</span> (.mp3, .m4a, .wav)</span>
</div>
```

### 5.8 Home Hero Photo (`.hero-media`)
- One still studio photo (`images/studio-live-room.jpg`) fills the 100dvh Home hero behind the wordmark, subline and hero nav.
- Parallax: the photo drifts down 40% of its height while the hero scrolls away (CSS `animation-timeline: scroll(root)`, small JS fallback in `index.html`); still under `prefers-reduced-motion`.
- A palette-tinted scrim (`.hero-media::after`, `--bg-page` at 74% plus a fade to `--bg-page` at the bottom) keeps the type readable in every palette and blends into the next section.

---

## 6. Motion & View Transitions

### Native Cross-Document View Transitions
Configured in [`wireframe.css`](file:///Users/alex/Downloads/AlcoveSite/wireframe.css):
```css
@view-transition {
  navigation: auto;
}

::view-transition-old(root) {
  animation: 0.3s cubic-bezier(0.2, 0, 0, 1) both page-slide-out;
}

::view-transition-new(root) {
  animation: 0.35s cubic-bezier(0.2, 0, 0, 1) both page-slide-in;
}

/* Persistent Header and Footer morphing */
.site-header { view-transition-name: main-header; }
.site-footer { view-transition-name: main-footer; }
```

### Reduced Motion Accessibility (Mandatory)
Every animation and transition MUST respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  @view-transition { navigation: none; }
  .hero-media { transform: none !important; }
  .site-header--smart { transition: none !important; }
}
```

---

## 7. Responsive Breakpoint Rules

| Breakpoint | Target Devices | Key Adaptations |
|---|---|---|
| **> 1080px** | Desktop / Large Laptops | Fixed 1080px max-width container, full multi-column grids. |
| **769px – 1079px** | Small Laptops / Tablets | Fluid container (`100% - 2rem`), `.grid-cards` auto-wraps cleanly. |
| **541px – 768px** | Small Tablets / Large Phones | `.grid-showcase` collapses to 1 column; `.comparison-container` stacks with vertical arrow (`↓`). |
| **<= 540px** | Mobile Phones | Header wraps neatly; nav link padding reduces to `0.25rem 0.45rem`; feature items stack vertically. |

---

## 8. Copywriting & Placeholder Standards

To keep client feedback sessions focused on UX, information architecture, and layout:

1. **Standard UI Navigation & Actions**: Always use clean, real, concise words:
   - Navigation: `Home`, `Work`, `About`, `Contact`
   - Actions: `Book a Session`, `Send Inquiry`, `Play`, `Filter`, `Browse files`
   - Form Labels: `Your Name`, `Email Address`, `Project Type`, `Target Date`
2. **Editorial, Marketing & Narrative Copy**: Keep as clean, structured bracketed placeholders (`[ ... ]`):
   - Hero subline: `[An unintimidating recording space for high school musicians and bedroom songwriters...]`
   - Bio copy: `[Seth Miller's background in production, mentorship approach, and favorite genres...]`
   - FAQ answers: `[Reassuring guidance explaining equipment provided, preparation tips, and rates...]`
   - *Rule*: Never add conversational author notes like `- To be written by Seth` to placeholder tokens.
3. **Tone of Voice**:
   - Encouraging, mentor-like, transparent, and humble.
   - Demystify recording terms (explain "tracking", "stems", "mixing", and "mastering" in plain English).
   - Zero pressure: prioritize creative experimentation over perfection.

---

## 9. Checklist for Adding New Pages or Sections

When adding a new page or new section to an existing page, verify:
- [ ] Uses valid semantic HTML5 (`<main>`, `<section class="section-block">`, `<header class="page-header">`, `<article class="card">`).
- [ ] Enclosed in `.container` with fluid max-width.
- [ ] Styled strictly via `var(--...)` design tokens rather than hardcoded hex colors.
- [ ] Uses fluid typographic hierarchy (`h1` through `h4`) with standard margin rhythms.
- [ ] Navigation header links include active state (`class="active"` and `aria-current="page"`).
- [ ] Interactive elements include `:hover`, `:focus-visible`, and `aria-*` attributes.
- [ ] Tested at mobile (`375px`), tablet (`768px`), and desktop (`1200px`) screen widths.
- [ ] Respects reduced motion preferences.
- [ ] Follows the analog studio style: gear treatment on controls, textures (`textures.css`, Off/Quiet/Bold control) and palette tokens, AA contrast, reduced-motion and reduced-transparency respected; generous spacing preserved.
- [ ] Narrative copy uses clean `[ ... ]` placeholders until approved by Seth Miller.

## Analog Studio keys (matte, no gloss)
Buttons, nav links and the phone tab bar are matte keys: flat theme fill, 1px edge, solid 3px bottom edge (`box-shadow: 0 3px 0`), pressed state drops 3px and loses the edge. No gradients, inset highlights or soft drop shadows ("glossy keys" are rejected).

## Analog Studio components (current)
- **Nav switch:** header nav (desktop) and phone tab bar are a recessed track with a flat sliding thumb (`nav-switch.js`); hero nav keeps matte keys.
- **Hover:** faint fill only. No colored borders, underlines, lift or scale.
- **Player:** dark display strip with a 'Now playing' label, matte transport keys. No per-player meters: one live waveform appears in the middle of the site header while any audio plays (`now-playing.js`; still shape under reduced motion).
- **A/B compare (Work):** tape-deck slide switch (recessed slot, ridged cap, MEMO / MASTER printed underneath with indicator lights); sliding keeps the playhead (`ab-compare.js`).
- **Photos:** taped polaroid frames with slight tilt; placeholder slots use a dashed accent border and a label-maker note.
- **Home hero:** one still studio photo with slow parallax under a palette scrim.
- **Fader:** thin matte scroll fader on the right edge (`fader.js`).
