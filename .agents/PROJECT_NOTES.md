# Project Notes: Alcove Recording

## Client & Project Context
- **Client**: Seth Miller (Music Producer), Alcove Recording
- **Primary Objective**: Build a welcoming, unintimidating, modern website for Alcove Recording that replaces the intimidating Google Form.
- **Target Audience**: High school & teen musicians, young bands, and first-time recording artists who have never set foot in a studio.
- **Timeline**: 14-day delivery target.
- **Core Pages / Sections**:
  1. **Home**: Studio vibe, high-energy welcome, quick overview of what recording here feels like.
  2. **Process / How It Works ("First Time? Start Here")**: Demystifying the studio experience (prep, day-of, post-production).
  3. **Examples / Work**: Audio demos/sampler, client photos, gear/room atmosphere.
  4. **About**: Seth Miller bio, musical philosophy, approachable mentor vibe.
  5. **Contact / Booking Inquiry**: Frictionless multi-step or friendly conversational booking form (replacing raw Google Form).

## Technical & Design Decisions
- **Content Constraint**: Standard UI labels (Home, Process, Work, About, Contact, Book a Session) and form input labels use standard concise text to prevent multi-line wrapping and layout clutter; editorial/marketing copy, bios, and descriptions strictly use placeholder text (`[Headline Placeholder]`, `[Lorem ipsum...]`).
- **Tech Stack**: Static HTML5 + Modern CSS + Vanilla JS (chosen for zero build overhead, blazing fast load times, and effortless hosting).
- **Modern Web Architecture**: Semantic HTML5, CSS Grid / Flexbox layout with fluid scaling, `:user-invalid` / `:user-valid` form validation, responsive mobile-first design (`dvh`, container queries, `scrollbar-gutter: stable`).
- **Audio Strategy**: HTML5 semantic audio player with clean controls, track selector, and genre tagging.
- **Booking Flow**: Approachable form with pre-filtering questions (e.g., solo vs band, first time vs experienced, genre) to set artists at ease before asking for technical details.
- **Client Meeting Agenda Items**:
  - Visual aesthetic choice (Dark & Warm Studio vs Clean/Bright Indie vs Vintage/Analog).
  - Booking submission destination (Direct email vs Sheets webhook vs dashboard).

## Progress & Milestones
- [x] Initial research on recording studio website UX, teen-focused conversion, and modern web guidelines (`modern-web-guidance`).
- [x] Created `Project Charter.md` (Client: Seth Miller, 14-day timeline).
- [x] **Workspace Cleaned**: Removed obsolete/premature prototype files and controllers (`index.html`, `css/`, `js/`, `tests/`).
- [x] Aligned on New First-Principles Wireframe Prototype Plan & Architecture (strictly placeholder text).
- [x] Implemented Standalone Low-Fidelity Wireframe Prototype: `wireframe-prototype.html` (100% placeholder text, modern web standards).
- [x] Transitioned to Multi-Page Wireframe Architecture (`index.html`, `process.html`, `work.html`, `about.html`, `contact.html`) sharing `wireframe.css` with active navigation states and clean, single-line header labels.
- [x] Left-aligned global navbar with logo; integrated "Book a Session" workflow into `contact.html` (removing extraneous header CTA button).
- [x] Orient navbar links to the top right (`justify-content: space-between`) with logo on the top left.
- [x] Fixed hover layout shift/scaling bug on navbar links by pre-allocating transparent borders and maintaining constant `font-weight: 600` across default, hover, and active states.
- [x] Stripped all 5 pages (`index.html`, `process.html`, `work.html`, `about.html`, `contact.html`) to clean, blank slate canvases with shared persistent top-right header and footer shell.
- [x] Configured Google Doc synchronization via `sync_charter.sh` targeting Doc `1pKumu8AMftI42kU4cJL_V7S-5Z1vxSb3Tmt0WJ_V64Q` to auto-update `Project Charter.md`.
- [x] Approved & implemented Home Page (`index.html`) wireframe layout adhering strictly to placeholder copy for narrative text to be authored by Seth Miller.
- [x] Removed `process.html` and updated global navigation to match exact 4-page charter scope (`index.html`, `work.html`, `about.html`, `contact.html`).
- [x] Cleaned all placeholders across `index.html` to remove `- To be written by Seth` annotations.
- [x] Implemented approved About Page (`about.html`) wireframe layout (Meet Seth, The Space & Atmosphere, Collaborative Mentoring, Beginner Q&A, and Closing Invitation).
- [x] Redesigned Home Page (`index.html`) above-the-fold layout (Option A): spacious full-viewport atmosphere hero (`.hero-viewport`), breathing room, 16:9 studio window, and smooth `Explore the Vibe ↓` cue.
- [x] Implemented Studio Wordmark Viewport Hero: exclusively features `[Alcove Recording]` wordmark and short welcoming subheader occupying 100% of the above-the-fold viewport with circular scroll cue; 16:9 studio window repositioned below the fold.
- [x] Implemented approved Contact & Booking Page (`contact.html`) wireframe layout (Warm Greeting, Low-Pressure Inquiry Form, What Happens Next Roadmap, Direct Contact & Studio Location).
- [x] Implemented approved Examples/Work Page (`work.html`) wireframe layout (Audio Demos with genre filters, Voice Memo to Master evolution cards, 6-card candid session photo gallery, and Closing CTA).
- [x] All 4 charter pages (`index.html`, `work.html`, `about.html`, `contact.html`) fully wireframed adhering strictly to clean placeholder text for copy to be authored by Seth Miller.
- [x] Executed site-wide Cleanliness & Coherence Polish across all 4 pages and `wireframe.css`:
  - Eliminated "border overload" and nested box fatigue by transitioning subpages (`work.html`, `about.html`, `contact.html`) to open `.page-header` elements and softening section borders.
  - Implemented typographic scale (`clamp()`) for `h1`–`h4` and standardized margin rhythm in `wireframe.css`.
  - Resolved layout monotony by introducing `.grid-showcase` on `index.html` (wide featured gear card + stacked side cards) and `.feature-list` on `about.html` (horizontal mentoring items with icon badges).
  - Enhanced progression layouts with `.comparison-container` (before/after arrow) on `work.html` and `.roadmap-steps` (numbered 1-2-3 step badges) on `contact.html`.
  - Removed all inline styling across pages and added mobile responsiveness (`@media (max-width: 540px)`).
