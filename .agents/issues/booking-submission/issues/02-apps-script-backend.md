Status: resolved
Blocked by: none

# 02 Apps Script backend + setup guide

Spec: `../spec.md` (Destination, request/response contract, backend config, texting, logging, voice memos, spam, setup guide).

Done when: `backend/booking-apps-script.gs` implements doPost + testSubmission per the contract (JSON text/plain body or form params; email with Reply-To, optional Twilio/gateway text, Sheet log, Drive memo link, honeypot), with secrets in Script Properties; `docs/booking-setup.md` gives the deploy steps.
