# Glossary

- **Fader**: custom console-style scroll bar control that mirrors page scroll, is draggable and keyboard operable (slider semantics).
- **Gear treatment**: the stylized hardware look (gradients, bevels, highlights, pressed states) applied to the audio player, buttons, navigation and photo captions. The booking form is fitted out as a Faceplate (decided 2026-11-24, replacing the earlier plain-pickers rule).
- **Faceplate**: the screwed-on metal panel the booking form sits on; its controls are recessed text slots, Push keys (Session Type and Experience Level), a Demo slot with jack and a Send key, each with an etched label and a status LED.
- **Push key**: a latching key in a row where one stays lit; used for Session Type and Experience Level; each row is a real radio group underneath.
- **Status LED**: the small lamp beside a form control: dark idle, green valid, red invalid. Never the only signal; the text message stays.
- **Photo slot**: a taped or polaroid frame with a label-maker caption; placeholder slots keep real aspect ratios and are marked for Seth to replace.
- **Grain**: scanned film grain over the page (`body::after`, set in `textures.css`, with an SVG-noise fallback); scaled by `--tex-strength` and disabled under `prefers-reduced-transparency`.
- **Tactile texture**: a small CC0 scanned tile (paper, tape, label stock, film grain) layered per surface through `textures.css`, switched Off / Quiet / Bold in the Theme Preview Toolbar. Decorative only; never over text. _Avoid_: photo background, overlay image.
- **Print wear**: a speckle mask on display headings, label captions and tape so they look printed rather than typed. Body text, form fields and buttons never get it.

## Booking

- **Inquiry**: one booking request an artist sends Seth through the Contact page form. _Avoid_: submission, application, lead.
- **Demo**: an audio or video recording the artist attaches to an Inquiry so Seth can hear them; every Inquiry needs at least one, and a phone voice memo counts. _Avoid_: voice memo (as the general term), sample, upload.
- **Session Type**: the kind of studio work the artist is asking for; the list is Seth's to define. _Avoid_: project scope, service, package.
- **Experience Level**: how much recording the artist has done before, so Seth can pitch his reply. _Avoid_: skill level.

## Admin

- **Admin mode**: an editing state of the live site, switched on by pasting a GitHub token, in which an editor changes Site Content text and Site Defaults and saves them. Visitors never see it. _Avoid_: CMS, dashboard, backend.
- **Site Content**: the marked text (headings, paragraphs, captions) an editor may change in place; plain text only. Booking form labels and Session Type names are not Site Content.
- **Site Defaults**: the theme options (palette, font, texture, Surface, Gradient, hero grain) every visitor starts with; chosen in Admin mode. Tape and Cards are added once this copy is reconciled with the real repo. The public Theme Preview Toolbar is hidden from visitors.
- **Content branch**: the repo branch Admin mode saves to; the developer reviews and merges it to main to publish. _Avoid_: draft, staging.
- **Media slot**: a place on the site that shows one photo, video or audio clip (a photo, the session video with its poster, the A/B deck memo or master clip, the About portrait); an editor replaces its file in Edit mode.
- **Song**: one entry in the Work page's song list: a title and an audio file, in an editor-chosen order. Songs have no genre; the genre filter is retired. _Avoid_: track, recording (in editor-facing wording).
- **Media file**: an uploaded photo, video or audio file stored in the repo and saved to the Content branch with the text edits; replaced or removed files are deleted unless something else still uses them.

## Work page

- **Record player**: the Work page sampler, a photoreal top-down turntable (plinth, platter, record, tonearm) beside a Crate; replaces the old tape-deck sampler. The Voice Memo vs. Master A/B deck stays a tape deck.
- **Crate**: the messy pile of picture-only Sleeves beside the Record player (below it on phones); the current Sleeve sticks out of the pile, one Sleeve per Song in the saved order. (No longer an actual crate; the name stays in code.)
- **Sleeve**: one record in the Crate, a button showing only its cover picture (a Cover set in Edit mode with Replace cover, else a printed placeholder pattern) (the Song's title is for screen readers, and on the record's label once playing); clicking the current Sleeve lifts it so its record slides out onto the platter. _Avoid_: track row, card.
- **Tonearm**: the arm on the Record player; at rest, or on the record while playing (later also a slider to seek).
