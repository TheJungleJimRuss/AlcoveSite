# Booking form setup

Each inquiry from the Contact page does four things: emails Seth (Reply-To is the artist), optionally texts him, adds a row to a Google Sheet, and logs the fields below. Each Inquiry also carries 1 to 3 Demos (audio or video, 250MB each) that upload from the browser straight to Seth's Drive; the email and Sheet row link each one.

Fields: Name, Email, Phone (US numbers only: 10 digits, optional +1), Experience level, Session type, Anything else? (optional). Sheet columns: Timestamp, those six, then Demos (a Drive link per file with its name and size). If a Sheet already exists from before, add a `Demos` header in the next column. The text alert reads: artist name, Session Type, "check email".

Until the deployment URL is pasted into the form, the form shows "online booking isn't connected yet" and points visitors to the direct contact details.

## 1. Create the script

1. Go to [script.google.com](https://script.google.com) (signed in as the account that should own the data) and create a new project.
2. Paste in the contents of `backend/booking-apps-script.gs`.
3. Set the notify address and phone. The repo is public, so prefer **Project Settings → Script Properties** over editing `CONFIG`: add `NOTIFY_EMAIL` and `NOTIFY_PHONE` (E.164, e.g. `+15551234567`). Properties override the constants.
4. Pick `testSubmission` in the function dropdown and click **Run**. Approve the permissions (Gmail send, Drive, Sheets, external requests). The script now needs the full **Drive** scope (it opens upload sessions and moves files), so anyone upgrading from the earlier version must re-authorize: run `testSubmission` again and accept, then redeploy. `testSubmission` uploads a tiny test file and runs the whole flow. If you pin scopes, turn on **Project Settings → Show "appsscript.json"** and make sure `oauthScopes` includes `https://www.googleapis.com/auth/drive`, `https://www.googleapis.com/auth/spreadsheets`, `https://www.googleapis.com/auth/script.send_mail` and `https://www.googleapis.com/auth/script.external_request`. Check that the email arrived, the Sheet row exists and (if configured) the text came through.

## 2. Deploy

1. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**.
2. Copy the `/exec` URL.
3. In `contact.html`, replace `https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec` in the form's `action` with that URL.
4. After changing the script later: **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. This keeps the same URL. Creating a brand new deployment gives a new URL.

## 3. Cleanup trigger and abuse guard

1. Pick `installCleanupTrigger` in the function dropdown and click **Run** once (re-running is safe). It installs a daily trigger for `cleanStaging`, which trashes files in `Alcove Demos/staging` older than 24 hours. Check under **Triggers** (clock icon). To test by hand, upload a file into `staging`, change nothing, and run `cleanStaging` after 24 hours, or temporarily set `STAGING_MAX_AGE_HOURS` to `0` and run it.
2. Optional but recommended once the site has its real address: add Script Property `ALLOWED_ORIGINS` (comma-separated, e.g. `https://alcoverecording.com`). Upload requests from any other origin are refused. Leave it unset while testing from `localhost`.
3. Already built in: the honeypot (a filled field gets `ok: true` and no upload slots), at most 3 files, 250MB each, and audio/video types only, all enforced on the server too.

## 4. Text alerts (optional)

Texts stay off until one of these is set in Script Properties. Twilio is checked first.

| Option | Properties | Notes |
|---|---|---|
| Twilio (reliable) | `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM` (your Twilio number), plus `NOTIFY_PHONE` | About $0.01 per text plus the number |
| Carrier email-to-SMS | `SMS_GATEWAY_EMAIL` (e.g. `5551234567@vtext.com`) | Free, but gateways are unreliable and several US carriers have shut theirs down |

## 5. Good to know

- Demos land in a Drive folder named `Alcove Demos`: a `staging` subfolder while uploading, then one folder per Inquiry named after the artist and date. Drive storage is the free 15GB shared with Gmail, so archive old Demos now and then. Staging files that never became part of a sent Inquiry are trashed after 24 hours by a daily job (see step 3).

- Free Google accounts can send about 100 emails a day through Apps Script, which is plenty for inquiries.
- Spam: the form has a hidden honeypot field. Bots that fill it get a fake "ok" and nothing is sent. There is no CAPTCHA.
- The form needs JavaScript; with it off, visitors see a notice pointing to the direct contact details.
- Keep `NOTIFY_EMAIL`, `NOTIFY_PHONE` and all Twilio values in Script Properties, not in the repo.
