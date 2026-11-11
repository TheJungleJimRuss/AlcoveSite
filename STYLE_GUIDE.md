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
4. **Studio Minimalism & Visual Restraint**: Every element on the page must earn its place. Embrace generous whitespace, open layouts, and zero visual clutter. Avoid nested box fatigue, border overload, and decorative noise so young artists feel calm, focused, and unhurried.
5. **Transparent & Frictionless**: Clear next steps, demystified recording workflows, and low-pressure contact points.

### The Minimalist Studio Philosophy
- **Breathing Room & Openness**: Ample vertical rhythm (`margin-bottom: 3.5rem`), spacious fluid padding, and unboxed headers (`.page-header`) that let content breathe.
- **Zero Decorative Clutter & Box Fatigue**: Background fill boxes behind elements are removed; cards and sections use clean, subtle 1px hairline borders (`--border-color`) directly over the natural page background.
- **Pill-Free Typography**: Unnecessary pill capsules and circular badge backgrounds are eliminated. Interactive filters use clean typographic text tabs (`.filter-pill`), step sequences use editorial numerals (`01`, `02`, `03`), and carousel captions float cleanly with high-contrast text shadows.
- **Content-First Simplicity**: Authentic room photography, clean typography, and audio demos take center stage; decorative pills, heavy dropshadows, and nested boxes are eliminated.

---

## 2. Design Tokens & CSS Custom Properties

All colors, typography, and core visual properties are managed via CSS custom properties on `:root` in [`wireframe.css`](file:///Users/alex/Downloads/AlcoveSite/wireframe.css).

### 2.1 Color Palettes

#### Default Studio Palette: Golden Hour Room (Client Favorite)
Natural morning sunlight streaming into the tracking room, acoustic guitars, and calm creative focus.

```css
:root {
  --bg-page: #FDFBF7;        /* Warm parchment / morning white */
  --bg-surface: #FFFFFF;     /* Crisp paper card surface */
  --bg-accent: #F4EFE6;      /* Soft warm sand / subtle containers */
  --border-color: #E0DACF;   /* Neutral linen border */
  --border-focus: #4D7C5F;   /* Studio sage green focus ring */
  --text-main: #242E20;      /* Deep forest olive / high-contrast ink */
  --text-muted: #5D6B57;     /* Soft olive gray for captions and secondary text */
  --accent-primary: #4D7C5F; /* Studio sage green primary accent */
  --color-error: #d93025;    /* Form error red */
  --color-valid: #188038;    /* Form success green */
}
```

#### Secondary Palettes (Available via Theme Dock)
When designing new elements, test how they look against both light parchment and deep console themes:
- **Golden Hour Room (Favorite)**: Daylight streaming warmth (`#FDFBF7` page, `#242E20` text, `#4D7C5F` studio sage accent).
- **Terracotta Studio**: Sun-baked clay & warm acoustic baffles (`#F7F4EE` page, `#231D19` text, `#C85A32` terracotta accent).
- **Sundown Live Room (Twilight Dark)**: Cozy studio night tracking (`#1A1D1A` page, `#242924` surface, `#F2EFE9` text, `#E5A93C` amber bulb accent).
- **Laurel Canyon (Vintage Folk)**: Sunlit wood & tube preamps (`#FBF7EE` page, `#262016` text, `#B86B28` honey amber accent).
- **Deep Vinyl Midnight (Late Night)**: Late-night vocal session (`#11141E` page, `#181C2A` surface, `#F0F2FA` text, `#FF7A59` electric apricot accent).
- **Desert Sound City (Agave Teal)**: Modern recording retreat (`#F6F4F0` page, `#1C2321` text, `#2C7A7B` agave teal accent).

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
  --font-heading: "Outfit", system-ui, -apple-system, sans-serif;

  /* Body text: High-legibility humanist sans-serif */
  --font-sans: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;

  /* Technical / Audio Specs: Monospace for timecodes, gear specs, badges, and labels */
  --font-mono: "JetBrains Mono", ui-monospace, Menlo, Monaco, Consolas, monospace;
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
| **Mono / Badges / Meta**| `.carousel-badge`, `.track-meta`, `.step-badge` | `0.8rem` – `0.85rem` | 600 / 700 | `0.02em` | `1.4` |

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
Styling features:
- `padding: clamp(1.5rem, 3vw, 2.25rem)`
- `border: 1px solid var(--border-color)`
- `background: var(--bg-surface)`
- `border-radius: 2px` (analog console plate aesthetic)
- `margin-bottom: 3.5rem`

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
Clean typographic text tabs used for audio genre filtering:
```html
<div class="filter-bar" role="toolbar" aria-label="Genre Filters">
  <button type="button" class="filter-pill active" aria-pressed="true">All</button>
  <button type="button" class="filter-pill" aria-pressed="false">Indie Rock</button>
  <button type="button" class="filter-pill" aria-pressed="false">Acoustic</button>
</div>
```
- Flat, pill-free design (`background: transparent; border: none; border-bottom: 2px solid transparent`).
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
        <span class="filter-pill">[Genre]</span>
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

### 5.8 Studio Atmosphere Carousel (`.carousel-track`)
- Positioned below the Home hero with a sticky 100dvh viewport inside a 120vh scroll dwell.
- Edge-to-edge photography (`object-fit: cover`) showcasing authentic live room light and gear.
- Frosted analog console chevron buttons (`.carousel-btn--prev`, `.carousel-btn--next`).
- Studio channel plate badge (`.carousel-badge`) with current slide caption.
- Level-meter dot indicators (`.carousel-dots` and `.carousel-dot`).

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
  .carousel-slide { transition: none !important; }
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
| **<= 540px** | Mobile Phones | Header wraps neatly; nav link padding reduces to `0.25rem 0.45rem`; carousel buttons scale to `2.6rem`; feature items stack vertically. |

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
- [ ] Adheres to studio minimalism: no unnecessary borders, badge clutter, or nested boxes; generous spacing and breathing room preserved.
- [ ] Narrative copy uses clean `[ ... ]` placeholders until approved by Seth Miller.
