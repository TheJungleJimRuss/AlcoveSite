Status: ready-for-agent

# Booking form: required Demo uploads, phone, Session Type and "Anything else?"

## Problem Statement

Seth can't size up a new artist from the current Contact form. Phone is optional, a Demo is optional and audio-only, capped at 20MB, and the form asks for project scope, a sound-inspiration link and dates, which aren't what he needs before he replies. He wants every Inquiry to include a way to text the artist and an actual recording, often a phone video, so he can hear the artist before he answers. Phone videos are routinely 50–250MB, far beyond what the current Apps Script backend can take in one request. The audience is teens and first-time musicians, so the form has to stay short and calm, and a failed upload on shaky phone Wi-Fi must not wipe out what they typed.

## Solution

The Contact page form asks only for name, email, phone, Experience Level, Session Type, at least one Demo (up to 3 audio or video files, 250MB each) and an optional "Anything else?" box. When the artist presses send, each Demo uploads straight from the browser to Seth's Google Drive with a progress bar. A dropped connection resumes on its own. If the upload still fails, everything the artist typed stays put and a "Try again" button picks up where it stopped. Only once every Demo has landed is the Inquiry sent. Seth then gets an email, a Sheet row and an optional text with the phone number, Session Type and a Drive link to each Demo. With JavaScript off, the page says online booking needs JavaScript and points to Seth's direct channels. See ADR 0002.

## User Stories

1. As a first-time artist, I want a short form with only a handful of questions, so that booking doesn't feel like an application.
2. As an artist, I want the easy questions (name, email, phone) first, so that I'm warmed up before the upload.
3. As an artist, I want to enter my phone number however I normally write it (spaces, dashes, +1), so that the form doesn't fight me.
4. As an artist, I want to be told in words when my phone number looks too short, so that Seth can actually reach me.
5. As an artist, I want to pick my Experience Level from a simple list, so that Seth knows how much hand-holding I need.
6. As an artist, I want to pick a Session Type from a simple list, so that Seth knows what I'm asking for.
7. As an artist, I want to attach a voice memo from my phone as a Demo, so that a rough idea is enough to book.
8. As an artist, I want to attach a phone video as a Demo, so that Seth can see and hear my band play.
9. As a band, I want to attach up to 3 Demos, so that Seth can hear more than one song.
10. As an artist, I want to drag files onto the dropzone or tap Browse Files, so that attaching works on a computer and a phone.
11. As an artist, I want to see each attached file's name and size, with a way to remove it, so that I know I picked the right ones.
12. As an artist, I want to be told plainly when a file is over 250MB, isn't a supported audio or video type, or is one too many, so that I can fix it before sending.
13. As an artist who tries to send without a Demo, I want a clear message that a recording is required (and that a phone voice memo is fine), so that I know what to do.
14. As an artist, I want an optional "Anything else?" box, so that I can add context without being forced to write.
15. As an artist, I want a progress bar while my Demos upload, so that I know a big video is still moving.
16. As an artist on shaky Wi-Fi, I want an interrupted upload to resume by itself, so that a blip doesn't make me start over.
17. As an artist whose upload keeps failing, I want everything I typed kept and a "Try again" button, so that I don't have to refill the form.
18. As an artist, I want the send button disabled while uploading and sending, so that I can't send a duplicate Inquiry.
19. As an artist, I want a thank-you saying when Seth will reply, once everything is through, so that I know it worked.
20. As an artist, I want the form cleared after a successful send, so that it's obvious the Inquiry went.
21. As an artist leaving mid-upload, I want the browser to warn me before I close the page, so that I don't lose the upload by accident.
22. As a screen-reader user, I want field errors linked to their fields and upload progress and results announced, so that I hear what's happening.
23. As a keyboard user, I want the dropzone, remove-file buttons and every control reachable with a visible focus ring, so that I can book without a mouse.
24. As a visitor with JavaScript off, I want a notice pointing me to email or text Seth directly, so that I can still reach him.
25. As a visitor, I want the form and its messages to match the unboxed Analog Studio style in both palettes, light and dark, so that the page feels consistent.
26. As Seth, I want every Inquiry email to show name, email, phone, Experience Level, Session Type, "Anything else?" and a Drive link per Demo, so that I can size up the artist at a glance.
27. As Seth, I want replying to the email to go to the artist, so that I can answer in one step.
28. As Seth, I want the text alert to include the artist's name and Session Type, so that I can decide quickly whether to call back.
29. As Seth, I want each Inquiry's Demos in their own Drive folder named after the artist and date, so that I can find recordings later.
30. As Seth, I want every Inquiry logged in my Sheet with the new columns, so that my history stays complete.
31. As Seth, I want the script to refuse upload slots for requests that trip the honeypot or exceed 3 files / 250MB, so that bots can't fill my Drive.
32. As Seth, I want uploads that never became part of a sent Inquiry deleted automatically after a day, so that abandoned or abusive uploads don't eat my storage.
33. As Seth, I want the Session Type options to be placeholders I can rename later, so that the list matches the services I actually offer.
34. As Seth, I want it all to keep running free in my own Google account, so that I don't depend on a paid service.
35. As the developer, I want a throwaway spike that proves a 100MB browser-to-Drive upload works before the full build, so that we find out about a CORS blocker early.
36. As the developer, I want the updated setup guide to cover the new Drive permission and the cleanup trigger, so that Seth can redeploy without me.

