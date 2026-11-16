# Large upload test (manual, not yet run)

Status: pending the user's OK. Nothing here has been run; all automated tests mock api.github.com.

**Why:** Admin media uploads each file as base64 inside one JSON request to the GitHub contents API. The API allows files up to 100 MB, but a 90 MB file becomes about 120 MB once encoded, so large uploads may be rejected or time out (worse on mobile data). The cap is `MAX_MEDIA_BYTES` at the top of `admin.js` (90 MB). See ADR 0006.

## Setup

1. Use a throwaway fine-grained token for a test repo, or for this repo limited to Contents read/write. Do not reuse Seth's token. Delete it afterwards.
2. Use a throwaway branch or file location so nothing real changes: copy the site to a test repo, or on this repo use a test branch and point the `content` branch name at it (or delete the test files and branch afterwards). Prefer a scratch repo, because repo history keeps large files forever.
3. Make test files (any bytes are fine for a size test): `mkfile -n 20m test-20.mp3`, `mkfile -n 50m test-50.mp3`, `mkfile -n 90m test-90.mp3`. For a realistic check, also use one real 20 MB phone video.

## Procedure

1. Serve the site (`python3 -m http.server`), open `work.html?admin`, paste the test token, turn Edit mode on.
2. For each of 20, 50 and 90 MB: add a Song (or Replace the A/B memo) with that file, press Save, and watch the Admin panel.
3. Record for each size and for desktop and phone: success or failure, the HTTP status and GitHub's message (browser Network tab, request `PUT /repos/.../contents/media/...`), time taken, and whether progress and the failure message named the file.
4. After a success, check the file is on the branch, the site plays it, and that replacing it afterwards deletes the old one.
5. Delete the test files, the throwaway branch and the token.

## Decide

- All three succeed on desktop and phone: keep 90 MB, or set the cap to the largest size that passed.
- A size fails: lower `MAX_MEDIA_BYTES` to the largest size that passed with margin (for example 50 MB: `50 * 1024 * 1024`), update the "90 MB" wording in `docs/admin-token-setup.md`, and update the size-limit assertions in `tests/admin-check.mjs` (they read the constant from `window.AlcoveAdmin`).
- Even 20-50 MB is unreliable: switch uploads to the Git Data API (create a blob with `POST /git/blobs`, then a tree, commit and ref update). It accepts larger payloads than the contents API but needs more requests; record the decision in ADR 0006.
- Record the result in `.agents/PROJECT_NOTES.md` and ADR 0006.
