# 05: Docs, large-upload check and final pass

**What to build:** Docs match the feature, the real GitHub size limit is checked, and a final security, accessibility and mobile pass is done.

**Blocked by:** 04: Cleanup, failure ordering and media conflicts

**Status:** done

- [x] ADR 0006 set to accepted; ADR 0004 and `docs/admin-token-setup.md` amended (Pages deploys from the Content branch, so Save goes live after redeploy; media section for Seth)
- [ ] One real large upload tested against GitHub (with the user's OK and a test token); size cap constant tuned or Git Data API decision recorded. NOT RUN: pending the user's OK; manual procedure in `docs/large-upload-test.md`
- [x] PROJECT_NOTES updated (repo growth, reconcile gotcha, genres retired); glossary checked
- [x] Verified: no innerHTML for titles or file names, token isolation, keyboard operable, screen-reader structure intact
- [x] `npm run check` and `node tests/contrast-check.mjs` pass (note pre-existing work.html failures); screenshots at phone, tablet and desktop
