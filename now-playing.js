// Live waveform in the middle of the site header while any audio plays.
// One shared AudioContext; each media element is routed through it once (Web Audio allows one source per element).
// Needs http(s): on file:// the element would be muted, so the wave falls back to a still shape.
(function () {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const wrap = document.createElement('div');
  wrap.className = 'nav-wave';
  wrap.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  wrap.appendChild(canvas);
  header.appendChild(wrap);
  const g = canvas.getContext('2d');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canAnalyse = /^https?:$/.test(location.protocol) && (window.AudioContext || window.webkitAudioContext);

  let ctx, analyser, data, current = null, raf = 0, gain = 1.6;
  const sources = new WeakMap();

  // Stretch the wave across the free space between the logo and the nav, centered, up to a cap.
  const fit = () => {
    const h = header.getBoundingClientRect(), cx = h.left + h.width / 2, gap = 24;
    const logo = header.querySelector('.logo-placeholder');
    const nav = header.querySelector('.nav-links');
    const left = logo ? logo.getBoundingClientRect().right : h.left;
    const nr = nav && nav.getBoundingClientRect();
    // On phones the nav is the fixed bottom tab bar, so it doesn't share the header row.
    const navInRow = nr && nr.width && nr.top < h.bottom && nr.bottom > h.top;
    // On phones the nav is the bottom tab bar, so the space runs to the header's edge.
    const right = navInRow ? nr.left : h.right - 16;
    const centered = 2 * Math.min(cx - left, right - cx) - 2 * gap;
    if (centered >= 200) {
      // Wide screens: stay centered in the bar.
      wrap.style.insetInlineStart = '';
      wrap.style.inlineSize = Math.min(416, centered) + 'px';
    } else {
      // Tablets and phones: the true center is cramped, so fill the gap between logo and nav.
      wrap.style.insetInlineStart = ((left + right) / 2 - h.left) + 'px';
      wrap.style.inlineSize = Math.max(64, Math.min(416, right - left - 2 * gap)) + 'px';
    }
  };
  const size = () => {
    fit();
    // Layout size, not getBoundingClientRect: the intro `scale` transition would shrink the bitmap and stretch the line thick.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(canvas.offsetWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.offsetHeight * dpr));
  };
  // The accent colour is read once and again only when the palette can have changed (getComputedStyle every frame
  // cost ~60 ms/s at 20x CPU throttle while audio played).
  let strokeColor = null;
  const stroke = () => strokeColor || (strokeColor = getComputedStyle(header).getPropertyValue('--accent-primary').trim() || 'currentColor');
  new MutationObserver(() => { strokeColor = null; }).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-scheme', 'data-palette'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { strokeColor = null; });

  function drawLine(sample) {
    const w = canvas.width, h = canvas.height, n = Math.max(96, Math.round(w / 6));
    g.clearRect(0, 0, w, h);
    g.lineWidth = 2 * (window.devicePixelRatio || 1);
    g.lineJoin = g.lineCap = 'round';
    g.strokeStyle = stroke();
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * w;
      const edge = Math.sin((i / n) * Math.PI); // taper to the ends
      const y = h / 2 + sample(i / n) * edge * (h / 2 - g.lineWidth);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
  const still = () => drawLine(t => 0.55 * Math.sin(t * Math.PI * 7) * Math.cos(t * Math.PI * 2.3));

  function connect(el) {
    if (!canAnalyse || reduceMotion || sources.has(el)) return;
    try {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.connect(ctx.destination);
        data = new Uint8Array(analyser.fftSize);
      }
      const src = ctx.createMediaElementSource(el);
      src.connect(analyser);
      sources.set(el, src);
    } catch (e) { sources.set(el, null); }
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!analyser || !sources.get(current)) { still(); return; }
    analyser.getByteTimeDomainData(data);
    const len = data.length;
    // Auto-gain: scale quiet audio up so the line fills its height, eased so it doesn't pump.
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
    gain += (Math.min(6, 0.85 / Math.max(peak, 0.04)) - gain) * 0.08;
    drawLine(t => Math.max(-1, Math.min(1, ((data[Math.min(len - 1, Math.floor(t * len))] - 128) / 128) * gain)));
  }

  const isAudible = el => el instanceof HTMLMediaElement && !el.muted && !el.paused;
  function update() {
    current = [...document.querySelectorAll('audio, video')].find(isAudible) || null;
    wrap.classList.toggle('is-on', !!current);
    cancelAnimationFrame(raf);
    if (!current) return;
    size();
    if (reduceMotion) still(); else loop();
  }

  document.addEventListener('play', e => {
    connect(e.target);
    if (ctx && ctx.state === 'suspended') ctx.resume();
    update();
  }, true);
  ['pause', 'ended', 'emptied', 'volumechange'].forEach(ev => document.addEventListener(ev, update, true));
  window.addEventListener('resize', () => { if (current) size(); });
  // Re-fit when the logo or nav changes width (late web fonts, nav-switch layout).
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => { if (current) size(); });
    [header, header.querySelector('.logo-placeholder'), header.querySelector('.nav-links')].forEach(el => el && ro.observe(el));
  }
  const refit = () => { if (current) size(); };
  window.addEventListener('load', refit);
  if (document.fonts) document.fonts.ready.then(refit);
})();