- [x] Removed all 14 eyebrow/badge section tags (`<span class="section-tag">...</span>`) across all 4 pages (`index.html`, `work.html`, `about.html`, `contact.html`) and cleaned up `.section-tag` in `wireframe.css` for a more streamlined, uncluttered look.
- [x] Implemented native Cross-Document View Transitions in `wireframe.css` (`@view-transition { navigation: auto }`) with persistent header (`main-header`) and footer (`main-footer`) morphing, custom 0.25s page fade-and-settle curves, and `@media (prefers-reduced-motion: reduce)` accessibility fallback.
- [x] Upgraded page navigation to smooth horizontal sliding transitions (`page-slide-out` / `page-slide-in`) with locked header/footer anchoring.
- [x] Centered navigation bar below the Studio Wordmark & subheader in the Home Page initial hero viewport (`.hero-nav`), and implemented a smart scroll reveal for the sticky top navigation (`.site-header--smart` slides in when scrolling up; tucked away when reading down, with full keyboard `:focus-within` accessibility).
- [x] Implemented approved interactive wireframe fidelity & structural cleanliness improvements:
  - Upgraded FAQ section on `about.html` to native semantic `<details>` and `<summary>` accordions with smooth CSS rotation indicators (no JS overhead).
  - Added visual audio timeline scrubber (`0:42 / 2:45`) and track duration badges (`2:45`, `3:12`, `1:58`, `3:30`) with compact preview buttons to `work.html` demo sampler.
  - Added dedicated Voice Memo / Audio File dropzone wireframe component on `contact.html` with browse/drag-and-drop affordance for teens and bedroom songwriters.
  - Completely eliminated all remaining inline styles across `about.html` and `contact.html` by creating `.bio-grid` and `.contact-details-mono` classes in `wireframe.css`.
- [x] Refined Home Page hero viewport to full `100dvh` (resetting container top-padding) to prevent below-the-fold content peeking onto the initial screen, and converted hero navigation links to clean plain text links (removing button box styles).
- [x] Removed active indicator on the Home Page hero navbar (`.hero-nav`) so all four links remain clean, neutral text until hovered.
- [x] Suppressed redundant page reload and sliding cross-document view transition when clicking "Home" while already on the Home Page (`index.html`).
- [x] Re-engaged `.agents/PLAN_LOCK` to gate modifications.
- [ ] Client Discovery Review with Seth Miller.
