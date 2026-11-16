Status: needs-triage (awaiting "Approved")

# Record player on the Work page

## Problem Statement

The Work page's "Recent Recordings" sampler is a tape deck above a plain list of track rows. Picking a song is just clicking a row. The user wants something more fun and on-brand: a record player where the visitor picks a record and it plays.

## Solution

Replace the sampler (tape deck + track rows) with a **Record player**: a flat, top-down CSS/SVG turntable with a **Crate** of **Sleeves** beside it (below it on phones). Clicking a Sleeve slides its record out and drops it on the platter, the tonearm swings onto the grooves and the track plays. The record spins while playing; pause lifts the arm. Dragging the tonearm across the record seeks. A play/pause button and a timeline stay for keyboard and screen-reader users. The genre filter now filters Sleeves. The "Voice Memo vs. Finished Master" A/B deck stays a tape deck, unchanged.

## User Stories

1. As a visitor, I want to see the four recordings as record sleeves in a crate, so that browsing feels like flipping through records.
2. As a visitor, I want to click a sleeve and watch its record move onto the turntable and start playing, so that picking a song feels physical.
3. As a visitor, I want the record to spin and the tonearm to sit on it while it plays, so that I can tell at a glance it's playing.
4. As a visitor, I want pausing to lift the arm and slow the platter to a stop, so that the state is obvious.
5. As a visitor, I want to drag the tonearm across the record to jump to a part of the song, so that seeking feels like dropping the needle.
6. As a visitor, I want clicking a different sleeve to swap records, so that I can compare songs quickly.
7. As a visitor, I want clicking the sleeve that's already playing to pause it, so that I don't have to find a separate button.
8. As a visitor, I want the arm to return to rest and the record to stop when a track ends, like a real record.
9. As a visitor, I want the genre tabs to show only matching sleeves, so that I can find my kind of music.
10. As a phone visitor, I want the turntable full-width with the sleeves in a sideways swipe row below, so that it fits my screen.
11. As a keyboard user, I want every sleeve, the play/pause button and the timeline to be focusable and operable, so that I don't need a mouse.
12. As a keyboard user, I want the tonearm to act as a slider (arrow keys seek), so that the needle drop is not mouse-only.
13. As a screen-reader user, I want the current record's title and play state announced, so that I know what's playing.
14. As a visitor who prefers reduced motion, I want no spinning or swinging animations (state shown statically), so that the page stays calm.
15. As a forced-colors user, I want the controls to stay visible and decoration to drop away, so that nothing becomes invisible.
16. As Seth (in Admin mode), I want the record titles and sleeve subtitles to stay editable, so that I can rename songs without a developer.
17. As Seth, I want each sleeve to have a slot where real cover art can drop in later, so that the placeholder designs are easy to replace.
18. As a visitor, I want starting the record player to pause the A/B deck (and vice versa), so that two songs never play at once.
19. As a visitor, I want the header oscilloscope to keep reacting while a record plays, so that the site-wide "now playing" cue still works.

## Implementation Decisions

- **Look**: flat, top-down CSS + inline SVG (no library, no 3D). Plinth, platter with a slip mat, record with grooves and a centre label in the palette colours, tonearm with a headshell, pivot and rest. Themed only by palette tokens so all four palette variants work. Hardware gloss is allowed under ADR 0005 (it covers the Work players); textures come from `textures.css` as usual.
- **Sleeves (placeholder)**: typographic designs from palette tokens showing track title and genre, one design variant per genre. Each sleeve has a cover slot (`<img>` hook or CSS var) so real art replaces the placeholder without markup changes. The record's centre label repeats the title.
- **Selecting**: sleeves are `<button>`s in the crate; click/Enter/Space loads that record. Animation: record slides out of the sleeve and onto the platter, then the arm swings in. Clicking the current record's sleeve toggles play/pause.
- **Tonearm seek**: the arm is a `role="slider"` (0 to duration, `aria-valuetext` like "1:12 of 2:45"). Pointer drag maps arm angle to the groove band (outer edge = 0:00, inner = end); arrow keys step 5s, Home/End jump. Audio stays playing while dragging; seek commits on release. Before a record is loaded the arm is disabled.
- **Controls**: one play/pause button and the existing timeline (`player-timestamp` + scrubber, made a real slider) stay below the turntable. Prev/next transport keys are removed (the crate replaces them).
- **Track end**: stop, arm returns to rest, record stays on the platter (no auto-advance).
- **Genre filter**: same tabs, now hide/show sleeves by `data-genre`. Filtering does not stop the current record.
- **Mobile (<=640px)**: turntable full width on top; sleeves in a horizontal scroll-snap row below.
- **Reduced motion**: no spin, no slide, no arm swing; arm and record jump straight to their states.
- **Audio logic**: keep one `<audio>` element and the current behaviour: only one media element plays at once (pauses the A/B deck), `now-playing.js` keeps drawing. Move the inline sampler script out of `work.html` into `record-player.js`.
- **Admin keys**: keep the existing `work.track.<genre>.title` / `.sub` keys on the sleeve text; drop the `.play` keys (no "Play Preview" buttons any more). Admin's capture-phase edit handler must still edit sleeve titles instead of loading the record while Edit mode is on.
- **Removed**: the sampler's tape-deck display and reels, track rows, Play Preview buttons. The A/B deck keeps its own reels.
- **Docs**: GLOSSARY entries for Record player, Crate, Sleeve, Tonearm. Update PROJECT_NOTES (audio decision line). No new ADR needed (ADR 0005 already covers player gloss).

