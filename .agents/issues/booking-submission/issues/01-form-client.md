Status: resolved
Blocked by: none

# 01 Booking form client + browser test

Spec: `../spec.md` (Implementation Decisions: endpoint location, request/response contract, client module, markup, status copy, styles; Testing Decisions).

Done when: contact.html posts the form via fetch to the placeholder Apps Script URL in its `action`, shows Sending / Thanks / error / not-connected states, validates required fields with linked error messages, supports memo drag-drop with a 20MB cap; a Playwright test `tests/booking-check.mjs` covers every Testing Decisions case with the endpoint mocked and is added to `npm run check`; `npm run check` and `node tests/contrast-check.mjs` pass.
