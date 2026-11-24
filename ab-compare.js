// Work page: cassette A/B deck. Side A = Voice Memo, Side B = Finished Master.
// One transport, two clips. Flipping the tape is the A/B action and keeps the playhead.
// Both clips are fetched whole into memory (blob URLs) so seeking works in every browser,
// even on hosts that ignore HTTP Range requests (Safari restarts at 0:00 there otherwise).
//
// The deck is stacked Blender renders (images/cassette/): this file turns the reels, sizes the tape packs and swings the
// door open to flip the tape, all through compositor-only properties (rotate, scale, translate). The door is a strip of Blender frames.
// Events (all bubble from section.ab-compare), for anything that wants to follow the deck:
//   ab:state       after every state change and each animation frame while playing
//                  detail {version, playing, flipping, progress 0-1, time, duration, reel (deg), audio}
//   ab:flip-start  detail {from, to, outMs, inMs}   (the version swaps after outMs)
//   ab:flip-end    detail {version}
// window.__abDeck = {flip, play, pause, stop, seek(t), state()} for tests (no on-page scrubber; seek is for tests and scripts only).
(function () {
  const root = document.querySelector('.ab-player');
  if (!root || !root.querySelector('#ab-key-flip')) return;
  const section = root.closest('.ab-compare') || root;
  const tracks = {};
  root.querySelectorAll('audio[data-version]').forEach(a => { tracks[a.dataset.version] = a; });
  const fallback = { memo: 'Voice Memo', master: 'Finished Master' };
  const names = fallback;
  const $ = id => document.getElementById(id);
  const keyPlay = $('ab-key-play'), keyPause = $('ab-key-pause'), keyStop = $('ab-key-stop'), keyFlip = $('ab-key-flip');
  const timeEl = $('ab-time'), durEl = $('ab-dur');
  const label = root.querySelector('.deck-label');
  const stage = $('cassette-stage'), door = $('cassette-door')?.querySelector('.cd-door-strip');
  const reels = root.querySelectorAll('.cd-reel'), packL = root.querySelector('.cd-pack-l'), packR = root.querySelector('.cd-pack-r');
  const titles = root.querySelectorAll('.cs-side[data-version] .cd-title');
  const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
  const OUT_MS = 380, IN_MS = 380; // the door swings up, the tape turns over while it is open, the door closes
  const TURN_MS = 640; // the cassette lifts out, turns over (edge-on at the middle) and drops back in while the door is open
  const cassette = root.querySelector('.cd-cassette'), under = root.querySelector('.cd-under'), labelEl = root.querySelector('.cd-label');
  const FLIP_FRAMES = 15; // frames in images/cassette/flip-sheet-*.webp: the shell lifting, turning 180 degrees and settling (Blender)
  const flipBox = $('cassette-flip');
  let flipStrip = null;
  const DOOR_FRAMES = 10; // frames in images/cassette/door-sheet-*.webp, shut first

  // Decode the door strip once the page is idle so the first flip does not decode/raster it on demand.
  const warmDoor = () => { door?.decode?.().catch(() => {}); };
  if (door) (window.requestIdleCallback || setTimeout)(() => { if (door.complete) warmDoor(); else door.addEventListener('load', warmDoor, { once: true }); }, { timeout: 3000 });

  // The turning-tape strip (~100-300 KB) loads after the page is idle, never with Save-Data; until it is ready the flip uses the squash below.
  const conn = navigator.connection;
  if (flipBox && !conn?.saveData && !/2g/.test(conn?.effectiveType || '')) (window.requestIdleCallback || setTimeout)(() => {
    if (document.documentElement.hasAttribute('data-lite')) return; // Lite mode (low memory / slow): the 2x sheet decodes to ~29 MB, keep the squash
    const img = new Image();
    img.className = 'cd-flip-strip'; img.alt = ''; img.decoding = 'async';
    img.srcset = 'images/cassette/flip-sheet-1x.webp?v=2 1x, images/cassette/flip-sheet-2x.webp?v=2 2x';
    img.src = 'images/cassette/flip-sheet-1x.webp?v=2';
    img.decode().then(() => { flipBox.append(img); flipStrip = img; }).catch(() => {});
  }, { timeout: 5000 });

  let version = 'memo';
  let active = tracks[version];
  let flipping = false;
  let reel = 0; // degrees
  let pendingTime = null; // a seek waiting for the clip to load

  // Shared with record-player.js: a clip both players use (the master is also a Sleeve) is downloaded once.
  const fetchClip = window.__alcoveFetchClip || (window.__alcoveFetchClip = (() => {
    const cache = new Map();
    return u => {
      if (!cache.has(u)) cache.set(u, fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); }).catch(e => { cache.delete(u); throw e; }));
      return cache.get(u);
    };
  })());
  let loading = null;
  const load = () => loading || (loading = Promise.all(Object.values(tracks).map(a => {
    const want = a.dataset.src;
    return fetchClip(want)
      .catch(() => a.dataset.srcFallback ? fetchClip(a.dataset.srcFallback) : Promise.reject()) // a saved clip that will not load: use the authored one
      .then(b => URL.createObjectURL(b))
      .catch(() => a.dataset.src) // fall back to streaming the file directly
      // Never swap the source under a clip that is already playing.
      // (and skip a clip the editor replaced while this was loading: admin.js already set its source)
      .then(url => { if (a.dataset.src === want && (!a.src || (a.paused && a !== active))) { a.preload = 'auto'; a.src = url; } });
  })).then(() => { root.dataset.loaded = 'true'; sync(); }));

  // Start loading as the section approaches the viewport (once the page itself has loaded and the browser is idle;
  // never in the background with Save-Data on), or at once on first interaction.
  const loadLater = () => {
    if (navigator.connection && navigator.connection.saveData) return;
    const go = () => (window.requestIdleCallback ? requestIdleCallback(() => load(), { timeout: 3000 }) : setTimeout(load, 200));
    if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { io.disconnect(); loadLater(); }
    }, { rootMargin: '600px 0px' });
    io.observe(section);
  } else loadLater();

  const fmt = t => (isFinite(t) ? Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0') : '0:00');
  const reduced = () => reduceMq.matches;

  function state() {
    const time = pendingTime ?? active.currentTime ?? 0;
    const duration = isFinite(active.duration) ? active.duration : 0;
    return {
      version, playing: !active.paused, flipping,
      progress: duration ? Math.min(1, Math.max(0, time / duration)) : 0,
      time, duration, reel, audio: active
    };
  }

  // sync() runs every frame while playing: write only what changed. The reels and packs take `rotate` / `scale`,
  // which skip layout and paint.
  const setText = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
  let shownReel = null, shownProg = null;
  function sync() {
    const s = state();
    keyPlay.setAttribute('aria-pressed', String(s.playing));
    root.dataset.playing = s.playing;
    setText(label, (s.playing ? 'Playing: ' : '') + names[version]);
    setText(timeEl, fmt(s.time));
    setText(durEl, fmt(s.duration));
    titles.forEach(t => setText(t, names[t.closest('[data-version]').dataset.version]));
    drawDeck(s);
    section.dispatchEvent(new CustomEvent('ab:state', { bubbles: true, detail: s }));
    if (s.playing && !flipping) startLoop();
  }
  function drawDeck(s) {
    const p = Math.round(s.progress * 400) / 400; // tape packs: 0.9 -> 0.5 of the rendered pack on the left, the reverse on the right
    if (p !== shownProg) { shownProg = p; }
    const r = reel.toFixed(1);
    if (r !== shownReel) { shownReel = r; reels.forEach(el => { el.style.rotate = r + 'deg'; }); }
  }

  // Reels spin only while playing and not flipping; none under reduced motion.
  let raf = 0, last = 0;
  function frame(now) {
    raf = 0;
    const s = state();
    if (!s.playing || flipping) return; // loop ends; state changes restart it
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!reduced()) reel = (reel + dt * 200) % 360;
    sync(); // also re-arms the loop while playing
  }
  function startLoop() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  // Seek now if the clip can, otherwise as soon as its data arrives.
  function seekTo(el, t, then) {
    const apply = () => {
      el.currentTime = Math.min(t, el.duration || t);
      pendingTime = null;
      if (then) then();
      sync();
    };
    if (el.readyState >= 1) apply();
    else {
      pendingTime = t;
      el.addEventListener('loadedmetadata', apply, { once: true });
      if (!el.src) load();
      else { el.preload = 'auto'; el.load(); }
    }
  }

  function play() {
    if (flipping || !active.paused) return;
    if (!active.src) {
      // Not loaded yet: stream this clip right away so play() stays inside the click.
      Object.values(tracks).forEach(a => { if (!a.src) { a.preload = 'auto'; a.src = a.dataset.src; } });
    }
    active.play().catch(() => {});
  }
  function pause() { if (!flipping) active.pause(); }
  function stop() {
    if (flipping) return;
    active.pause();
    seekTo(active, 0);
    sync();
  }
  function seekPos(t) {
    if (flipping) return;
    seekTo(active, Math.max(0, t));
    sync();
  }

  async function flip() {
    if (flipping) return;
    flipping = true;
    const from = version, to = version === 'memo' ? 'master' : 'memo';
    const wasPlaying = !active.paused;
    const t = pendingTime ?? active.currentTime;
    active.pause();
    const anim = !reduced() && !!door?.animate;
    section.dispatchEvent(new CustomEvent('ab:flip-start', { bubbles: true, detail: { from, to, outMs: anim ? OUT_MS : 0, inMs: anim ? IN_MS : 0, turnMs: anim ? TURN_MS : 0 } }));
    sync();
    // The door strip holds one rendered frame per step; hold each frame until the next (steps) so it never shows two halves.
    const swing = (open, duration) => door.animate(Array.from({ length: DOOR_FRAMES }, (_, i) => {
      const f = open ? i : DOOR_FRAMES - 1 - i;
      return { translate: `0 ${(-100 * f / DOOR_FRAMES).toFixed(3)}%`, offset: i / (DOOR_FRAMES - 1), easing: 'steps(1, end)' };
    }), { duration, fill: 'forwards' }).finished.catch(() => {});
    try {
      if (anim) { door.style.willChange = 'translate'; section.dataset.door = 'open'; await swing(true, OUT_MS); }
      const swap = () => {
        active = tracks[to];
        version = to;
        section.dataset.version = to;
        seekTo(active, t);
        sync();
      };
      if (anim && flipStrip && cassette?.animate) {
        // The Blender strip is the shell; packs, reels and label are HTML scaled to match each frame (the camera is orthographic,
        // so turning by theta is scaleX(|cos|) plus a shift of the face 0.6 cm off the axis, and lifting is a slight grow).
        // Slow at the ends (lift, settle), fast through the middle. All compositor-only.
        const ease = u => { let lo = 0, hi = 1; for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; (3 * m * m - 2 * m * m * m < u ? lo = m : hi = m); } return lo; };
        const T = Array.from({ length: FLIP_FRAMES }, (_, i) => ease(i / (FLIP_FRAMES - 1)));
        const mid = (FLIP_FRAMES - 1) / 2;
        const xf = i => {
          const u = i / (FLIP_FRAMES - 1), th = Math.PI * u, lift = 1 + 0.09 * Math.sin(th);
          const sx = Math.abs(Math.cos(th)) * lift, shift = (i <= mid ? 1 : -1) * 3.75 * Math.sin(th) * lift;   // 0.6 cm of a 16 cm canvas
          return `translateX(${shift.toFixed(3)}%) scale(${sx.toFixed(4)}, ${lift.toFixed(4)})`;
        };
        // A -> B plays the strip forwards; B -> A plays it backwards (the tape turns back the way it came). The ease is symmetric.
        const fwd = to === 'master', last = FLIP_FRAMES - 1;
        const run = (from, to, ms) => {
          const step = from <= to ? 1 : -1;
          const frames = Array.from({ length: Math.abs(to - from) + 1 }, (_, k) => from + step * k);
          const kf = f => frames.map(i => ({ ...f(i), offset: (T[i] - T[from]) / (T[to] - T[from]), easing: 'steps(1, end)' }));
          const opts = { duration: ms, fill: 'forwards' };
          return Promise.all([
            flipStrip.animate(kf(i => ({ translate: `0 ${(-100 * i / FLIP_FRAMES).toFixed(3)}%` })), opts).finished,
            under.animate(kf(i => ({ transform: xf(i) })), opts).finished,
            labelEl.animate(kf(i => ({ transform: xf(i) })), opts).finished
          ]).catch(() => {});
        };
        flipStrip.style.translate = `0 ${fwd ? 0 : (-100 * last / FLIP_FRAMES).toFixed(3)}%`;
        // The strip and the resting shell are separate renders, so a hard swap shows a faint pop at the edges: crossfade both ends.
        const XF = 140, shown = { visibility: 'visible' };
        const restShell = [...cassette.querySelectorAll('.cd-shell')].find(el => getComputedStyle(el).visibility === 'visible');
        section.dataset.turn = '1';
        restShell?.animate([shown, shown], { duration: XF });
        flipBox.animate([{ opacity: 0, ...shown }, { opacity: 1, ...shown }], { duration: XF, easing: 'ease-in-out' });
        if (fwd) {
          await run(0, mid, TURN_MS * T[mid]);
          swap();
          await run(mid, last, TURN_MS * (1 - T[mid]));
        } else {
          await run(last, mid, TURN_MS * (1 - T[mid]));
          swap();
          await run(mid, 0, TURN_MS * T[mid]);
        }
        [flipStrip, under, labelEl].forEach(el => el.getAnimations().forEach(a => a.cancel()));
        flipStrip.style.translate = `0 ${fwd ? (-100 * last / FLIP_FRAMES).toFixed(3) : 0}%`;   // hold the final frame while the crossfade ends, not the inline start frame
        delete section.dataset.turn;
        flipBox.animate([{ opacity: 1, ...shown }, { opacity: 0, ...shown }], { duration: XF, easing: 'ease-in-out' });   // the new resting shell is already underneath
      } else if (anim && cassette?.animate) {
        // Compositor-only (scale + translate): up and squashed edge-on, swap the side, then back down.
        cassette.style.willChange = 'scale, translate';
        const half = TURN_MS / 2;
        await cassette.animate([
          { scale: '1 1', translate: '0 0', easing: 'cubic-bezier(.5,0,.9,.6)' },
          { scale: '0.02 1.1', translate: '0 -4%' }
        ], { duration: half, fill: 'forwards' }).finished.catch(() => {});
        swap();
        await cassette.animate([
          { scale: '0.02 1.1', translate: '0 -4%', easing: 'cubic-bezier(.1,.4,.5,1)' },
          { scale: '1 1', translate: '0 0' }
        ], { duration: half, fill: 'forwards' }).finished.catch(() => {});
        cassette.getAnimations().forEach(a => a.cancel());
        cassette.style.willChange = '';
      } else swap();
      if (anim) {
        await swing(false, IN_MS);
        door.getAnimations().forEach(a => a.cancel());
        door.style.willChange = '';
      }
    } finally {
      delete section.dataset.turn;
      flipping = false;
      delete section.dataset.door;
    }
    if (wasPlaying) active.play().catch(() => {});
    sync();
    section.dispatchEvent(new CustomEvent('ab:flip-end', { bubbles: true, detail: { version } }));
  }

  keyPlay.addEventListener('click', play);
  keyPause.addEventListener('click', pause);
  keyStop.addEventListener('click', stop);
  keyFlip.addEventListener('click', flip);
  stage?.addEventListener('click', flip);

  // Space / F anywhere on the Work page while the deck is on screen, unless focus is on a control or text.
  addEventListener('keydown', e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input,button,textarea,select,a,summary,[contenteditable],[role="slider"],[role="switch"],[role="button"]')) return;
    const isSpace = e.code === 'Space', isF = e.key.toLowerCase() === 'f';
    if (!isSpace && !isF) return;
    const r = section.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    e.preventDefault();
    if (isSpace) (active.paused ? play : pause)();
    else flip();
  });

  Object.values(tracks).forEach(a => {
    ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata', 'seeked'].forEach(ev =>
      a.addEventListener(ev, () => { if (a === active) sync(); }));
  });
  section.dataset.version = version;
  sync();

  window.__abDeck = { flip, play, pause, stop, seek: seekPos, state };
})();
