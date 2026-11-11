# Workspace Agent Rules: Alcove Recording

## 1. Project Phase & Scope Boundary (STRICT)
- **Current Phase**: Client Discovery & Low-Fidelity Wireframing (Client: Seth Miller).
- **Prohibited Actions**:
  - DO NOT write production JavaScript controllers (`audio-controller.js`, `booking-service.js`, audio synthesizers).
  - DO NOT write automated backend test suites or complex state machines.
  - DO NOT jump ahead into full-site production code.
- **Allowed Actions**:
  - Standalone HTML/CSS wireframes (`wireframe-prototype.html`) and structural visual mockups.
  - Client meeting agendas and question lists to resolve aesthetic choices (Dark/Warm vs Clean/Indie) and booking workflows.
- **Content & Placeholder Scope (User Preference)**:
  - Standard UI navigation items (e.g., Home, Work, About, Contact, Book a Session), action buttons, and form labels should use clean, standard real labels rather than verbose placeholder tokens to prevent line wrapping and clutter.
  - Narrative copy, headlines, bios, track titles, and marketing descriptions must strictly remain clean placeholder text (e.g., `[Headline Placeholder]`, `[Lorem ipsum dolor sit amet...]`, `[Track Title Placeholder]`) so client reviews remain 100% focused on layout, structure, and user flow. Do NOT add notes like `- To be written by Seth` to placeholder tokens.

## 2. Anti-One-Shot Mandate & Hard Alignment Gate (STRICT)
- **Strict Anti-One-Shot Mandate**: NEVER implement multi-file code or edit production HTML/CSS/JS without prior plan approval.
- **Skill Binding**: For any new feature or layout structure, activate and follow the `spec-driven-development` skill.
- **Prohibition of Implicit Approval**: User clarifications, constraint feedback, or follow-up comments (e.g. "make sure to use placeholders", "focus on the creative process") are strictly INPUTS to the proposal. They DO NOT constitute approval to edit site files!
- **Hard Alignment Lock**: An agent must NEVER edit `.html`, `.css`, or `.js` files until the user explicitly states "Approved" or "Proceed". When `.agents/PLAN_LOCK` is active, file modifications to project files are hard-blocked by system safety hooks.
- **Stage 1 (White-Box / Wireframe)**: Present only layout blueprints, wireframe outlines, or draft mockups in chat or plan artifacts.
- **Stage 2 (Human Alignment Gate)**: STOP and wait for explicit user approval before touching project files.
- **Stage 3 (Micro-Batched Implementation)**: No edit may exceed 150 lines of code per turn.

## 3. Tech Stack & Modern Web Standards
- **Tech Stack**: Static HTML5 + Modern CSS + Vanilla JS (zero build overhead, fast load times, effortless hosting).
- **Modern Web Architecture**: Semantic HTML5, CSS Grid / Flexbox layout with fluid scaling, `:user-invalid` / `:user-valid` form validation, responsive mobile-first design (`dvh`, container queries, `scrollbar-gutter: stable`), native Cross-Document View Transitions (`@view-transition { navigation: auto }`).
- Adhere to `modern-web-guidance` and eliminate deprecated CSS/HTML patterns.

## 4. Mandatory Style Guide Adherence (`STYLE_GUIDE.md`)
- **Mandatory Reference**: Whenever designing, proposing, adding, or modifying pages, layouts, UI components, colors, typography, or interactive widgets, agents MUST read and strictly adhere to [`STYLE_GUIDE.md`](STYLE_GUIDE.md).
- **Studio Minimalism**: Enforce intentional visual restraint—prioritize generous whitespace, open layouts, clean typography, and zero decorative clutter (no nested boxes, border fatigue, or badge spam).
- **Design Tokens**: All styles must use existing CSS custom properties (`--bg-page`, `--bg-surface`, `--bg-accent`, `--text-main`, `--text-muted`, `--accent-primary`, `--border-color`, `--border-focus`) defined in `wireframe.css` and documented in `STYLE_GUIDE.md`. Never introduce unvetted hardcoded hex colors or arbitrary dimensions.
- **Component & Pattern Reuse**: Build strictly with documented components (`.section-block`, `.page-header`, `.grid-cards`, `.grid-showcase`, `.roadmap-steps`, `.comparison-container`, `.btn-primary`, `.filter-pill`/`.filter-btn`, `.audio-widget`, `<details class="faq-item">`, `.upload-dropzone-wireframe`).
- **Fluid Typography**: Follow the fluid typographic scale (`clamp()`) and font pairings (`Outfit` headings, `Plus Jakarta Sans` body, `JetBrains Mono` audio/tech metadata).
- **Pre-Completion Checklist**: Verify every new or modified page against Section 9 ("Checklist for Adding New Pages or Sections") of `STYLE_GUIDE.md`.

## 5. Mandatory Verification Protocol
Before declaring any task or wireframe update complete:
1. Ensure valid semantic HTML5 syntax and clean CSS structure.
2. Verify responsive layout across mobile and desktop breakpoints via Chrome DevTools MCP.
3. **Mandatory Visual Confirmation**: Whenever visual capture tools are available (Chrome DevTools MCP screenshots, browser captures), agents MUST capture and present visual confirmation (embedding the screenshot/image or visual artifact) directly in the final report to the user. Never rely solely on textual assertions when visual proof can be provided.
4. Only report task completion if all visual and responsive checks pass cleanly.

## 6. Continuous Autonomous Execution ("Verify & Keep Working")
- **Deterministic Runtime Verification**: Never declare a layout or styling fix complete based on static code checks alone. Always verify rendering dynamically in the browser.
- **Visual Confirmation Delivery**: Whenever a task produces or modifies visual output, capture and present visual confirmation directly to the user upon completion.
- **Autonomous Continuation**: Once a wireframe milestone is verified, DO NOT stop to ask the user to verify what the agent can verify. Update `PROJECT_NOTES.md`, mark the milestone complete, and immediately continue working on the next active milestone until the feature goal is achieved or genuine human alignment is required.

## 7. Living Project Notes Protocol
- **Storage**: Maintain notes in `~/.gemini/notes/AlcoveSite/PROJECT_NOTES.md` and `.agents/PROJECT_NOTES.md`.
- **Automatic Read on Start**: Read `PROJECT_NOTES.md` at session start.
- **Automatic Write on Progress**: Update `PROJECT_NOTES.md` on client decisions, completed milestones, or scope changes.
- **Rule**: Never leave project context purely in chat history; always anchor it into `PROJECT_NOTES.md`.

## 8. Project Charter Synchronization
- **Source of Truth**: Google Doc ID `1pKumu8AMftI42kU4cJL_V7S-5Z1vxSb3Tmt0WJ_V64Q` ([Alcove Site Charter](https://docs.google.com/document/d/1pKumu8AMftI42kU4cJL_V7S-5Z1vxSb3Tmt0WJ_V64Q/edit?usp=sharing)).
- **Sync Protocol**: The local file is `Project Charter.md`. Run `./sync_charter.sh` whenever reviewing project scope or updating requirements to keep Antigravity aligned.

## 9. Ultra-Concise Responses & Targeted Explanations
- **Default Minimal Output**: Keep completion responses concise (1–3 short sentences stating what changed and was verified) whenever results can be directly inspected or tested by the user. Omit conversational fluff.
- **Explain Hard-to-Verify Logic**: Provide a focused explanation when changes involve internal logic, subtle CSS interactions, or timing behavior that cannot be easily verified at a glance.
- **Disclose Unsolicited Changes**: Explicitly highlight and briefly justify any modifications, refactors, dependencies, or side effects that were not specifically requested by the user.
