# 02: Replace audio and video slots

**What to build:** Seth can replace the Work session video and its poster image, and the A/B deck's voice memo and finished master as two independent clips, with the same stage, preview and Save flow as photos. Audio and video are uploaded unchanged after type and size checks against one size-cap constant.

**Blocked by:** 01: Replace photos end-to-end

**Status:** done

- [x] Session video, its poster, A/B memo and A/B master are separate Media slots with keys and loader support
- [x] Allowed types: MP3, M4A, WAV, OGG, WebM audio; MP4 and WebM video; others rejected with a clear message before staging
- [x] The size cap (about 90 MB) is one constant; oversize files rejected with no request
- [x] Staged clip previews (plays) in place before Save; upload progress and a failure message that names the file
- [x] A/B deck keeps working with replaced clips (switch, playhead, blob loading); the master no longer depends on a song
- [x] `tests/admin-check.mjs` and `tests/ab-check.mjs` pass; `npm run check` passes
