# 02: New field set end to end

**What to build:** The artist fills in name, email, phone, Experience Level, Session Type and an optional "Anything else?", and Seth's email, Sheet row and text show exactly those fields. The old Project Scope, Sound Inspiration, Preferred Dates, Phone-or-Instagram and "Tell Seth" fields are gone. Visitors with JavaScript off see a notice pointing to Seth's direct channels.

**Blocked by:** None (can start immediately)

**Status:** done (2026-11-12)

- [x] Fields in order: name, email, phone, Experience Level, Session Type, (Demo slot left for 03), "Anything else?"; control names per spec
- [x] Phone is required and valid at 10+ digits in any format, with a worded error message
- [x] Session Type uses bracketed placeholder options; both pickers are plain native selects
- [x] Client sends `action: "submitInquiry"`; backend email, Sheet columns and text body use the new fields
- [x] The no-JS path is removed; a `noscript` notice points to Direct Channels
- [x] Booking browser test updated: empty-submit errors, phone validation, payload shape; `npm run check` and the contrast check pass

## Comments
- 2026-11-12: Built. Session Type option values equal their bracketed labels, so renaming an option in contact.html is the only change Seth needs. The form ships `hidden` and booking-form.js reveals it. `npm run check` and the contrast check pass.
