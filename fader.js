// Console-style scroll fader: mirrors page scroll, draggable, keyboard operable. Without JS the native scrollbar stays.
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fader = document.createElement('div');
  fader.className = 'fader';
  fader.setAttribute('role', 'slider');
  fader.setAttribute('tabindex', '0');
  fader.setAttribute('aria-orientation', 'vertical');
  fader.setAttribute('aria-label', 'Page scroll position');
  fader.setAttribute('aria-valuemin', '0');
  fader.setAttribute('aria-valuemax', '100');
  fader.innerHTML = '<span class="fader-plate" aria-hidden="true"></span><span class="fader-slot" aria-hidden="true"></span><span class="fader-cap" aria-hidden="true"></span>';
  const cap = fader.querySelector('.fader-cap');
  document.body.append(fader);
  root.classList.add('has-fader');

  const maxScroll = () => Math.max(0, root.scrollHeight - root.clientHeight);
  const travel = () => Math.max(1, fader.clientHeight - cap.offsetHeight);
  let dragging = false, dragRatio = 0, dragMax = 0, dragTravel = 1, dragOffset = 0, driveTimer, idleTimer;
  // Phones: fade the fader out after a short idle; scroll, touch or focus brings it back.
  const phone = matchMedia('(max-width: 640px)');
  function wake() {
    fader.classList.remove('is-idle');
    clearTimeout(idleTimer);
    if (phone.matches) idleTimer = setTimeout(() => {
      if (!dragging && document.activeElement !== fader) fader.classList.add('is-idle');
    }, 1500);
  }
  // Flag that the fader is driving scroll so scroll-linked effects (home velocity bypass) don't change layout mid-move.
  function drive(on, linger = 0) {
    clearTimeout(driveTimer);
    if (on) root.dataset.faderDrive = '1';
    else driveTimer = setTimeout(() => delete root.dataset.faderDrive, linger);
  }

  // Runs once per scrolled frame, so it writes only what changed (perf pass 4): the cap moves in whole device
  // pixels through its own transform, and the ARIA value changes only when the whole percent does.
  const hero = document.querySelector('.hero-wordmark-viewport');
  let lastY = -1, lastPct = -1;
  function update() {
    const max = maxScroll();
    if (fader.hidden !== (max <= 0)) fader.hidden = max <= 0;
    // Stay on screen everywhere except the initial viewport (hero) of the home page.
    fader.classList.toggle('is-away', !!hero && scrollY < hero.offsetHeight * 0.45);
    // While dragging the cap follows the finger, not the scroll position: iOS reports shifting innerHeight and
    // rubber-band scrollY mid-drag, which made the cap (and page) jump.
    const ratio = dragging ? dragRatio : max ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    const dpr = devicePixelRatio || 1;
    const y = Math.round(ratio * travel() * dpr) / dpr;
    if (y !== lastY) { lastY = y; cap.style.transform = `translateY(${y}px)`; }
    const pct = Math.round(ratio * 100);
    if (pct !== lastPct) {
      lastPct = pct;
      fader.setAttribute('aria-valuenow', pct);
      fader.setAttribute('aria-valuetext', `${pct}% down the page`);
    }
  }
  let queued = false;
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } };

  function scrollToY(y, smooth) {
    scrollTo({ top: Math.min(maxScroll(), Math.max(0, y)), behavior: smooth && !reduce.matches ? 'smooth' : 'instant' });
  }

  fader.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    // Touch/pen: only a grab on the visible cap drags. A thumb swiping near the right edge used to land on the
    // (invisible) strip and jump the page to that spot, fighting the native scroll (iPhone "jumps back" bug).
    if (e.pointerType !== 'mouse' && (e.target !== cap || fader.classList.contains('is-idle'))) { wake(); return; }
    dragging = true;
    fader.setPointerCapture(e.pointerId);
    e.preventDefault(); // no focus ring or text selection from a click
    const capRect = cap.getBoundingClientRect();
    dragOffset = e.target === cap ? e.clientY - capRect.top : capRect.height / 2;
    dragMax = maxScroll(); dragTravel = travel();
    root.style.scrollBehavior = 'auto'; // the page's smooth scrolling would chase every touch move
    drive(true);
    wake();
    move(e);
  });
  function move(e) {
    // clientY and the fader's rect are both read live, so they shift together when Safari's toolbars collapse
    // mid-drag. (screenY is not usable: iOS reports it in a scrolling frame, which ran the page to the ends.)
    const top = fader.getBoundingClientRect().top;
    dragRatio = Math.min(1, Math.max(0, (e.clientY - top - dragOffset) / travel()));
    scrollToY(dragRatio * dragMax, false);
    schedule();
  }
  fader.addEventListener('pointermove', (e) => { if (dragging) move(e); });
  const end = () => { dragging = false; root.style.scrollBehavior = ''; schedule(); drive(false, 200); wake(); };
  fader.addEventListener('pointerup', end);
  fader.addEventListener('pointercancel', end);

  fader.addEventListener('keydown', (e) => {
    const page = innerHeight * 0.9;
    const keys = {
      ArrowDown: () => scrollY + 60, ArrowRight: () => scrollY + 60,
      ArrowUp: () => scrollY - 60, ArrowLeft: () => scrollY - 60,
      PageDown: () => scrollY + page, PageUp: () => scrollY - page,
      Home: () => 0, End: () => maxScroll()
    };
    if (!keys[e.key]) return;
    e.preventDefault();
    drive(true); drive(false, 900);
    scrollToY(keys[e.key](), true);
  });
  fader.addEventListener('focus', wake);
  fader.addEventListener('blur', wake);
  addEventListener('scroll', () => { schedule(); wake(); }, { passive: true });
  phone.addEventListener('change', wake);
  addEventListener('resize', schedule);
  new ResizeObserver(schedule).observe(document.body);
  update();
  wake();
})();
