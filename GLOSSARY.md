# Glossary

- **Fader**: custom console-style scroll bar control that mirrors page scroll, is draggable and keyboard operable (slider semantics).
- **Gear treatment**: the stylized hardware look (gradients, bevels, highlights, pressed states) applied to the audio player, buttons, navigation and photo captions. The booking form's pickers stay plain.
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
