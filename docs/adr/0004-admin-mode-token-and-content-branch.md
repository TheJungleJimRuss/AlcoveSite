# 0004: Admin mode: the token is the gate, saves go to a Content branch as JSON

Status: accepted (2026-11-13)

Seth is not technical but wants to change wording and the default look himself. The site is static, hosted on GitHub Pages, with no server of ours.

**Decision:** Admin mode runs entirely in the browser. A GitHub fine-grained token (this repo only, Contents read/write) is pasted once and kept in `localStorage`; Save calls the GitHub contents API directly and commits one `content.json` (text by key, plus theme defaults) to a `content` branch. The developer reviews and merges it to main, and Pages publishes. Visitors get `content.json` through a small blocking loader, so saved text and defaults apply before first paint; a missing or malformed file changes nothing.

- **The token is the gate, not the UI.** Anyone can reach the unlock prompt with `?admin` or read `admin.js`; none of it grants write access. Only a valid token can write, and GitHub enforces that. The theme toolbar has no public entry point (dev-only on localhost); hiding admin UI is cosmetic.
- **Content branch plus merge** instead of committing to main: nothing goes live without the developer's review, a bad edit is a revert, and git history is the audit trail. Cost: Seth's changes are not live until a merge, and the developer must do it.
- **JSON overlay vs Apps Script:** we rejected an Apps Script (or other hosted) backend that stores content, as the booking form does (ADR 0002). It would need its own auth, a second place content lives, and Seth to own another deployment. The overlay keeps content in the repo, free and versioned. Cost: the loader reads the file with a synchronous XHR in `<head>` (to avoid a flash of old text), edits are plain text only, and a Save needs Seth to hold a GitHub account and a token.

**Consequences:** the token sits in `localStorage` on the editor's device, so a script injected into the site could read it; the site loads no third-party scripts and renders content with `textContent` only, which is the mitigation. The token is sent only to api.github.com. Sign-out removes it and any unsaved drafts. Booking form copy stays out of Site Content (ADR 0002). Spec: `.agents/issues/admin-mode/spec.md`.
