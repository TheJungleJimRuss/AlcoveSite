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
- **Prohibition of Implicit Approval**: User clarifications, constraint feedback, or follow-up comments (e.g. "make sure to use placeholders", "focus on the creative process") are strictly INPUTS to the proposal. They DO NOT constitute approval to edit site files!
- **Hard Alignment Lock**: An agent must NEVER edit `.html`, `.css`, or `.js` files until the user explicitly states "Approved" or "Proceed". When `.agents/PLAN_LOCK` is active, file modifications to project files are hard-blocked by system safety hooks.
- **Stage 1 (White-Box / Wireframe)**: Present only layout blueprints, wireframe outlines, or draft mockups in chat or plan artifacts.
- **Stage 2 (Human Alignment Gate)**: STOP and wait for explicit user approval before touching project files.
- **Micro-Batching Cap**: No edit may exceed 150 lines.

## 3. Living Project Notes Protocol (`.agents/PROJECT_NOTES.md`)
- **Automatic Read on Start**: Read `.agents/PROJECT_NOTES.md` at session start.
- **Automatic Write on Progress**: Update `.agents/PROJECT_NOTES.md` on client decisions or scope changes.

## 4. Project Charter Synchronization
- **Source of Truth**: Google Doc ID `1pKumu8AMftI42kU4cJL_V7S-5Z1vxSb3Tmt0WJ_V64Q` ([Alcove Site Charter](https://docs.google.com/document/d/1pKumu8AMftI42kU4cJL_V7S-5Z1vxSb3Tmt0WJ_V64Q/edit?usp=sharing)).
- **Sync Protocol**: The local file is `Project Charter.md`. Run `./sync_charter.sh` whenever reviewing project scope or updating requirements to keep Antigravity aligned.
