Status: needs-approval

# Admin media: change photos, videos and audio, and manage Songs

## Problem Statement

Seth can now edit text and look defaults in Admin mode, but every photo, video and audio file is still a fixed file that only the developer can swap, and the Work page's song list is hand-written HTML. To put a new song on the site, change a studio photo or replace the session video he has to ask the developer.

## Solution

In Edit mode, every **Media slot** (the studio photos, hero photo, session video and its poster, the A/B deck's memo and master clips, the About portrait) gets a "Replace" control. The Work page's **Songs** become a list Seth can add to, remove and reorder, each with a title and an audio file; the genre filter is retired. Chosen files are staged as drafts with the text edits, and the one Save uploads the files and `content.json` together to the **Content branch**. Replaced or removed **Media files** are deleted unless something else still uses them. Pages deploys from the `content` branch, so the change is live once Pages redeploys.

## User Stories

1. As Seth, I want a Replace control on every photo while Edit mode is on, so that I can swap pictures without code.
2. As Seth, I want to choose a photo from my phone or computer, so that I use pictures I already have.
3. As Seth, I want big photos shrunk automatically, so that the site stays fast and uploads succeed on mobile data.
4. As Seth, I want to see the new photo in place before saving, so that I can judge how it looks and crops.
5. As Seth, I want to replace the session video and its poster image, so that the Work page shows my own footage.
6. As Seth, I want to replace the A/B deck's voice memo and finished master separately, so that the comparison uses real clips.
7. As Seth, I want to replace the About portrait, so that visitors see me.
8. As Seth, I want to add a song by giving a title and choosing an audio file, so that new work appears on Work.
9. As Seth, I want to remove a song, so that old or unwanted work comes off the site.
10. As Seth, I want to move a song up or down with buttons, so that I control order, including on a phone.
11. As Seth, I want to rename a song in place, so that titles stay right.
12. As Seth, I want a limit of 20 songs with a clear message at the limit, so that I know why I can't add more.
13. As Seth, I want a clear error when a file is the wrong type or over the size limit, so that I know what to fix before wasting an upload.
14. As Seth, I want staged media to survive an accidental reload, so that I don't re-pick files.
15. As Seth, I want one Save to cover text, defaults and media, with a count of what will be saved, so that nothing is half-done.
16. As Seth, I want upload progress and a clear failure message that names the file, so that I can retry.
17. As Seth, I want to revert a staged replacement or a removed song before saving, so that mistakes are cheap.
18. As Seth, I want to be warned before leaving with staged media, so that I don't lose it.
19. As Seth, I want my changes to go live without a manual merge, with a note that Pages takes a minute or two to redeploy, so that I'm not confused when it isn't instant.
20. As a visitor, I want the player to play the new songs in the saved order, so that the site shows current work.
21. As a visitor, I want the site to work if the song data is missing or malformed, so that a bad save can't break the page.
22. As a visitor, I want no genre tabs or genre wording, so that the Work page is a plain song list.
23. As a screen-reader user, I want replaced photos to keep meaningful alt text, so that accessibility doesn't regress.
24. As the developer, I want a replaced or removed file deleted from the repo unless another slot or song still uses it, so that the repo doesn't fill with orphans and nothing breaks.
25. As the developer, I want new files named safely and uniquely, so that caches don't serve the old file and names can't collide or traverse paths.
26. As the developer, I want Save to use the existing conflict checks against the loaded base, so that two editors can't silently overwrite each other's media or songs.
27. As the developer, I want the file size cap in one place, so that I can lower it if GitHub rejects large uploads.
28. As the developer, I want the booking form and its Demo upload untouched, so that the booking backend stays consistent (ADR 0002).
29. As the developer, I want the authored HTML to remain the fallback for songs and media, so that crawlers, no-JS visitors and a broken content file still see a working Work page.
30. As the developer, I want the token still sent only to api.github.com, so that nothing leaks.
31. As Seth, I want the A/B deck, tape player and sleeves to keep working after I change files, so that I don't break anything by editing.

## Implementation Decisions

- **Scope**: replace any Media slot's file; add, remove, reorder and rename Songs. Genres are retired: the Work genre tabs, genre labels and genre filtering are removed, and the Crate/Sleeve glossary wording drops genre. The glossary already defines Media slot, Song and Media file.
- **Media slots** are named in the page markup by stable keys, like text keys. Each slot's saved file path lives in the content file next to the text; the page applies it before first paint through the same blocking loader, falling back to the authored path if missing or malformed.
- **Songs** live in the content file as an ordered list (title, audio file path). The Work page builds the player's song rows from it; the authored four-song HTML is the fallback. A song's accessible name and the "now playing" label follow its title.
- **A/B deck**: memo and master are two independent Media slots, no longer tied to a song.
- **Video**: the session video and its poster are two slots.
- **Limits and checks**: file size cap about 90 MB, kept as one constant; allowed types: common web image formats for photos, common audio formats (MP3, M4A, WAV, OGG, WebM audio) and MP4/WebM video. Wrong type or oversize is rejected before staging. Maximum 20 Songs. Because uploads go base64 in a JSON request, the real GitHub limit may be lower than the cap; the cap is expected to be tuned after a real upload test (see Further Notes).
- **Photo processing**: photos are resized in the browser to about 2000 px on the long edge and re-encoded before staging; audio and video are uploaded unchanged.
- **Staging**: chosen files are held in the browser (not `localStorage`, which is too small) as drafts with the text and defaults drafts; a preview shows the new file immediately. Drafts survive reload where the browser allows; otherwise the editor is told to re-pick.
- **Saving**: one Save writes all new Media files and the content file to the Content branch through the existing GitHub contents flow, reusing the base comparison and conflict handling from the Admin mode spec: if the branch changed for a slot or song being saved, stop with the conflict message and keep drafts. Uploads are sequential with progress; if one fails, the Save stops, reports the failed file, and the content file is written last, so the live content never points at a missing file.
- **Cleanup**: after a successful Save, files that were replaced or whose song was removed are deleted from the repo only if no remaining slot, song or page markup references them; shared files are kept.
- **File naming**: new files get a sanitized, unique name (slug plus short content hash) under the existing media folders, so the browser cache cannot serve the old file and paths cannot be chosen by the editor.
- **Publishing**: Pages deploys from the Content branch, so a successful Save goes live when Pages redeploys. Admin copy and docs say "live in a minute or two", replacing the earlier "after the developer merges" wording, and ADR 0004's publish note is amended.
- **Security**: token only to api.github.com; file names and titles are rendered with `textContent` and never as markup; no third-party scripts added.
- **Excluded**: booking form and its Demo upload; textures and the logo (developer-managed); audio/video metadata such as duration (read from the file by the player).

## Testing Decisions

- A good test drives the page as a user does and asserts what is on screen and which GitHub requests are made, not internal functions.
- One seam, the existing Playwright test `tests/admin-check.mjs` with `api.github.com` mocked, extended with small fixture files. Cases: Replace control appears only with Edit mode on; replacing a photo shows a preview, and Save sends the file PUT then the content PUT, in that order, with correct branch and paths; reload shows the new photo; oversize and wrong-type files rejected with no request; photo resized below the pixel cap; add, rename, reorder (up/down) and remove a Song, with the player using the new order and the genre tabs gone; the 20-song cap; A/B memo and master replaced independently; removed or replaced file deleted only when unreferenced, and a shared file kept; a failed file upload stops Save and the content file is not written; conflict on a staged slot keeps drafts; malformed song data falls back to authored HTML; booking form untouched; token appears in no non-GitHub request.
- Prior art: `tests/admin-check.mjs` (mocked GitHub, conflicts), `tests/ab-check.mjs`, `tests/browser-check.mjs`. Also run `npm run check` and `node tests/contrast-check.mjs`.

## Out of Scope

- Editing textures, the logo, or any audio metadata.
- Genres, tags or filters in any form; adding new media types beyond photo, video and audio.
- Cropping, rotation or editing tools; transcoding audio or video in the browser.
- Image alt-text editing UI beyond keeping existing alt text.
- Version history UI, a media library, or recovering deleted files (git history serves).
- External media hosting (YouTube, SoundCloud, Drive).
- Direct editing of the booking form's Demo upload.

## Further Notes

- GitHub's contents API officially accepts files up to 100 MB, but a 90 MB file becomes about 120 MB once base64-encoded in the JSON request, so large uploads may be rejected or time out, especially on mobile. Plan: make the cap a single constant, test one real large upload before relying on it, and lower the cap (or move to the Git Data API) if needed. Repo size should stay under about 1 GB; deleting replaced files and the 20-song cap help.
- This folder is not a git repo; the real repo was updated by copying files. Reconcile before Save is used for media.
- Another contributor is changing the Work page design (Record player, Crate, Sleeves); build against whatever Work markup is current when implementing.
- Depends on Admin mode (`.agents/issues/admin-mode/spec.md`, ADR 0004) and amends its "out of scope: images and audio" and "developer merges to publish" statements.
