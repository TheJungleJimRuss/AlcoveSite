Status: ready-for-agent

# Analog Studio Style

## Problem Statement

Seth Miller's updated brief for Alcove Recording asks for a colorful, skeuomorphic, grainy, textured site with a scroll bar fader and lots of pictures, aimed at teens and highly mobile compatible. The current site follows a minimalist "unboxed" direction (no fill boxes, pills or shadows) that contradicts that brief. It also doesn't use the studio's real retro-script logo, so visitors don't get the tactile, creative, welcoming studio feel Seth wants.

## Solution

Replace the minimalist direction with a **stylized analog studio** look across Home, Work, About and Contact. It is an equal mix of recording gear (faders, knobs, buttons, VU meters, tape) and printed things (labels, stickers, polaroids), built only from CSS and SVG. Seth's two palettes stay but get bolder, with subtle grain. The supplied logo becomes the Home hero wordmark and header logo. A custom console-style scroll bar fader works on every screen size. Photos sit in taped or polaroid slots. Headings gain a retro display face that echoes the logo. The Theme Preview Toolbar stays for Seth's review.

## User Stories

1. As a teen musician visiting for the first time, I want the site to feel like a friendly, colorful studio, so that recording feels exciting instead of intimidating.
2. As a visitor, I want to see the Alcove Recording logo prominently on the Home hero, so that I immediately recognize the studio's identity.
3. As a visitor, I want the logo in the header on every page, so that I always know where I am.
4. As Seth, I want the logo to recolor with each theme, so that it always matches the chosen palette.
5. As a visitor on a desktop, I want a draggable console-style fader that follows page scroll, so that scrolling feels like riding a mixing board.
6. As a visitor on a phone, I want a slim thumb-draggable fader on the right edge, so that I can scrub through long pages quickly.
7. As a phone user, I want normal touch scrolling to still work with the fader present, so that nothing feels hijacked.
8. As a keyboard user, I want the fader to be focusable and operable with arrow, Page Up/Down, Home and End keys, so that I can scroll without a mouse.
9. As a screen reader user, I want the fader to expose its scroll position, so that it adds information rather than noise.
10. As a visitor with reduced-motion settings, I want no animated fader flourishes, so that scrolling stays comfortable.
11. As a visitor, I want the fader to hide when idle on mobile, so that it doesn't cover content.
12. As a visitor, I want the audio player to look like a tape deck or console strip with tactile transport buttons and a VU meter, so that listening to demos feels like being in the studio.
13. As a visitor, I want the track selector and genre filter to look like hardware controls, so that browsing demos is fun.
14. As a first-time artist, I want the booking form's solo/band, first-time/experienced and genre questions to look like knobs and toggles, so that the questions feel playful and low-pressure.
15. As a visitor, I want buttons and the navigation to look chunky and tactile, so that it is clear what I can press.
16. As a mobile user, I want the bottom tab bar to keep its labels and 44px targets in the new style, so that navigation stays easy.
17. As a visitor, I want photos in taped or polaroid slots with label-maker captions, so that the site feels handmade and personal.
18. As Seth, I want clearly marked placeholder photo slots at real aspect ratios, so that I know exactly which images to supply.
19. As a visitor, I want to see the four existing studio photos used well, so that the site shows real rooms from the start.
20. As a visitor, I want bold, colorful panels in Seth's palettes, so that the site feels lively rather than muted.
21. As a visitor, I want subtle grain over backgrounds and surfaces, so that the site feels warm and analog.
22. As a user who prefers reduced transparency, I want the grain turned off, so that text stays crisp.
23. As a reader, I want all text to meet AA contrast on grainy and colorful surfaces, so that everything is readable.
24. As a visitor, I want headings in a retro display face that echoes the logo, so that the typography matches the brand.
25. As a visitor, I want body text to stay in the friendly modern face, so that long text remains easy to read.
26. As Seth, I want light and dark variants of both palettes to keep working in the new style, so that I can compare options in the Theme Preview Toolbar.
27. As Seth, I want the Theme Preview Toolbar kept, so that I can review palettes and fonts in the Client Discovery Review.
28. As a visitor, I want the Home carousel restyled as part of the analog look, so that it feels consistent with the other pages.
29. As a visitor, I want page-to-page transitions to keep working, so that navigation still feels smooth.
30. As a visitor on a slow phone, I want textures and grain to be lightweight CSS/SVG, so that pages load fast and scrolling stays smooth.
31. As a developer, I want the style guide rewritten to describe the new direction, so that future work stays consistent.
32. As a developer, I want an ADR recording the move away from minimalism, so that future contributors understand why.
33. As a developer, I want the shared terms (fader, gear treatment, photo slot, grain) defined in a glossary, so that the team uses one vocabulary.

