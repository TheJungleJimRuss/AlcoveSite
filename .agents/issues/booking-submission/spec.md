Status: ready-for-agent

# Booking form: working submission with email and text alerts

## Problem Statement

The Contact page's Session Inquiry Form looks complete, but it posts to `#`, so nothing a visitor sends ever reaches Seth. Alcove's audience is teen and first-time musicians who were put off by the old Google Form. If the new form silently fails, or gives no feedback, they won't try again. Seth wants every inquiry to arrive as an email, and ideally a text, so he can reply within the promised 24–48 hours. The site is static (no build, no server), so submissions need a hosted backend that costs nothing and that Seth can own.

## Solution

When a visitor presses "Send Message to Seth", the form checks the required fields, sends the inquiry in the background, and shows the result on the page without a reload: "Sending…", then a friendly thank-you, or an error that points to the direct contact details. A voice memo dropped onto the dropzone or picked with Browse Files goes along with the inquiry.

Behind the form, a Google Apps Script web app owned by Seth's Google account:
- emails the inquiry to a notify address, with Reply-To set to the artist,
- texts a short alert to a notify phone when texting is configured,
- logs a row to a Google Sheet,
- saves the voice memo to a Drive folder and links it in the email.

Until the real deployment URL is pasted in, the endpoint is a clearly marked placeholder, and the form says online booking isn't connected yet and points to the direct channels. The notify email and phone start as the developer's personal email and number, and are swapped for Seth's at handoff.

## User Stories

1. As a first-time artist, I want to press one button to send my inquiry, so that booking feels as easy as sending a message.
2. As an artist, I want to stay on the page after sending, so that I don't lose my place or get bounced to a strange Google page.
3. As an artist, I want to see "Sending…" while my message goes out, so that I know something is happening.
4. As an artist, I want a clear thank-you that says when Seth will reply, so that I'm not left wondering whether it worked.
5. As an artist, I want a plain-language error if sending fails, with a way to reach Seth directly, so that a glitch doesn't stop me from booking.
6. As an artist, I want the button to stop me double-sending while a message is in flight, so that Seth doesn't get duplicates.
7. As an artist, I want errors only after I've finished with a field or tried to send, so that the form doesn't shout at me while I type.
8. As an artist, I want each required field (name, email, experience level, project scope) to tell me in words what's missing, so that I don't rely on a red border alone.
9. As an artist who leaves a required field empty, I want focus to move to the first problem, so that I can fix it quickly.
10. As an artist, I want an invalid inspiration link flagged with how to fix it, so that Seth gets a working link.
11. As an artist, I want to drag a voice memo onto the dropzone, so that sharing a rough idea is effortless.
12. As a phone user, I want to tap Browse Files and pick a recording, so that I can attach a memo without a computer.
13. As an artist, I want to see the name and size of the memo I attached, so that I know I picked the right file.
14. As an artist with a recording over 20MB, I want to be told it's too big and to paste a link instead, so that I'm not stuck.
15. As a screen-reader user, I want field errors linked to their fields and the send result announced, so that I hear what happened.
16. As a keyboard user, I want the dropzone and every control reachable with a visible focus ring, so that I can complete the form without a mouse.
17. As an artist, I want the form cleared after a successful send, so that it's obvious the message went.
18. As Seth, I want an email for every inquiry with every field labelled, so that I can read it at a glance.
19. As Seth, I want replying to that email to go straight to the artist, so that I can answer in one step.
20. As Seth, I want an optional text alert for each new inquiry, so that I can respond quickly even when I'm not checking email.
21. As Seth, I want texts to stay off until I set them up, so that nothing breaks before I have a texting account.
22. As Seth, I want every inquiry logged in a Google Sheet, so that I have a history even if an email gets lost.
23. As Seth, I want voice memos saved in a Drive folder and linked in the email, so that large files don't bounce and I can play them anywhere.
24. As Seth, I want spam bots filtered out without visitors solving a CAPTCHA, so that the form stays welcoming.
25. As Seth, I want the backend in my own Google account at no cost, so that I don't depend on the developer or a paid service.
26. As Seth, I want a short step-by-step setup guide, so that I can deploy the backend and paste in its URL myself.
27. As the developer, I want the notify email and phone to start as my own placeholders, so that I can test end to end before handoff.
28. As the developer, I want the form to detect the placeholder endpoint and say booking isn't connected yet, so that a pre-launch visitor still gets a useful message.
29. As a visitor with JavaScript off, I want the form to still post its text fields to the backend, so that I can reach Seth anyway.
30. As a visitor, I want the form and its messages to follow the site's unboxed Analog Studio style in light and dark palettes, so that the page feels consistent.

## Implementation Decisions