## Testing Decisions

- New `tests/record-player-check.mjs` (Playwright, added to `npm run check`): clicking a sleeve sets the audio src and plays; clicking it again pauses; another sleeve swaps; genre filter hides the right sleeves; the tonearm slider's arrow keys and a pointer drag change `currentTime`; `ended` returns the arm to rest without starting another track; reduced-motion has no running animations; starting the A/B deck pauses the record player; no horizontal overflow at 375px.
- Update `tests/admin-check.mjs` where it references track rows / `.play-btn`.
- `npm run check` + `node tests/contrast-check.mjs`, then `web-runtime-verification` screenshots at phone, tablet and desktop in both light and dark palettes.

## Out of Scope

- Changing the Voice Memo vs. Master A/B deck.
- Real cover art (waits on Seth).
- 3D or photo-based turntable, drag-sleeve-onto-platter interaction, auto-play next record, 33/45 speed switch.

## Further Notes

- Seth has not reviewed this; it changes the Work page's signature element.
- Tickets (draft): 01 static turntable + crate markup/CSS (with mobile layout); 02 `record-player.js` select/play/pause/end + genre filter; 03 tonearm slider seek (pointer + keyboard); 04 animations + reduced motion/forced colors; 05 admin keys, tests, docs.

## Amendment 2026-11-13: Milk crate

User feedback: the grid of Sleeves doesn't read as a crate. Replace it with a real-looking **plastic milk crate** you flip through. See ticket 04.

- **Look**: a plastic milk crate (grid-pattern sides, rounded rim, handle cut-out) seen from the front and slightly above, in CSS/SVG with palette-tinted plastic. Sleeves stand on end inside; you see the full cover of the front Sleeve and the top edges of the ones behind it (title strip on each edge). Same placement: right of the turntable on desktop, below it on phones.
- **Flipping**: Sleeves tip forward one at a time (rotateX around their bottom edge, CSS 3D perspective) to reveal the next one. Controls: prev/next buttons, Left/Right (and Up/Down) arrows when the crate has focus, mouse wheel over the crate, swipe on touch. The crate is one focusable `role="group"`/listbox-style widget announcing "Record 2 of 4: Bedroom Pop Single". Wrap-around is off: flipping stops at the first and last record.
- **Selecting**: click/Enter/Space on the front Sleeve: the Sleeve lifts out of the crate, the black disc slides out of it and travels to the platter, the Sleeve drops back into the crate, then the arm swings in (existing ticket 03 flow). The loaded Sleeve is marked in the crate (e.g. a small "on the platter" tab on its edge). Clicking the front Sleeve when it's the one playing toggles pause, as before.
- **Genre tabs**: filter which Sleeves stand in the crate; the crate flips to the first match. Playback continues.
- **Reduced motion**: no tipping or travel; flips and selection change state instantly.
- Admin edit keys and `data-genre`/`data-src` stay on the Sleeves; Admin Edit mode still edits Sleeve titles instead of loading.

## Amendment 2026-11-13 (2): Photoreal look