## Implementation Decisions

- **Field set and order**: Artist or Band Name (required), Email (required), Phone (required), Experience Level (required), Session Type (required), Demo (required, 1–3 files), "Anything else?" (optional). Removed: Phone-or-Instagram, Project Scope, Sound Inspiration link, Preferred Dates, "Tell Seth about what you want to achieve". Control names: `artistName`, `artistEmail`, `artistPhone`, `experienceLevel`, `sessionType`, `anythingElse`, and the honeypot `website`.
- **Phone**: a `type="tel"` input with `autocomplete="tel"` and `inputmode="tel"`. It's valid when the value holds at least 10 digits once non-digits are stripped. A custom validity message feeds the existing `:user-invalid` styling.
- **Experience Level**: a native select with the current three options, unchanged.
- **Session Type**: a native select with placeholder options in the bracketed-placeholder style (e.g. `[Session Type A]`…`[Session Type D]`) for Seth to rename. Superseded: the pickers became Push keys and a Slide switch (see `booking-form-tactile`); ticket 07 stays parked.
- **Copy**: field labels and validation, progress and status messages are real UI text. Editorial copy around the form stays placeholder. The dropzone note reads roughly: "Audio or video, up to 3 files, 250MB each. A phone voice memo is perfect."
- **Accepted Demo types**: audio m4a, mp3, wav, aac, ogg; video mp4, mov, webm. Checked by extension and MIME type on the client and again on the server when the upload slot is requested.
- **Upload architecture (ADR 0002)**: three steps, all through the same Apps Script web app and the same no-preflight `text/plain` JSON POST already in use:
  1. `startUpload`: the client sends the honeypot plus `files: [{ name, type, size }]`. The script rejects a filled honeypot (it returns `ok: true` with no slots, so bots learn nothing), more than 3 files, any file over 250MB or a disallowed type. Otherwise it creates a staging Drive resumable upload session per file, with the request's origin set so the browser may upload cross-origin, and tags each file with a fresh `inquiryId`. It responds with `{ ok, inquiryId, uploads: [{ name, uploadUrl }] }`.
  2. Browser to Drive: the client PUTs each file to its `uploadUrl` in chunks that are multiples of 256KB (default 8MB), reporting combined progress. On a network error or 5xx it asks the session how far it got (`Content-Range: bytes */size`) and resumes from there, up to a few retries with backoff, before showing "Try again". "Try again" reuses the same sessions. The final chunk's response gives the Drive file id.
  3. `submitInquiry`: the client sends `inquiryId`, the text fields and the list of Drive file ids. The script checks that each id is a staging file tagged with that `inquiryId`, moves the files into a per-Inquiry folder (artist name and date), then emails, texts and logs as today. It responds `{ ok: true }` or `{ ok: false, error }`.
