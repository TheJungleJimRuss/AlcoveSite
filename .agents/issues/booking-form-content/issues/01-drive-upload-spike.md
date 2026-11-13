# 01: Drive upload spike

**What to build:** Find out, using a throwaway page, whether a browser can upload a large Demo straight to Drive through a resumable session opened by the Apps Script, before anything else is built (ADR 0002).

**Blocked by:** None (can start immediately)

**Status:** done (2026-11-12), spike files still to delete

- [x] A temporary script function opens a Drive resumable upload session with the page's origin set, then returns the upload URL
- [x] From a local origin, a 100MB file uploads in 8MB chunks with no CORS error and appears in Drive
- [x] Abort mid-upload, query the offset (`Content-Range: bytes */size`) and resume to completion
- [x] Write the findings (works / blockers, required OAuth scope, quirks) under `## Comments`; if it fails, stop and take the upload-size decision back to the user
- [x] Delete the throwaway page and function, or clearly mark them as spike-only (marked spike-only)

## Comments

- Spike files prepared (`spike/`, `backend/spike-drive-upload.gs`); awaiting a manual run in a Google account. See `spike/README.md`.
- 2026-11-12: Spike PASSED. From http://localhost:8765 (Chromium in the Claude pane), a 100MB file went browser to Drive through a script-created resumable session: `startUpload` returned HTTP 200 with the session URL in ~1.7s; 13 PUTs of 8MB (308, last 200), ~1.1-2.1s each (~5MB/s here); no CORS error; `DONE` returned the Drive file id.
  - Abort + resume worked: aborted mid-chunk at 41.9MB, the status query (`bytes */size`) returned 308 in 129ms with a readable `Range` (server had 50331648 bytes), resumed from there and finished with a single complete file. The session survived the abort.
  - OAuth: the manifest used `script.external_request` + full `drive`. Narrower `drive.file` alone was NOT tested; check before the real build if a smaller consent screen matters. Consent screen wording was not seen (Google refuses its consent page in the in-app browser; the user approved it in their own Chrome). Re-authorization at redeploy is expected.
  - Quirks: `Origin` header passed from Apps Script is what makes Drive allow the browser PUTs. Spike files are named spike-100MB.mp4 in My Drive root (two copies). Drive file ids: 1wN6XNTIyt7mHavsJ6iSacyT7SYz2r-Bo, 1BkYy7n02a6-Ds1qq89Ymt3s3EfvGqbdj.
  - Unblocks 03 and 05. Cleanup still to do (README step 10): delete `spike/`, `backend/spike-drive-upload.gs`, the throwaway Apps Script project and deployment, and the two Drive test files (then empty trash).