- **Destination**: a Google Apps Script web app (Execute as: Me, Access: Anyone). Picked over Formspree, which charges for file uploads and can't text, and Netlify Forms, which ties the site to one host. Free; Google's free accounts allow about 100 emails a day.
- **Endpoint location**: the form's `action` attribute holds the endpoint URL, as the single source of truth, which also serves the no-JS post. The placeholder is `https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec`. The client detects the `REPLACE_WITH_DEPLOYMENT_ID` token and shows the not-connected message instead of sending.
- **Request contract**: the client POSTs a JSON body with `Content-Type: text/plain;charset=utf-8`, which keeps it a simple request with no CORS preflight (Apps Script can't answer one). Fields use the existing control names: `artistName`, `artistEmail`, `artistContact`, `experienceLevel`, `projectGoal`, `soundInspiration`, `preferredDates`, `projectDetails`, plus the honeypot `website`. An attached memo travels as `memo: { name, type, base64 }`. The backend also accepts form-encoded parameters for the no-JS fallback (no file in that case).
- **Response contract**: JSON `{ ok: true }` or `{ ok: false, error }`. The client treats anything that isn't `ok: true` (a non-2xx status, unparseable JSON or a network failure) as an error.
- **Client module**: one small vanilla script, loaded with `defer` on the Contact page only. It owns submit handling, the status line, aria-invalid syncing and dropzone drag/drop. The page drops `novalidate` so native constraint validation and `:user-invalid` drive errors. The script also calls `reportValidity()` before sending.
- **Markup changes**: the form gets an id; error messages for name, experience, project scope and inspiration link (email's already exists), linked through `data-error` and added to `aria-describedby` only while shown; `autocomplete` hints (`name`, `email`, `tel`); a visually hidden honeypot that `aria-hidden` and `tabindex="-1"` keep away from people; a file-name readout in the dropzone; and a status paragraph with `role="status"` that receives focus after each send. The dropzone note changes from "Max 50MB" to "Max 20MB".
- **Status copy** (UI copy, so real text, not placeholders): "Sending…" / "Uploading your voice memo…"; success says Seth will reply within 24–48 hours; the error suggests trying again or emailing directly; the not-connected message points to the direct channels below.
- **Styles**: extend the existing `:user-invalid`/`:user-valid` rules to select and textarea, using tokens (no new hex colours). The status line is plain text tinted with `--color-valid`/`--color-error` and a 1px top hairline, which fits the unboxed style guide. The dropzone gets a drag-over state that only changes the border and adds a faint fill, matching the "hover = faint fill" Analog Studio rule.
- **Backend config**: constants at the top of the script for `NOTIFY_EMAIL` (placeholder: the developer's personal email), `NOTIFY_PHONE` (placeholder: the developer's number in E.164 form, still to be supplied), the Sheet name and the Drive folder name. Secrets live in Script Properties, never in the repo.
- **Texting**: Twilio when `TWILIO_SID`, `TWILIO_TOKEN` and `TWILIO_FROM` are set; otherwise a carrier email-to-SMS address in `SMS_GATEWAY_EMAIL`; otherwise no text. The text body is short: artist name, project scope, "check email".
- **Logging**: the Sheet is created on the first submission, with its id kept in Script Properties. Each row holds a timestamp, every labelled field and the memo link.
- **Voice memos**: limited to 20MB on the client and checked again on the server (base64 adds about 33% and Apps Script caps request size). Memos are saved to Drive and linked in the email, not attached, to stay under Gmail's attachment limits.
- **Spam**: a honeypot field. A filled honeypot returns `ok: true` and does nothing, so bots don't learn they were caught. Server-side checks require a name and a valid email, and truncate long values.
- **Setup guide**: a short doc covering creating the script, the `testSubmission` permission run, deploying, pasting the URL into the form's action, redeploying a new version without changing the URL, and the texting options.
- **AGENTS.md conflict**: the project rules forbid a production booking controller during the wireframe phase. The user explicitly asked for a working form, so this spec overrides that rule for this feature only. The project notes should record the override.

## Testing Decisions

- **One seam**: a Playwright browser test of the Contact page, in the style of the existing tests (a local static server, then a check of what the visitor sees). The endpoint request is intercepted with route mocking, so no Google service is called.
- Test external behaviour only: what the visitor sees and what leaves the browser, never internal functions or class names beyond the status element's text and state.
- Cases:
  - Submitting empty shows the required-field errors and sends nothing.
  - A valid submission sends one POST to the form's action with the expected JSON fields and a `text/plain` content type.
  - With an attached memo, the payload includes `memo.name` and base64 data.
  - The button is disabled while the request is pending, then a success message shows and the form resets.
  - A mocked `{ ok: false }`, a 500 and a network abort each show the error message and re-enable the button.
  - With the placeholder endpoint, the not-connected message shows and no request is made.
  - A file over 20MB is flagged and blocks sending.
  - No console errors and no horizontal overflow at phone, tablet and desktop widths, as `browser-check.mjs` already checks.
- Prior art: the existing browser-check and fader-check tests. The new test joins `npm run check`.
- The backend is verified by hand: run `testSubmission` in the Apps Script editor and confirm the email, the Sheet row and (if configured) the text. Then make one live submission from the deployed site.
- Run the contrast check after the style changes.

## Out of Scope

- Final booking questions and form content (solo vs band, genre, the analog knobs and toggles in parked ticket 07). This spec wires the current fields only.
- A booking dashboard, calendar scheduling, availability or payments.
- Auto-reply emails to the artist.
- CAPTCHA or rate limiting beyond the honeypot.
- Choosing or buying a texting service, and deploying the backend into Seth's account (Seth or the developer does this by following the guide).
- Automated tests of the Apps Script backend.

## Further Notes

- Still needed from the user: the placeholder phone number for `NOTIFY_PHONE`.
- The repo is public on GitHub, so the placeholder email and phone in the backend config are visible to anyone. Consider moving them to Script Properties before pushing.
- Carrier email-to-SMS gateways are unreliable, and several US carriers have shut theirs down. Twilio is the dependable option, at roughly $0.01 per text plus a number.
- Seth may still pick a different destination in the Client Discovery Review. Only the backend and the endpoint URL would change; the client contract stays.
