# 0004: Admin mode: the token is the gate, saves go to a Content branch as JSON

Status: accepted (2026-11-13)

Seth is not technical but wants to change wording and the default look himself. The site is static, hosted on GitHub Pages, with no server of ours.

**Decision:** Admin mode runs entirely in the browser. A GitHub fine-grained token (this repo only, Contents read/write) is pasted once and kept in `localStorage`; Save calls the GitHub contents API directly and commits one `content.json` (text by key, plus theme defaults) to a `content` branch. (Amended 2026-11-13: Pages deploys from the `content` branch, so a Save goes live without a merge; see the amendment below.) Visitors get `content.json` through a small blocking loader, so saved text and defaults apply before first paint; a missing or malformed file changes nothing.

- **The token is the gate, not the UI.** Anyone can reach the unlock prompt with `?admin` or read `admin.js`; none of it grants write access. Only a valid token can write, and GitHub enforces that. The theme toolbar has no public entry point (dev-only on localhost); hiding admin UI is cosmetic.
- **Content branch** instead of committing to main: a bad edit is a revert, and git history is the audit trail. As first written, nothing went live until the developer merged it; that gate no longer applies (see the amendment below).
- **JSON overlay vs Apps Script:** we rejected an Apps Script (or other hosted) backend that stores content, as the booking form does (ADR 0002). It would need its own auth, a second place content lives, and Seth to own another deployment. The overlay keeps content in the repo, free and versioned. Cost: the loader reads the file with a synchronous XHR in `<head>` (to avoid a flash of old text), edits are plain text only, and a Save needs Seth to hold a GitHub account and a token.

**Consequences:** the token sits in `localStorage` on the editor's device, so a script injected into the site could read it; the site loads no third-party scripts and renders content with `textContent` only, which is the mitigation. The token is sent only to api.github.com. Sign-out removes it and any unsaved drafts. Booking form copy stays out of Site Content (ADR 0002). Spec: `.agents/issues/admin-mode/spec.md`.

**Amendment (2026-11-13):** Pages deploys from the `content` branch, so a Save goes live in a minute or two without a merge; the "developer merges to publish" review gate is gone unless Pages is pointed back at main. Media (photos, video, audio) and the Work song list are now editable too, which replaces the earlier "images and audio out of scope" line; that is covered by ADR 0006 and `.agents/issues/admin-media/spec.md`.
