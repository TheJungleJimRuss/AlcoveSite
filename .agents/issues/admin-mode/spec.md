Status: ready-for-agent

# Admin mode: edit text and theme defaults

## Problem Statement

Seth (and the developer) can only change the site's wording or its default look by editing HTML/CSS and redeploying. Seth is not technical, so every copy tweak or theme decision goes through the developer. The public Theme Preview Toolbar lets any visitor preview themes, but nothing makes a choice stick for everyone.

## Solution

An **Admin mode** built into the live site. An editor pastes a GitHub fine-grained token once; the site then lets them click any marked text to edit it in place and pick the **Site Defaults** (palette, font, texture, Surface, Gradient, hero grain; Tape and Cards once reconciled) in a panel. Save commits one content file to the **Content branch**; the developer reviews and merges to main and GitHub Pages publishes. Visitors always get the saved Site Content and Site Defaults on page load, and no longer see the theme toolbar.

## User Stories

1. As Seth, I want to unlock Admin mode by pasting a token once, so that I can edit without touching code.
2. As Seth, I want my token remembered on my device, so that I don't paste it every visit.
3. As Seth, I want to sign out of Admin mode and forget the token, so that a shared computer is safe.
4. As Seth, I want editable text to be visibly marked while editing, so that I know what I can change.
5. As Seth, I want to click a heading, paragraph or caption and type the new words in place, so that I see exactly how it will look.
6. As Seth, I want edits to be plain text only, so that I can't break the layout.
7. As Seth, I want to see which text I've changed and revert one item to the published wording, so that mistakes are cheap.
8. As Seth, I want a Save button that tells me how many changes it will save, so that I know what happens.
9. As Seth, I want a clear success message after Save, and a note that changes go live after the developer merges, so that I'm not confused why the site hasn't changed.
10. As Seth, I want a clear error if the token is wrong, expired or lacks permission, so that I know what to fix.
11. As Seth, I want unsaved edits to survive an accidental reload, so that I don't lose work.
12. As Seth, I want to be warned before leaving with unsaved changes, so that I don't lose them.
13. As Seth, I want to pick the palette, font, Surface, Tape, Cards, Gradient and Texture defaults in one panel with a live preview, so that I can judge the look before saving.
14. As Seth, I want the panel to reuse the toolbar's current options, so that nothing I know disappears.
15. As Seth, I want admin to work on every page (Home, Work, About, Contact), so that I can edit where I am.
16. As Seth, I want Admin mode to work on a phone, so that I can fix a typo away from my desk.
17. As the developer, I want Save to commit to a `content` branch, so that I review before anything goes live.
18. As the developer, I want the content branch created automatically from main if missing, so that first use just works.
19. As the developer, I want one content file holding all text and defaults, so that diffs are small and readable.
20. As the developer, I want Save to merge with the latest file on the branch, so that two editors don't silently overwrite each other.
21. As the developer, I want a conflict message when the branch changed while editing, with a reload-and-reapply path, so that nothing is lost.
22. As the developer, I want admin-mode code to load only when unlocked, so that visitors pay no cost.
23. As a visitor, I want saved text and defaults applied before first paint, so that I never see text flash from old to new.
24. As a visitor, I want the site to work normally if the content file is missing or malformed, so that a bad save can't break the site.
25. As a visitor, I want my own accessibility preferences (reduced motion, contrast) to keep overriding defaults, so that nothing regresses.
26. As a visitor, I don't see the theme toolbar or any admin UI, so that the site feels finished.
27. As a screen-reader user, I want edited text to keep its heading levels and landmarks, so that structure stays intact.
28. As the developer, I want booking form labels, Session Type names and dropdown options excluded from Site Content, so that the booking backend and form validation stay consistent.
29. As the developer, I want the token never sent anywhere but api.github.com and never written into content or URLs, so that it can't leak.
30. As the developer, I want each editable element identified by a stable key, so that content survives layout changes.

## Implementation Decisions

- **Content file**: one JSON file in the repo holding `text` (key to string) and `defaults` (option name to value), plus a schema version. Missing keys fall back to the HTML's built-in text and `wireframe.css` defaults, so the file only stores differences.
- **Editable elements** carry a stable key attribute in the HTML. The authored HTML text stays the fallback and the no-JS/crawler version. Plain text only; line breaks not supported in v1.
- **Applying content**: a small inline loader in each page head reads the content file and applies text and defaults before first paint. Defaults apply through the existing `data-*` attributes and tokens the toolbar already uses. Failure to load or parse is silent and falls back to authored values.
- **Theme toolbar**: hidden from visitors. Its option definitions are reused by the admin panel instead of being duplicated. The toolbar's per-visitor `localStorage` and URL-param preview may remain for admin preview only.
- **Unlock**: pasting a token (and a `?admin` entry point) enables Admin mode. The token lives in `localStorage` on the editor's device; sign-out deletes it. The UI toggle is not a security boundary; the token is. No token, no save.
- **Saving**: GitHub contents API against a fixed owner/repo (TheJungleJimRuss/AlcoveSite). Save reads the content file from the Content branch (creating the branch from main if absent), applies the editor's changes on top, and writes with the file's SHA. A SHA mismatch is a conflict surfaced to the user; no silent overwrite.
- **Publishing**: the developer merges the Content branch into main; GitHub Pages republishes. Admin mode loads the Content branch's file (not the published one) while unlocked, so editors see their saved-but-unmerged work.
- **Excluded**: booking form copy and Session Type labels, which tie to the backend (ADR 0002).
- **Draft safety**: unsaved edits persist in `localStorage` per page and are cleared on successful Save; beforeunload warning while dirty.
- **Security**: fine-grained token scoped to this one repo with contents write; token only ever sent to api.github.com; content rendered with `textContent` only (never `innerHTML`), so editors cannot inject markup or script.
- **Docs**: add an ADR for the "token is the gate, content branch, JSON overlay" decision (hard to reverse, surprising, real trade-off against Apps Script). Add a short setup note to `docs/` on creating Seth's token. Update GLOSSARY.md (done: Admin mode, Site Content, Site Defaults, Content branch) and PROJECT_NOTES.

## Testing Decisions

- A good test drives the page as a user does and asserts external behavior: what is on screen and which GitHub requests are made; never internal functions.
- One seam: a Playwright browser test, `tests/admin-check.mjs`, added to `npm run check`, with `api.github.com` mocked. Cases: no admin UI without a token; unlock; edit and save sends one contents PUT with correct JSON, branch and SHA; reload applies saved text and defaults without flash; revert; conflict (SHA mismatch) message; bad token message; malformed content file falls back; booking form excluded; token never appears in any non-GitHub request or URL; reduced-motion preferences still win.
- Prior art: `tests/booking-check.mjs` (local server, mocked network), `tests/texture-check.mjs`. Also run `tests/contrast-check.mjs` since defaults change palettes.

## Out of Scope

- Editing images, layout, links, or audio tracks and their metadata on Work.
- Rich text, per-visitor accounts, roles, edit history UI (git history serves).
- Editing booking form questions, Session Types, or backend settings.
- Custom palette colours beyond the existing options.
- A custom preview deployment of the Content branch.

## Further Notes

- This working folder is not a git repo (copied from `~/Downloads/AlcoveSite`, see PROJECT_NOTES); the real repo must be reconciled before the first live Save.
- Seth needs a GitHub account with write access to the repo before Admin mode can save.
- The live site must be served over HTTPS (GitHub Pages is) so the token is not exposed in transit.
