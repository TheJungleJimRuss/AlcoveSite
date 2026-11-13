# 04: Resilient uploads

**What to build:** On shaky Wi-Fi, an interrupted Demo upload resumes on its own. If retries run out, everything the artist typed stays and a "Try again" button finishes the upload. Leaving the page mid-upload brings up a browser warning.

**Blocked by:** 03

**Status:** done (2026-11-12)

- [x] A network error or 5xx on a chunk triggers an offset query and resumes from the reported byte, with a few backoff retries
- [x] Retries running out show "Try again", with fields and the file list intact; pressing it reuses the same sessions and completes
- [x] A `submitInquiry` that fails (`ok: false` or 500) keeps the fields and re-enables sending without re-uploading
- [x] `beforeunload` warning only while uploading or sending
- [x] Browser test covers a mid-upload abort that resumes without re-sending earlier chunks, retries running out followed by Try again, and a failed submit

## Comments

- 2026-11-12: Built in `booking-form.js` (offset query + resume, 1s/3s/7s backoff, Try again reuses sessions, `beforeunload` only while busy). Covered by `tests/booking-check.mjs` section 5b; `npm run check` passes. Backend `submitInquiry_` is now idempotent per `inquiryId` (script cache + lock) and emails before moving files, so a retry after a lost response neither fails nor notifies twice.