- **Request and response contract**: same envelope as the existing booking-submission spec, with an `action` field (`startUpload` or `submitInquiry`). The old single-shot base64 memo path and the form-encoded no-JS path are removed.
- **No-JS**: the form is hidden behind a `noscript` notice that points to the Direct Channels section. Nothing posts without JavaScript.
- **Abuse guard and cleanup**: the honeypot and the caps above, plus a daily time-driven trigger that deletes staging files older than 24 hours. Server-side text values are truncated as today. No CAPTCHA.
- **Notifications**: the email, the Sheet columns and the text change to the new field set. The email lists each Demo as a Drive link with its file name and size. The text reads: artist name, Session Type, "check email". The Twilio / gateway / off order stays.
- **Leaving the page**: a `beforeunload` warning is active only while an upload or send is in progress.
- **Client module**: the existing booking form script is extended (or split into a small upload helper it owns). It owns the file list UI, validation, the upload state machine (idle → uploading → sending → done | failed-retryable), progress and status announcements. The status line keeps `role="status"`. Progress uses a native `progress` element styled as a 1px hairline bar.
- **Styles**: tokens only, unboxed: hairline borders, faint fill on drag-over and hover, plain-text status tinted with the valid and error tokens. Both palettes, light and dark.
- **Spike first**: a throwaway page plus a temporary script function proves that a 100MB file uploads from a local origin to Drive through a script-created resumable session, with no CORS error, and can resume after a forced abort. If that fails, the upload-size decision goes back to the user before any other ticket starts.

## Testing Decisions

- **One seam**: the existing Playwright Contact-page test, extended. It serves the site locally and mocks both the Apps Script endpoint and the Drive upload URLs with route interception. No Google service is called. It tests only what the visitor sees and what leaves the browser.
- Cases:
  - Submitting empty shows errors for name, email, phone, Experience Level, Session Type and Demo, and sends nothing.
  - A phone with fewer than 10 digits is flagged; "+1 (555) 123-4567" passes.
  - A wrong file type, a file over 250MB (a faked size) and a fourth file are each refused with a message. Removing a file works.
  - A valid send makes one `startUpload` POST with the expected file metadata, then chunked PUTs to each mocked `uploadUrl` with correct `Content-Range` headers, then one `submitInquiry` POST with the text fields, `inquiryId` and the file ids.
  - Progress reaches 100%. The button stays disabled throughout. Success shows the thank-you and resets the form.
  - A PUT aborted mid-upload triggers a status query and resumes from the reported offset without re-sending earlier chunks.
  - Retries running out show "Try again" with all fields still filled. Pressing it finishes the upload and sends.
  - A `submitInquiry` that returns `{ ok: false }` or a 500 shows the error, keeps the fields and re-enables the button.
  - The placeholder endpoint still shows the not-connected message with no requests made.
  - No console errors and no horizontal overflow at phone, tablet and desktop widths.
- Prior art: the current booking, browser and fader checks. The extended test stays in `npm run check`.
- Checked by hand: the spike; running the Apps Script `testSubmission`; one live Inquiry with a 100MB+ video from a phone; and confirming that the cleanup trigger deletes an orphaned staging file.
- Run the contrast check after the style changes.

## Out of Scope

- The real Session Type labels and editorial copy (Seth writes these).
- Console knob or toggle styling for the pickers (ticket 07 stays parked).
- A link-instead-of-upload option for Demos.
- Instagram or other social handles.
- CAPTCHA or Turnstile, rate limiting beyond the caps, and virus scanning.
- Auto-reply emails to the artist, calendar booking, payments, a dashboard.
- Transcoding or previewing Demos in the browser.
- Automated tests of the Apps Script backend.

## Further Notes

- Supersedes the voice-memo, field-set and no-JS parts of the booking-submission spec. Its email, text, Sheet, honeypot and endpoint-placeholder decisions still apply.
- Drive storage: Seth's free 15GB is shared with Gmail. At most 750MB per Inquiry, so roughly 20 maximal Inquiries fill a gigabyte. Seth should archive or delete old Demos.
- The script will need the Drive scope for resumable sessions (`ScriptApp.getOAuthToken()` with Drive access). Re-authorization at redeploy is expected; the setup guide must say so.
- Apps Script's daily quotas (URL fetch, email, trigger runtime) are ample for this audience, but each `startUpload` makes one Drive call per file.
- `NOTIFY_PHONE` is still a placeholder.
