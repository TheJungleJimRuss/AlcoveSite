// Work page Record player: sleeves in a milk crate load a record onto the turntable (one shared <audio>).
// The Crate is the Songs list: saved Songs (window.__alcoveSongs, set by content-loader.js) replace the authored sleeves in
// order; admin.js changes them live through window.AlcoveRecordPlayer.setSongs. Titles are only ever set with textContent.
// State lives in data attributes on .record-player (data-state, data-playing, data-arm); CSS draws the rest.
(function () {
  const root = document.querySelector('.record-player');
  if (!root) return;
  const audio = root.querySelector('#audio-player');
  let sleeves = [...root.querySelectorAll('.sleeve')];
  const playBtn = root.querySelector('.rp-play');
  const statusEl = root.querySelector('.rp-status');
  const labelText = root.querySelector('.rp-label-text');
  const currentTimeEl = root.querySelector('#current-time');
  const totalTimeEl = root.querySelector('#total-time');
  const progressBar = root.querySelector('#progress-bar');
  const progressTrack = progressBar.parentElement;
  const arm = root.querySelector('.rp-arm');
  const svg = root.querySelector('.rp-arm-svg');
  const idleStatus = statusEl.textContent;
  const stackEl = root.querySelector('.rp-stack');
  let current = null;

  const fmt = t => (isFinite(t) ? Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0') : '0:00');
  const titleOf = s => s.querySelector('.sleeve-title').textContent.trim();

  // ---- Motion: one state machine. `phase` = idle | loading (arm home, record sliding) | swing (arm moving in)
  // | play (needle on the record, playing or lifted). Every async step carries a generation token, so a newer
  // click makes older timers harmless. Reduced motion skips every wait: states jump and playback starts at once.
  const rec = root.querySelector('.rp-record');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = { arm: 750, out: 320, lift: 280, slide: 320, travel: 640 };
  let gen = 0, phase = 'idle', shown = null;
  const wait = (ms, g) => new Promise(res => setTimeout(() => res(g === gen), ms));

  async function choose(s) {
    const g = ++gen, replay = s === current && shown === s, hadRecord = !replay && root.dataset.state === 'loaded' && phase !== 'idle', armOut = root.dataset.arm !== 'rest', fast = reduced();
    current = s; drag = null; phase = 'loading';
    audio.pause();
    audio.dataset.track = s.dataset.src;
    audio.src = blobs.get(s.dataset.src) || s.dataset.src; // the in-memory copy seeks on any server; else stream and upgrade later
    if (!blobs.has(s.dataset.src)) prefetch();
    sync(); // arm eases home (data-arm="rest"), sleeve marked
    endPick();
    if (!replay && !fast) beginPick();
    const lift = picking ? liftOut(s, g) : null; // sleeve lifts and the disc slides out, alongside the old record leaving
    if (hadRecord && !fast) {
      if (armOut && !await wait(T.arm * 0.8, g)) return;
      root.dataset.record = 'out'; if (!await wait(T.out, g)) return;
    }
    if (lift && !await lift) return;
    if (!replay) {
      spinReset();
      shown = s; labelText.textContent = titleOf(s);
      root.dataset.state = 'loaded';
      if (picking && !await travel(s, g)) return; // the disc travels to the platter, the sleeve drops back
      endPick();
      root.dataset.record = 'in'; // reduced motion lands here at once
    }
    phase = 'swing'; if (audio.currentTime) audio.currentTime = 0;
    sync(); // arm swings to the start groove
    if (!fast && !await wait(T.arm, g)) return;
    phase = 'play';
    audio.play().catch(() => {}); sync();
  }
  // Dragging or keying the needle mid-swing cancels the swing: the needle drops where the user puts it.
  function interrupt() {
    if (phase !== 'swing') return;
    gen++; phase = 'play';
    audio.play().catch(() => {}); sync();
  }

  // Platter spin (33 1/3 rpm feel: 1.8s a turn) with an ease-down instead of a freeze; resumes from where it stopped.
  let spin = 'off', spinAnim = null, spinAngle = 0;
  const curAngle = () => { const m = /(-?[\d.]+)deg/.exec(getComputedStyle(rec).rotate); return m ? +m[1] % 360 : spinAngle; };
  function spinOn() {
    if (spin === 'on' || reduced()) return;
    const a = spin === 'stopping' ? curAngle() : spinAngle;
    if (spinAnim) spinAnim.cancel();
    rec.style.rotate = a + 'deg';
    spinAnim = rec.animate([{ rotate: a + 'deg' }, { rotate: a + 360 + 'deg' }], { duration: 1800, iterations: Infinity });
    spin = 'on'; root.dataset.spin = 'on';
  }
  function spinStop() {
    if (spin !== 'on') return;
    const a = curAngle();
    spinAnim.cancel();
    rec.style.rotate = a + 'deg';
    const my = spinAnim = rec.animate([{ rotate: a + 'deg' }, { rotate: a + 66 + 'deg' }], { duration: 1300, easing: 'cubic-bezier(.15,.55,.3,1)', fill: 'forwards' });
    spin = 'stopping'; root.dataset.spin = 'stopping';
    my.onfinish = () => { if (spinAnim !== my) return; spinAngle = (a + 66) % 360; rec.style.rotate = spinAngle + 'deg'; my.cancel(); spinAnim = null; spin = 'off'; root.dataset.spin = 'off'; };
  }
  function spinReset() { if (spinAnim) spinAnim.cancel(); spinAnim = null; spin = 'off'; spinAngle = 0; rec.style.rotate = ''; root.dataset.spin = 'off'; }

  stackEl.addEventListener('click', e => {
    const s = e.target.closest('.sleeve');
    if (!s || suppressClick || picking) return;
    if (s !== front) { flipTo(s); return; } // only the front sleeve is a control; the others tip to the front
    if (s !== current) { choose(s); return; }
    if (phase === 'play') toggle();
  });

  function toggle() {
    if (!current || phase === 'loading' || phase === 'swing') return;
    if (!audio.paused) { audio.pause(); return; }
    if (audio.ended) { choose(current); return; } // finished record: arm swings in again from rest
    audio.play().catch(() => {});
  }
  playBtn.addEventListener('click', toggle);

  // One place turns audio state into attributes, classes and the announcement.
  function sync() {
    update();
    const on = !!current && phase === 'play' && !audio.paused && !audio.ended;
    if (!current) root.dataset.state = 'empty';
    root.dataset.playing = String(on);
    root.dataset.arm = on ? 'on' : phase === 'swing' ? 'swing' : phase === 'play' && !audio.ended ? 'lifted' : 'rest';
    if (on) spinOn(); else spinStop();
    sleeves.forEach(s => {
      const isCur = s === current;
      s.classList.toggle('is-current', isCur);
      s.classList.toggle('is-playing', isCur && on);
      s.setAttribute('aria-pressed', String(isCur && on));
      if (isCur) s.setAttribute('aria-current', 'true'); else s.removeAttribute('aria-current');
    });
    playBtn.disabled = !current;
    playBtn.textContent = on ? '⏸︎' : '▶︎';
    playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
    if (!current) { statusEl.textContent = idleStatus; labelText.textContent = ''; return; }
    const title = titleOf(current);
    statusEl.textContent = on ? 'Now playing: ' + title : phase === 'loading' || phase === 'swing' ? 'Cueing: ' + title : (audio.ended ? 'Finished: ' : 'Paused: ') + title;
  }
  ['play', 'pause', 'ended', 'emptied'].forEach(ev => audio.addEventListener(ev, sync));

  // Only one media element plays at a time: starting any pauses the rest (the A/B deck, the video).
  document.addEventListener('play', e => {
    document.querySelectorAll('audio, video').forEach(m => { if (m !== e.target && !m.paused) m.pause(); });
  }, true);

  // Clips are fetched whole into blob URLs (as in ab-compare.js) so seeking and duration work on servers without
  // Range support (python http.server; Safari restarts at 0:00 there). Falls back to the plain URL if fetch fails.
  const blobs = new Map();
  const asked = new Set(), settled = new Set();
  function prefetch() {
    const jobs = sleeves.filter(s => !asked.has(s.dataset.src)).map(s => {
      const src = s.dataset.src;
      asked.add(src);
      return fetch(src)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
        .then(b => { blobs.set(src, URL.createObjectURL(b)); })
        .catch(() => {})
        .then(() => { settled.add(src); if (current && current.dataset.src === src) upgrade(); });
    });
    return Promise.all(jobs).then(() => { if (sleeves.every(s => settled.has(s.dataset.src))) root.dataset.loaded = 'true'; });
  }
  // The current record started on the plain URL: swap to the blob only if that URL gave no usable duration.
  function upgrade() {
    const blob = blobs.get(current.dataset.src);
    if (!blob || audio.src === blob || isFinite(audio.duration) && audio.duration > 0) return;
    const t = audio.currentTime, was = !audio.paused;
    audio.src = blob;
    audio.addEventListener('loadedmetadata', () => { audio.currentTime = t; if (was) audio.play().catch(() => {}); }, { once: true });
  }
  let near = false; // the Crate has been near the viewport: new songs are fetched at once
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(en => { if (en.some(e => e.isIntersecting)) { io.disconnect(); near = true; prefetch(); } }, { rootMargin: '600px 0px' });
    io.observe(root);
  } else { near = true; prefetch(); }

  // ---- Crate: the front Sleeve is the only control. Flipping tips it forward (CSS 3D, driven by --r / --m / data-pos) ----
  const crate = root.querySelector('.rp-crate'), stage = root.querySelector('.rp-stage');
  const prevBtn = crate.querySelector('.rp-prev'), nextBtn = crate.querySelector('.rp-next');
  const countEl = crate.querySelector('.rp-count'), liveEl = crate.querySelector('#rp-crate-status');
  let front = sleeves[0], picking = false, released = Promise.resolve(), release = null, suppressClick = false;
  const visible = () => sleeves;

  function layout(announce) {
    const list = visible(), i = Math.max(0, list.indexOf(front));
    front = list[i] || null;
    list.forEach((s, k) => {
      s.dataset.pos = k === i ? 'front' : k > i ? 'behind' : 'tipped';
      s.style.setProperty('--r', Math.max(k - i, 0));
      s.style.setProperty('--m', Math.max(i - k, 0));
      s.tabIndex = k === i ? 0 : -1;
    });
    const was = document.activeElement;
    prevBtn.disabled = picking || i <= 0;
    nextBtn.disabled = picking || i >= list.length - 1;
    if ((was === prevBtn || was === nextBtn) && was.disabled && front) front.focus({ preventScroll: true });
    countEl.textContent = list.length ? (i + 1) + ' of ' + list.length : '';
    if (announce && front) liveEl.textContent = 'Record ' + (i + 1) + ' of ' + list.length + ': ' + titleOf(front);
  }
  function flipTo(s) {
    if (picking || !s || s === front) return;
    const hadFocus = sleeves.includes(document.activeElement);
    front = s; layout(true);
    if (hadFocus) front.focus({ preventScroll: true }); // the new front sleeve is the new tab stop
  }
  const flipBy = d => { const list = visible(); flipTo(list[list.indexOf(front) + d]); };
  prevBtn.addEventListener('click', () => flipBy(-1));
  nextBtn.addEventListener('click', () => flipBy(1));
  crate.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest('[contenteditable]')) return; // Admin Edit mode: arrows move the caret
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key], list = visible();
    if (d !== undefined) flipBy(d);
    else if (e.key === 'Home') flipTo(list[0]);
    else if (e.key === 'End') flipTo(list[list.length - 1]);
    else return;
    e.preventDefault();
  });
  // Mouse wheel: one flip per gesture; at either end the wheel is left alone so the page keeps scrolling.
  let wheelAt = 0;
  stage.addEventListener('wheel', e => {
    const d = Math.sign(Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX), list = visible();
    if (!d || e.ctrlKey || !list[list.indexOf(front) + d]) return;
    e.preventDefault();
    if (e.timeStamp - wheelAt < 420) return;
    wheelAt = e.timeStamp; flipBy(d);
  }, { passive: false });
  // Touch swipe (touch-action: pan-y keeps vertical page scroll): left/up = next, right/down = previous.
  let swipe = null;
  stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, done: false }; });
  stage.addEventListener('pointermove', e => {
    if (!swipe || swipe.id !== e.pointerId || swipe.done) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if (Math.hypot(dx, dy) < 30) return;
    swipe.done = true; suppressClick = true;
    flipBy((Math.abs(dx) >= Math.abs(dy) ? dx : dy) < 0 ? 1 : -1);
  });
  const endSwipe = () => { if (swipe && swipe.done) setTimeout(() => { suppressClick = false; }, 60); swipe = null; };
  stage.addEventListener('pointerup', endSwipe);
  stage.addEventListener('pointercancel', endSwipe);

  // ---- Picking: the sleeve lifts out of the crate, the disc slides out of it and travels to the platter, the sleeve
  // drops back. The disc is one overlay element (.rp-disc) moved with WAAPI from rects measured at run time, so the same
  // code serves the side-by-side and stacked layouts. Flips and sleeve clicks wait (data-picking) until it lands.
  const disc = root.querySelector('.rp-disc'), discText = root.querySelector('.rp-disc-text'), platter = root.querySelector('.rp-platter');
  const pose = (x, y, k) => 'translate(' + x + 'px, ' + y + 'px) scale(' + k + ')';
  let leg = null; // where the disc stopped after sliding out; the travel starts there
  function beginPick() { picking = true; root.dataset.picking = 'true'; released = new Promise(r => { release = r; }); layout(false); }
  function endPick() {
    disc.getAnimations().forEach(a => a.cancel());
    disc.style.opacity = '0'; leg = null;
    sleeves.forEach(s => s.classList.remove('is-lifted'));
    if (picking) { picking = false; delete root.dataset.picking; release(); layout(false); }
  }
  async function liftOut(s, g) {
    discText.textContent = titleOf(s);
    s.classList.add('is-lifted');
    if (!await wait(T.lift, g)) return false;
    const rr = root.getBoundingClientRect(), sr = s.getBoundingClientRect(), pr = platter.getBoundingClientRect();
    const d = pr.width * 0.958, d0 = sr.width * 0.84, k0 = d0 / d, up = d0 * 0.6;
    const x0 = sr.left + (sr.width - d0) / 2 - rr.left, y0 = sr.top - rr.top; // the disc starts hidden inside the sleeve, its top at the sleeve's top edge
    leg = { x: x0, y: y0 - up, k: k0, tx: pr.left + (pr.width - d) / 2 - rr.left, ty: pr.top + (pr.height - d) / 2 - rr.top };
    disc.style.setProperty('--d', d + 'px');
    disc.style.opacity = '1';
    disc.animate([{ transform: pose(x0, y0, k0), clipPath: 'inset(0 0 100% 0)' }, { transform: pose(x0, y0 - up, k0), clipPath: 'inset(0 0 40% 0)' }], { duration: T.slide, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
    return wait(T.slide, g);
  }
  function travel(s, g) {
    const l = leg;
    if (!l) return true;
    disc.animate([{ transform: pose(l.x, l.y, l.k), clipPath: 'inset(0 0 40% 0)' }, { offset: 0.3, clipPath: 'inset(0 -40% -40% -40%)' }, { transform: pose(l.tx, l.ty, 1), clipPath: 'inset(-40% -40% -40% -40%)' }], { duration: T.travel, easing: 'cubic-bezier(.35,.1,.2,1)', fill: 'forwards' });
    setTimeout(() => { if (g === gen) s.classList.remove('is-lifted'); }, T.travel * 0.2); // clear of the sleeve: it drops back
    return wait(T.travel, g);
  }
  layout(false);

  // ---- Seeking: the tonearm and the timeline are both sliders over the same position ----
  // Arm geometry in the SVG's 500x400 viewBox: pivot (435,60), needle 254 from the pivot at 0deg; the record's
  // centre is (190,200). The groove band runs from radius 144 (0:00) in to radius 68 (end, just outside the label).
  const G = { px: 435, py: 60, len: 254, cx: 190, cy: 200 };
  const tipDist = deg => { const a = deg * Math.PI / 180; return Math.hypot(G.px - G.len * Math.sin(a) - G.cx, G.py + G.len * Math.cos(a) - G.cy); };
  const angleAt = r => { let lo = 0, hi = 60; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (tipDist(m) > r) lo = m; else hi = m; } return lo; };
  const A0 = angleAt(144), A1 = angleAt(68);
  const duration = () => (isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0);
  let drag = null; // { id, t }: the needle position being dragged, committed on release
  const sliders = [arm, progressTrack];

  function update() {
    const dur = current ? duration() : 0;
    const t = Math.max(0, Math.min(drag ? drag.t : audio.currentTime || 0, dur));
    const frac = dur ? t / dur : 0;
    const text = !current ? 'No record loaded' : dur ? fmt(t) + ' of ' + fmt(dur) : fmt(t);
    sliders.forEach(el => {
      el.setAttribute('aria-valuemax', String(Math.round(dur)));
      el.setAttribute('aria-valuenow', String(Math.round(t)));
      el.setAttribute('aria-valuetext', text);
      el.setAttribute('aria-disabled', String(!current));
      if (current) el.setAttribute('tabindex', '0'); else el.removeAttribute('tabindex');
    });
    currentTimeEl.textContent = fmt(t);
    totalTimeEl.textContent = fmt(dur);
    progressBar.style.width = frac * 100 + '%';
    if (current && phase !== 'loading' && !audio.ended) root.style.setProperty('--arm-angle', (A0 + (A1 - A0) * frac).toFixed(2) + 'deg');
    else root.style.removeProperty('--arm-angle');
  }
  ['timeupdate', 'durationchange', 'loadedmetadata', 'seeked', 'seeking'].forEach(ev => audio.addEventListener(ev, update));

  function seekTo(t) {
    const dur = duration();
    if (!current || !dur) return;
    interrupt();
    audio.currentTime = Math.max(0, Math.min(t, dur));
    update();
  }
  // Pointer drag with capture: the needle follows during the drag, the seek commits on release.
  function bindDrag(el, toTime) {
    el.addEventListener('pointerdown', e => {
      if (!current || !duration() || phase === 'loading' || e.button > 0) return;
      e.preventDefault();
      interrupt();
      el.focus({ preventScroll: true });
      el.setPointerCapture(e.pointerId);
      drag = { id: e.pointerId, t: toTime(e) };
      update();
    });
    el.addEventListener('pointermove', e => { if (drag && drag.id === e.pointerId) { drag.t = toTime(e); update(); } });
    const end = commit => e => {
      if (!drag || drag.id !== e.pointerId) return;
      const t = drag.t;
      drag = null;
      if (commit) seekTo(t); else update();
    };
    el.addEventListener('pointerup', end(true));
    el.addEventListener('pointercancel', end(false));
    el.addEventListener('lostpointercapture', end(false));
    el.addEventListener('keydown', e => {
      const step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 30, PageDown: -30 }[e.key];
      if (!current || !duration()) return;
      if (step !== undefined) seekTo(audio.currentTime + step);
      else if (e.key === 'Home') seekTo(0);
      else if (e.key === 'End') seekTo(duration() - 1);
      else return;
      e.preventDefault();
    });
  }
  bindDrag(progressTrack, e => { const r = progressTrack.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration(); });
  bindDrag(arm, e => { // pointer angle around the pivot, clamped to the groove band
    const r = svg.getBoundingClientRect(), k = r.width / 500;
    const dx = (e.clientX - r.left) / k - G.px, dy = (e.clientY - r.top) / k - G.py;
    const deg = Math.atan2(-dx, dy) * 180 / Math.PI;
    return Math.max(0, Math.min(1, (deg - A0) / (A1 - A0))) * duration();
  });
  sync();

  // ---- Songs: build or rebuild the Crate from a list of { title, file }. A song that is still in the list keeps playing. ----
  const ART = 4; // cover placeholder designs (CSS data-art); picked from the file name so a song keeps its cover when reordered
  const artOf = src => { let h = 0; for (const c of src) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % ART; };
  const markArt = s => { s.dataset.art = String(artOf(s.dataset.src)); };
  function makeSleeve(song) {
    const el = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text) n.textContent = text; return n; };
    const s = el('button', 'sleeve');
    s.type = 'button';
    s.dataset.src = song.file;
    s.setAttribute('aria-pressed', 'false');
    const strip = el('span', 'sleeve-strip'), title = el('strong', 'sleeve-title', song.title);
    strip.appendChild(title);
    const band = el('span', 'sleeve-band');
    band.appendChild(el('span', 'sleeve-sub', 'Recorded at Alcove'));
    const art = el('span', 'sleeve-art'); art.setAttribute('aria-hidden', 'true');
    const tab = el('span', 'sleeve-tab'); tab.setAttribute('aria-hidden', 'true');
    s.append(strip, band, art, tab);
    return s;
  }
  function setSongs(list, reset) {
    const oldCur = current, oldShown = shown, frontSrc = !reset && front && front.dataset.src;
    const next = list.map(makeSleeve);
    const anchor = stackEl.querySelector('.crate-front');
    sleeves.forEach(s => s.remove());
    next.forEach(s => { markArt(s); stackEl.insertBefore(s, anchor); });
    sleeves = next;
    const remap = o => (o && sleeves.find(x => x.dataset.src === o.dataset.src)) || null;
    if (oldCur && !remap(oldCur)) { // the playing song was removed: stop and empty the platter
      gen++; phase = 'idle'; endPick();
      audio.pause(); audio.removeAttribute('src'); delete audio.dataset.track; audio.load();
      current = null; shown = null; drag = null; spinReset();
      delete root.dataset.record;
    } else {
      current = remap(oldCur); shown = remap(oldShown);
      if (shown) labelText.textContent = titleOf(shown);
    }
    front = sleeves.find(s => s.dataset.src === frontSrc) || sleeves[0] || null;
    layout(false);
    sync();
    if (near) prefetch();
  }
  window.AlcoveRecordPlayer = {
    setSongs,
    getSongs: () => sleeves.map(s => ({ title: titleOf(s), file: s.dataset.src })),
  };
  sleeves.forEach(markArt);
  if (Array.isArray(window.__alcoveSongs)) setSongs(window.__alcoveSongs, true);
})();
