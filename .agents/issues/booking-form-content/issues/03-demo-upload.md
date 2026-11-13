# 03: Demo upload, happy path

**What to build:** An artist must attach 1 to 3 Demos (common audio or video, up to 250MB each), which upload straight to Seth's Drive with a progress bar. The Inquiry is sent once they've all landed, and Seth's email links each Demo in its own per-Inquiry folder.

**Blocked by:** 01, 02

**Status:** done

- [x] Drag-and-drop and Browse Files add Demos; each one shows its name and size, with a keyboard-reachable remove button
- [x] Wrong type, over 250MB, a fourth file and no Demo each show a worded error and block sending
- [x] `startUpload` returns an `inquiryId` and an upload URL per file; files go up as chunked PUTs with combined progress on a hairline `progress` bar; the status is announced
- [x] `submitInquiry` carries the file ids; the backend checks that they're tagged staging files, moves them into an artist-and-date folder, and links each one (name and size) in the email and Sheet
- [x] The button stays disabled throughout; success shows the thank-you and resets the form
- [x] Browser test mocks Apps Script and the Drive URLs: request order, `Content-Range` headers, final payload; no overflow or console errors at three widths

## Comments

2026-11-12: Built. `contact.html` Demo field (dropzone, Browse Files button, list with Remove buttons, hairline `progress`); `booking-form.js` validates, then runs startUpload, 8MB chunked XHR PUTs (combined progress, announced in 10% steps) and submitInquiry with `inquiryId` + `fileIds`; `backend/booking-apps-script.gs` gained `startUpload_`, staging/root folders, tag verification, per-Inquiry folder move, and Demo links in email and Sheet; `testSubmission` now runs the whole flow. Decisions: the page sends its own `origin` in `startUpload` because Apps Script cannot read request headers; the form is `novalidate` so the Demo check runs with the field checks; any failure re-enables the button (resume and Try again are ticket 04). Backend not exercised against live Google (manual run still needed). `npm run check` and `contrast-check` pass.
