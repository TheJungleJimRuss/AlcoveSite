# 05 VU meters

Status: resolved
Blocked by: 03

Web Audio AnalyserNode needles with easing; rest at zero when stopped; step (no ease) under reduced motion; silent failure if Web Audio is blocked.

## Answer

Status: resolved 2026-11-16.

New `vu-meters.js` (deferred, added to `work.html` just before `ab-compare.js`, so it loads before `now-playing.js`). Listens to `ab:state` on `section.ab-compare`, sets `--needle` on `#ab-needle-l/r` (rest -40deg, full 40deg). No edits to `ab-compare.js` or `cassette-3d.js`.

Audio tap findings: `now-playing.js` already makes one shared AudioContext and one MediaElementSource per element on `play` (capture, document-wide; skipped under reduced motion and on file://). `record-player.js` and `ab-compare.js` create no Web Audio nodes. A second `createMediaElementSource` on the same element throws, so `vu-meters.js` wraps `AudioContext` (returns one shared instance) and `AudioContext.prototype.createMediaElementSource` (cache per element, second caller gets the same node). If the meters create the source first (reduced motion, where now-playing skips), they connect it to the destination themselves and drop that path if now-playing later claims the node, so the sound is never doubled or muted. The meters only add dead-end analysers (ChannelSplitter -> two AnalyserNodes). Mono clips: splitter right output is silent, so R mirrors L at 0.93.

Behaviour: RMS -> needle with ease `dt*14`, steps (k=1) under reduced motion, rAF only while playing, not flipping and on screen (IntersectionObserver); eases back to rest after pause/flip/stop then stops. Context created lazily on the first `ab:state` playing; any throw sets `failed` (needles stay at rest, playback untouched); no Web Audio on file://. Debug hook `window.__vuMeters.state()`.

Tests: `tests/ab-check.mjs` gained needle leaves rest while playing, shared context running, needle back at rest after pause. `ab-check` all pass; `record-player-check` run with no failures.

Not verified: real speakers (audibility only inferred from the analyser reading signal and the destination path being connected), Safari/Firefox (webkit prefix path untested), stereo clip (only the mono WAV tested).
