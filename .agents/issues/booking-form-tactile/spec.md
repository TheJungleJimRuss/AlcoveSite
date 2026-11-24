# Spec: Tactile booking form (Faceplate)

Status: built (tickets 01-04 done)
Supersedes: parked ticket 07 (`analog-studio-style/issues/07-gear-booking-form.md`) and the "pickers stay plain" rule in `booking-form-content/spec.md`. Vocabulary: see GLOSSARY.md (Faceplate, Push key, Slide switch, Status LED, Inquiry, Demo, Session Type).

## Problem Statement
The Contact page form looks like a generic web form, while the rest of the site feels like real studio hardware. An artist, often a nervous teen, meets an intimidating-feeling form at the exact moment the site should feel welcoming and physical.

## Solution
The form sits on a screwed-on metal Faceplate on the brushed-metal page. Every control reads as a real object with visible depth and a visible press state: text fields are recessed slots with etched labels, Session Type is a row of Push keys, Experience Level is a three-position Slide switch, the Demo area is a dark slot with a jack and a lit progress bar, and Send is a large key that sinks when pressed. A Status LED beside each control shows idle, valid or invalid, always paired with the existing text message. The questions, fields, validation rules, upload flow and backend do not change.

## User Stories
1. As an artist, I want the form to feel like a piece of studio gear, so that the Contact page matches the rest of the site and feels welcoming.
2. As an artist, I want text fields that look recessed into the panel, so that it's obvious where to type.
3. As an artist, I want a clear lit edge on the field I'm typing in, so that I always know where I am.
4. As an artist, I want etched labels above every control, so that I know what each one asks.
5. As an artist, I want Session Type shown as three keys where one stays lit, so that I can see my choice at a glance.
6. As an artist, I want a key to visibly sink when I press it, so that the choice feels real.
7. As an artist, I want Experience Level as a slider that snaps between three labelled positions, so that answering feels like flipping a switch, not filling a form.
8. As a keyboard user, I want arrow keys to move the Push keys and the Slide switch, so that I can complete the form without a mouse.
9. As a screen-reader user, I want both controls announced as a radio group with a label and the current choice, so that I know what's selected.
10. As an artist, I want a green lamp when a field is good and a red lamp when it needs fixing, so that I get feedback while I fill it in.
11. As a colour-blind artist, I want the error text and an icon-like lamp shape to accompany the colour, so that I never rely on colour alone.
12. As an artist, I want the existing helpful error messages kept, so that I know exactly what to fix.
13. As an artist, I want the Demo area to look like a slot with a jack I can drop a file into, so that attaching a recording feels natural.
14. As an artist, I want to drag a file onto the slot and see it light up, so that I know it will accept the file.
15. As an artist, I want attached Demos shown as small label strips with a remove control, so that I can see and undo what I attached.
16. As an artist on a phone, I want Browse Files to be one large tap target, so that I can pick a voice memo easily.
17. As an artist, I want upload progress shown as a lit bar, so that I know the file is going.
18. As an artist, I want a big Send key that sinks and a lamp that lights while sending, so that I know my press registered and the Inquiry is going.
19. As an artist, I want Send disabled while it is uploading, so that I can't send twice.
20. As an artist on a phone at 375px, I want the Push keys to stack and the Slide switch to stay usable, so that nothing is cramped or overflows.
21. As an artist on a tablet or desktop, I want the Faceplate to keep a comfortable width, so that it doesn't stretch awkwardly.
22. As an artist who prefers reduced motion, I want presses and switches to change state instantly without animation, so that nothing moves unexpectedly.
23. As an artist using high contrast or forced colors, I want plain, clearly outlined controls, so that I can still use the form.
24. As an artist using reduced transparency, I want textures and soft shadows dropped, so that the form stays crisp.
25. As an artist in dark mode, I want the Faceplate and lamps to look right in both palettes' dark variants, so that nothing washes out.
26. As an artist, I want each palette (Olive & Orange, Sage & Coral, light and dark) to colour the Faceplate and lamps, so that the form belongs to the site.
27. As Seth, I want every Inquiry to arrive with the same fields as before, so that my email, sheet and Drive flow keep working.
28. As the developer, I want no backend or Apps Script change, so that the live form isn't put at risk.
29. As the developer, I want controls to remain real inputs underneath, so that validation, autofill and submission behave as before.
30. As a phone user on a slow device, I want the Faceplate to add almost no download weight, so that Contact stays fast (no new large images).
31. As an artist, I want the passing of a required field with no input to show the invalid lamp only after I leave it or try to send, so that I'm not scolded early.
32. As an artist, I want the form to look the same in Lite mode apart from dropped sheen, so that slow devices still get the full layout.