User feedback: the CSS/SVG turntable and crate look cartoony; the whole record player must look real. See ticket 05.

- **Approach (user choice)**: photoreal renders made in Blender (driven through the Blender MCP), exported as layered transparent WebP/AVIF images, animated by the existing `record-player.js` state machine (spin, arm swing/lift, crate flip, disc travel). No live 3D, no library. Interactions, ARIA, tests and data attributes stay as built in tickets 01-04.
- **Angle (user choice)**: straight top-down, matching the current layout. Same camera for every layer (orthographic, top-down) so layers line up; soft key light from top-left with contact shadows baked into a separate shadow layer per moving part.
- **Turntable layers**: plinth (wood or brushed metal deck with platter well, feet shadow, 33/45 buttons, cue lever), platter + slip mat, vinyl disc (real groove sheen, separate centre-label layer so titles stay live HTML text), tonearm (S-arm with counterweight, headshell, cartridge; pivot point recorded in px so `--arm-angle` rotation still lines up), arm rest. Spin rotates the disc + label layers only; the sheen/highlight is a fixed overlay so the reflection stays put while the record turns (as on a real record).
- **Crate layers (top-down)**: a real plastic milk crate seen from above (rim, grid floor and walls in perspective-free orthographic view). Sleeves seen from above as their top edges standing in the crate; flipping tips the front Sleeve forward so its cover lies face-up over the front rim (a real crate-digging view). Sleeve covers stay the per-genre art (re-rendered as printed card with wear, paper texture and soft shadow) with the `--cover` slot for real art; titles stay live HTML.
- **Assets**: sources in `assets-src/record-player/` (`.blend`, licence notes for any imported models/textures, CC0 only, recorded in `images/textures/LICENSES.md` or a sibling file), exports in `images/record-player/` at 1x and 2x, WebP with AVIF where smaller. Budget: about 600 KB total for the section at 2x, lazy-loaded below the fold.
- **Palette**: renders are neutral (real materials), not palette-tinted; the section keeps palette tokens for text, buttons and focus. Dark palettes get a slightly darker ambient via CSS filter only if contrast needs it.
- **Reduced motion / forced colors**: unchanged rules; forced colors hides the photo layers and shows the outlined fallback.
- **Out of scope**: the A/B deck, play button and timeline.

- 2026-11-13 follow-up: the crate was first rendered tilted (front and a little above); re-rendered straight top-down per this amendment. The front Sleeve lies face-up over the front rim, Sleeves behind show only their title edge, flipped-past Sleeves lie under the front one.

## Amendment 2026-11-13 (3): Messy pile, picture-only sleeves

User feedback: make the sleeves just pictures; drop the crate; a stack of records where one sticks out at a time as you select it.

- **No crate**: the milk crate render leaves the page (sources stay in `assets-src/`). The Crate (same widget, same name in code and GLOSSARY, now described as a pile) is a **messy pile** of Sleeves seen from straight above, each at its own slight angle and offset, on the bare page surface.
- **Picture-only Sleeves (user choice)**: a Sleeve shows only its cover picture (card render + placeholder art or `--cover`). No visible title, subtitle or text strip. Titles show nowhere on the sleeve; the record's centre label still shows the title once it is on the platter. Each Sleeve keeps its accessible name (the title) and the "Record N of M: title" announcement.
- **Selecting (user choice)**: arrows, wheel, swipe and the previous/next keys move through the pile; the current Sleeve slides partly out of the pile (sideways, on top of the others) and is the only tab stop. Clicking the sticking-out Sleeve plays it (lift, disc slides out, travels to the platter, as now); clicking it again pauses. Clicking a visible part of another Sleeve in the pile makes that one stick out without playing.
- **Kept**: the "on the platter" tab on the loaded Sleeve, the pick animation, reduced motion (no sliding), forced colors (outlined boxes), all state/ARIA/test behaviour except the title-strip click, which becomes a click on the visible part of a pile Sleeve.
- **Admin**: sleeve titles and subtitles are no longer visible, so they are edited only through the Admin Songs list (titles); the per-sleeve subtitle key is dropped from the visible page.


Follow-up 2026-11-13 (user): Sleeves match the record's size; the pile lies partly off the right edge of the screen and the current Sleeve sticks out to the left, staying under the Sleeves above it.
