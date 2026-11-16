// Work page: A/B deck for "Voice Memo vs. Finished Master".
// One transport, two clips, a tape-deck slide switch (role="switch"); sliding keeps the playhead position.
// Both clips are fetched whole into memory (blob URLs) so seeking works in every browser,
// even on hosts that ignore HTTP Range requests (Safari restarts at 0:00 there otherwise).
(function () {
  const root = document.querySelector('.ab-player');
  if (!root) return;
  const section = root.closest('.ab-compare') || root;
  const tracks = {};
  root.querySelectorAll('audio[data-version]').forEach(a => { tracks[a.dataset.version] = a; });
  const fallback = { memo: 'Voice Memo', master: 'Finished Master' };
  // Names come from the table's column headers so an edited wording shows up on the deck too.
  const names = new Proxy(fallback, { get: (t, v) => (section.querySelector(`th[data-version="${v}"]`)?.textContent.trim()) || t[v] });
  const slide = root.querySelector('.ab-slide');
  const playBtn = root.querySelector('.ab-play');
  const seek = root.querySelector('.ab-seek');
  const timeEl = root.querySelector('.ab-time');
  const durEl = root.querySelector('.ab-dur');
  const label = root.querySelector('.deck-label');
  let version = 'memo';
  let active = tracks[version];
  let pendingTime = null; // a seek waiting for the clip to load

  const fetchClip = u => fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); });
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

  // Start loading as the section approaches the viewport, or on first interaction.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { io.disconnect(); load(); }
    }, { rootMargin: '600px 0px' });
    io.observe(section);
  } else load();

  const fmt = t => (isFinite(t) ? Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0') : '0:00');
  function sync() {
    const on = !active.paused;
    playBtn.textContent = on ? '⏸︎' : '▶︎';
    playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
    root.dataset.playing = on;
    label.textContent = (on ? 'Now playing: ' : '') + names[version];
    const t = pendingTime ?? active.currentTime;
    timeEl.textContent = fmt(t);
    durEl.textContent = fmt(active.duration);
    seek.max = active.duration || 0;
    seek.value = t;
    seek.style.setProperty('--pct', (active.duration ? t / active.duration * 100 : 0) + '%');
  }

  // Seek now if the clip can, otherwise as soon as its data arrives.
  function seekTo(el, t, then) {
    const apply = () => {
      el.currentTime = Math.min(t, el.duration || t);
      pendingTime = null;
      if (then) then();
    };
    if (el.readyState >= 1) apply();
    else {
      pendingTime = t;
      el.addEventListener('loadedmetadata', apply, { once: true });
      if (!el.src) load();
      else { el.preload = 'auto'; el.load(); }
    }
  }

  function setVersion(v) {
    if (v === version || !tracks[v]) return;
    const next = tracks[v];
    const wasPlaying = !active.paused;
    const t = pendingTime ?? active.currentTime;
    active.pause();
    active = next;
    version = v;
    slide.setAttribute('aria-checked', String(v === 'master'));
    section.dataset.version = v;
    seekTo(next, t, wasPlaying ? () => next.play().catch(() => {}) : null);
    sync();
  }

  slide.addEventListener('click', () => setVersion(version === 'memo' ? 'master' : 'memo'));
  slide.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setVersion('memo'); }
    if (e.key === 'ArrowRight') { e.preventDefault(); setVersion('master'); }
  });
  root.querySelectorAll('.ab-slide-label[data-version]').forEach(l =>
    l.addEventListener('click', () => setVersion(l.dataset.version)));

  playBtn.addEventListener('click', () => {
    if (!active.paused) { active.pause(); return; }
    if (active.src) { active.play().catch(() => {}); return; }
    // Not loaded yet: stream this clip right away so play() stays inside the click.
    Object.values(tracks).forEach(a => { if (!a.src) { a.preload = 'auto'; a.src = a.dataset.src; } });
    active.play().catch(() => {});
  });
  seek.addEventListener('input', () => {
    if (active.readyState >= 1) active.currentTime = seek.valueAsNumber;
  });

  Object.values(tracks).forEach(a => {
    ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata', 'seeked'].forEach(ev =>
      a.addEventListener(ev, () => { if (a === active) sync(); }));
  });
  section.dataset.version = version;
  sync();
})();