## Implementation Decisions
- Presentation only. Same fields, names, order, required rules, error messages, phone formatting, Demo limits, upload steps and endpoint. No new fields (solo/band and genre were considered and declined); no backend redeploy.
- Faceplate: one raised panel containing the whole form, with four corner screws (same countersunk screw language as the cassette deck), an etched title, and etched section dividers using the existing etched-groove tokens. Colours from palette tokens only; no inline styles; no hard-coded new palette values.
- Text fields (name, artist or band, email, phone, anything else): recessed slot via inner shadow and lip highlight; etched label above; focus = soft lit edge (not colour alone: also a thicker lip). Fields remain native inputs.
- Session Type: the existing select is replaced by a radio group rendered as three Push keys, latching, one lit at a time, with a visible pressed travel. Same option values and the same required rule. Group has a legend; arrow keys move selection.
- Experience Level: the existing select is replaced by a radio group rendered as a 3-position Slide switch with a thumb and etched labels at each position; the thumb snaps between positions; clicking a label moves it; arrow keys move it. Same option values and required rule.
- Status LED: one small lamp per control: dark idle, green when valid, red when invalid, driven by `:user-valid` and `:user-invalid` (and the group equivalent via `:has()`); invalid also shows a distinct shape, and the text error remains. No lamp while pristine.
- Demo slot: dark recessed slot with a jack-style socket; drag-over lights it; existing Browse Files button, file list, error line and progress element keep their behaviour and ids, restyled (progress as a lit bar, files as label strips). Accept attribute stays as is (Android Files-only rule in project notes).
- Send: a large key with visible press travel; a lamp lights during sending; disabled while sending. Remains a real submit button.
- Responsiveness: mobile-first; at 640px and below the Push keys stack full-width; all tap targets at least 44px; no horizontal overflow at 375, 768 and 1200px.
- Accessibility and fallbacks: AA contrast in all four palette variants; `prefers-reduced-motion` removes travel and snap animation; reduced transparency and increased contrast drop textures and soft shadows and fall back to plain outlines; forced colors uses system colours; focus rings stay visible.
- Weight: CSS only, SVG or CSS-drawn screws and lamps, no new raster images. Respects Lite mode (drops sheen, filters).
- The glossary no longer says the booking form's pickers stay plain; update the booking-form-content spec line to point here when built.
- The theme dev toolbar and Admin mode are untouched. Booking form copy stays non-editable.

## Testing Decisions
- One seam: the browser-level booking check (`tests/booking-check.mjs`), which already drives the real form with the endpoint swapped to a mock. Extend it rather than adding a new harness. Test only external behaviour: what a user can see and do, not class names or internals.
- Extend to cover: choosing a Push key and a Slide switch position by mouse and by keyboard and seeing the submitted values unchanged; required-field errors and lamps appearing only after interaction; the Demo flow still working (drag-over, attach, remove, progress); Send disabled during upload; no horizontal overflow at 375, 768 and 1200px; reduced-motion run has no running animations.
- Run alongside: `node tests/contrast-check.mjs` and `npm run check` (note known pre-existing texture-check and admin-check failures in project notes; run admin and lite checks on their own). `web-runtime-verification` with screenshots at phone, tablet, desktop and four palette variants before done.
- Prior art: `tests/booking-check.mjs`, `tests/lite-check.mjs`, `tests/texture-check.mjs`. `tests/live-inquiry.mjs` stays manual and is not run.

## Out of Scope
- New questions (solo/band, genre), changing Session Type names, Apps Script or sheet changes.
- Sound, haptics, guarded Send switch, knobs.
- Admin editing of form copy.
- Safari and Firefox testing beyond a basic check.

## Further Notes
- Needs only an updated screenshot set in `.agents/issues/booking-form-tactile/screenshots/`.
- Open questions for Seth, unchanged: Session Type names and whether he wants a genre question later.
- Suggested slices for `to-tickets`: (1) Faceplate + text slots + Status LED, (2) Push keys + Slide switch, (3) Demo slot + Send key, (4) fallbacks, responsive and verification.
