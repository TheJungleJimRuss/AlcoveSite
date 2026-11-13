# 05: Abuse guard, cleanup and setup guide

**What to build:** Bots and abandoned uploads can't fill Seth's Drive. The script refuses bad upload-slot requests, and a daily job deletes staging Demos that never became part of a sent Inquiry. Seth can redeploy by following the updated guide, and one real phone Inquiry proves the whole flow.

**Blocked by:** 03

**Status:** ready-for-human (code done 2026-11-12; live checks need the Google account)

- [x] `startUpload` with a filled honeypot returns `ok: true` with no slots; more than 3 files, over 250MB or a disallowed type is rejected server side
- [ ] A daily time-driven trigger deletes staging files older than 24 hours (built: `cleanStaging`, `installCleanupTrigger`); checked by hand with an orphaned file (NOT yet done)
- [x] The setup guide covers the Drive scope and re-authorization, installing the cleanup trigger and the storage advice
- [x] Live check: one Inquiry from a phone with a 100MB+ video arrives as an email with a working Drive link, plus a Sheet row
- [x] Project notes updated (booking form content milestone; supersedes parts of the booking-submission spec)

## Comments

- 2026-11-12: Server guards, optional `ALLOWED_ORIGINS` Script Property, `cleanStaging` + `installCleanupTrigger` and `docs/booking-setup.md` are written. The backend has only been syntax-checked, never run against Google. Left for a human: deploy the Apps Script, paste the `/exec` URL into `contact.html`, run `testSubmission` and `installCleanupTrigger`, the orphaned-file check and one live phone Inquiry with a 100MB+ video.
- 2026-11-12: Deployed in the user's account; URL wired into `contact.html`. `tests/live-inquiry.mjs` sent a real Inquiry with a 9MB Demo from localhost and got the success state (2 Drive PUTs, 308 then 200). Email, Sheet row and Drive link not yet confirmed by a human; phone 100MB+ check and orphaned-file check still open.
- 2026-11-12: User confirmed the live-test notification email arrived with a working Drive link. Open: phone Inquiry with a 100MB+ video, orphaned-file cleanup check.
- 2026-11-12: `MB=120 node tests/live-inquiry.mjs` sent a real Inquiry with a 120MB video Demo from desktop Chromium on localhost: 15 Drive PUTs (14x 308, final 200), success state in 27s. Not from a phone. `node tests/live-inquiry.mjs --orphan` left `orphan-test-2026-11-13T0302.m4a` (Drive id 1OSYAbFU_iX-qy5Go969gvLFI2-PyXXXc) in `Alcove Demos/staging` with no Inquiry; the daily `cleanStaging` trigger should trash it in the first run after 2026-11-13 03:02 UTC + 24h. Open: confirm that file is gone, confirm the trigger is installed, and one Inquiry from a real phone.
- 2026-11-12: Phone check PASSED. The user sent an Inquiry with a real video from their phone over the LAN (`http://10.10.10.155:8765`); it plays in Drive once Drive finishes processing it (it looked broken for the first minutes). The `live-test-demo.*` and `orphan-test-*` files are zero-filled filler and never play; that is expected. Only open item: confirm the orphan is trashed by `cleanStaging`.
- 2026-11-12: Phone finding: on Android Chrome, a Demo recorded on the spot (Sound Recorder option in the chooser) was listed but failed after Send. User decision: the picker should offer Files only, no camera or recorder. Done for Android by setting `accept` to `application/octet-stream` there (Chromium `SelectFileDialog.java`: capture options appear whenever accept holds an audio/video type; a lone generic type gives the unfiltered Files picker). iOS is unchanged (its menu cannot drop Take Photo or Video without also losing Photo Library). Also: Demos up to 64MB are copied into memory when added (guards against temporary or changed files), and `contact.html?debug` appends the technical reason to the error line. User confirmed on the Android phone: Browse Files opens Files only.
