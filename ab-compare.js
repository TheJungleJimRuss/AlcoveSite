// Work page: cassette A/B deck. Side A = Voice Memo, Side B = Finished Master.
// One transport, two clips. Flipping the tape is the A/B action and keeps the playhead.
// Both clips are fetched whole into memory (blob URLs) so seeking works in every browser,
// even on hosts that ignore HTTP Range requests (Safari restarts at 0:00 there otherwise).
//
// Events (all bubble from section.ab-compare), for the 3D player (cassette-3d.js):
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
  // Names come from the table's column headers so an edited wording shows up on the deck too.
  const names = new Proxy(fallback, { get: (t, v) => (section.querySelector(`th[data-version="${v}"]`)?.textContent.trim()) || t[v] });
  const $ = id => document.getElementById(id);
  const keyPlay = $('ab-key-play'), keyPause = $('ab-key-pause'), keyStop = $('ab-key-stop'), keyFlip = $('ab-key-flip');
  const timeEl = $('ab-time'), durEl = $('ab-dur');
  const label = root.querySelector('.deck-label');
  const face = $('cassette-face');
  const reelL = $('cs-reel-l'), reelR = $('cs-reel-r'), packL = $('cs-pack-l'), packR = $('cs-pack-r');
  // SVG fallback tape: from each pack's tangent to its guide post and across the bottom edge (same maths as cassette-3d.js)
  const tapePath = $('cs-tape');
  function drawTape(rL, rR) {
    if (!tapePath) return;
    const end = (sx, cx, rp) => {
      const cy = 143, gx = sx < 0 ? 48 : 272, gy = 187, g = 5, dx = gx - cx, dy = gy - cy, L = Math.hypot(dx, dy);
      const ux = dx / L, uy = dy / L, sn = (rp - g) / L, cs = Math.sqrt(1 - sn * sn);
      const nx = sx * uy * cs + ux * sn, ny = -sx * ux * cs + uy * sn;
      return [[cx + nx * rp, cy + ny * rp], [gx + nx * g, gy + ny * g]];
    };
    const l = end(-1, 116, rL), r = end(1, 204, rR);
    tapePath.setAttribute('d', `M${l[0][0].toFixed(1)} ${l[0][1].toFixed(1)}L${l[1][0].toFixed(1)} ${l[1][1].toFixed(1)}L${r[1][0].toFixed(1)} ${r[1][1].toFixed(1)}L${r[0][0].toFixed(1)} ${r[0][1].toFixed(1)}`);
  }
  const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
  const OUT_MS = 700, IN_MS = 700; // eject-lift-flip-insert: the door opens, the tape turns over, drops back in

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

  function sync() {
    const s = state();
    keyPlay.setAttribute('aria-pressed', String(s.playing));
    root.dataset.playing = s.playing;
    label.textContent = (s.playing ? 'Now playing: ' : '') + names[version];
    timeEl.textContent = fmt(s.time);
    durEl.textContent = fmt(s.duration);
    if (packL) packL.setAttribute('r', (12 + 12 * (1 - s.progress)).toFixed(2));
    if (packR) packR.setAttribute('r', (12 + 12 * s.progress).toFixed(2));
    drawTape(12 + 12 * (1 - s.progress), 12 + 12 * s.progress);
    const a = reel.toFixed(1) + 'deg';
    reelL?.style.setProperty('--reel', a);
    reelR?.style.setProperty('--reel', a);
    section.dispatchEvent(new CustomEvent('ab:state', { bubbles: true, detail: s }));
    if (s.playing && !flipping) startLoop();
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
    const anim = !reduced() && !!face?.animate;
    section.dispatchEvent(new CustomEvent('ab:flip-start', { bubbles: true, detail: { from, to, outMs: anim ? OUT_MS : 0, inMs: anim ? IN_MS : 0 } }));
    sync();
    const run = (frames, opts) => face.animate(frames, { ...opts, fill: 'forwards' }).finished.catch(() => {});
    try {
      if (anim) await run([{ transform: 'translateY(0) scale(1) rotateY(0)' }, { transform: 'translateY(-14px) scale(1.06) rotateY(90deg)' }], { duration: OUT_MS, easing: 'ease-in' });
      active = tracks[to];
      version = to;
      section.dataset.version = to;
      seekTo(active, t);
      sync();
      if (anim) {
        await run([{ transform: 'translateY(-14px) scale(1.06) rotateY(-90deg)' }, { transform: 'translateY(0) scale(1) rotateY(0)' }], { duration: IN_MS, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
        face.getAnimations().forEach(a => a.cancel());
      }
    } finally {
      flipping = false;
    }
    if (wasPlaying) active.play().catch(() => {});
    sync();
    section.dispatchEvent(new CustomEvent('ab:flip-end', { bubbles: true, detail: { version } }));
  }

  keyPlay.addEventListener('click', play);
  keyPause.addEventListener('click', pause);
  keyStop.addEventListener('click', stop);
  keyFlip.addEventListener('click', flip);
  $('cassette-stage')?.addEventListener('click', flip);

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