## Implementation Decisions

- **Direction change.** The new style supersedes the minimalist "unboxed" rules. Keep generous whitespace and legible layout, and use hairlines only where they help. A new ADR records the reversal, and the style guide sections on pills, fill boxes and shadows are rewritten.
- **Metaphor and realism.** An equal mix of analog gear and printed ephemera, rendered in a stylized way (soft gradients, highlights, bevels) with CSS and SVG only. No photoreal textures and no large raster texture files.
- **Gear treatment applies to** the audio player (transport buttons, VU meter, track selector, genre filter), buttons and navigation (including the mobile bottom tab bar), the booking form's pre-filter questions (knob and toggle style), and photos with captions (tape and label-maker captions).
- **Scroll bar fader.** A custom control that replaces the visual scrollbar on all screen sizes, mirrors page scroll position in both directions, and is draggable. It is operable by keyboard, exposes its position to assistive technology (slider semantics), and falls back to the native scrollbar when scripting is unavailable. Native touch scrolling is never blocked. On mobile it is a slim right-edge control with about a 44px touch target that hides when idle and avoids the bottom tab bar and safe-area insets. It respects `prefers-reduced-motion`.
- **Logo.** The supplied retro-script "Alcove / RECORDING" logo becomes a transparent, theme-colored asset (vector if a trace is clean, otherwise a transparent raster with a CSS mask), used as the Home hero wordmark and the header logo.
- **Color and grain.** The palettes are unchanged (Seth's two picks, each light and dark) but applied more boldly: saturated accent panels, colored fader caps and knobs. A subtle SVG-noise grain covers backgrounds and surfaces, is disabled under `prefers-reduced-transparency`, and must not break AA contrast.
- **Typography.** Keep the existing body pairing and add a retro display face for headings that echoes the logo, wired into the theme toolbar's font options.
- **Photos.** The four existing photos are used in taped or polaroid slots. Additional slots are real-aspect-ratio placeholders marked for Seth to replace. No generated stock imagery.
- **Onboarding.** No new flow. The existing booking pre-filter questions and the 01-03 roadmap are restyled only.
- **Scope.** All four pages, the carousel and the shared stylesheet, rolled out together. The Theme Preview Toolbar and cross-document View Transitions stay. Project notes and `STYLE_GUIDE.md` are updated, a `GLOSSARY.md` is created, and the ADR is added under `docs/adr/`.
- **Guardrails.** AA contrast, `prefers-reduced-motion` and `prefers-reduced-transparency` respected, no inline styles, no horizontal overflow at phone, tablet or desktop widths, and zero console errors.

## Testing Decisions

- **Single seam: real-browser checks of the four pages** at phone, tablet and desktop widths (Playwright), driven through the page as a visitor would see it.
- **A good test** asserts external behavior only: the fader moves when the page scrolls and the page scrolls when the fader is dragged or keyed, there are no console errors, there is no horizontal overflow, controls are keyboard reachable, and the grain is absent under reduced transparency. It does not assert CSS internals.
- Contrast is checked at AA for the text-on-surface pairs across all four themes.
- Screenshots at each width are the deliverable of the `web-runtime-verification` pass.
- There is no prior art for tests in the repo. This introduces the first browser check.

## Out of Scope

- Stretch goals: flyers, posters, business cards and the in-site booking tracker.
- A new onboarding flow or studio tour.
- New color palettes.
- Photoreal textures or generated stock photography.
- Booking submission backend (still an open question for the Client Discovery Review).
- Copy: Seth still authors editorial text.

## Further Notes

- The notes list "Onboarding Experience" under Style. Per the grilling, it is met by the existing pre-filter questions and roadmap, so confirm with Seth during the Client Discovery Review.
- The logo source is `IMG_20261111_160423.png`, a 3840x2160 white-on-black PNG.
- Next step after approval: `to-tickets` to split this into slices (tokens and grain, logo and typography, fader, gear components, photos, docs and ADR).
