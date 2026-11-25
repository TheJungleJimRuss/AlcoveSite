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
    // Touch/pen use the touch handlers below: with absolute pointer positions, iOS 26 threw the page between the top
    // and the end mid-drag (caught with an on-device scroll log, 2026-11-24).
    if (e.pointerType !== 'mouse') { wake(); return; }
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

  // Touch drag (phones): only the visible cap grabs (CSS makes the strip click-through, so a swipe there scrolls the
  // page). The cap moves by the finger's step-to-step travel, never by absolute positions, and a step that implies a
  // leap is dropped: while the page scrolls under the finger iOS can report a coordinate from the scrolled frame,
  // and one such value used to send the page to an end. Scrolling is applied once per frame.
  const MAX_STEP = 90; // px of finger travel in one touchmove; anything bigger is a bogus coordinate
  let touchId = null, lastTouchY = 0, frame = 0, lastSet = -1;
  // iOS: once Safari owns a touch as a page scroll (e.g. the thumb lands while the page still coasts), it ignores
  // preventDefault, so the page scrolls one way under the finger while the fader drives it the other (the "jump").
  // The fader only drives while it truly owns the touch, and gives up the moment the page moves on its own.
  const abortTouch = () => {
    if (touchId === null) return;
    touchId = null; lastSet = -1;
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    end();
  };
  cap.addEventListener('touchstart', (e) => {
    if (!e.cancelable) return; // Safari is already scrolling the page: let it have this touch
    if (touchId !== null || e.touches.length > 1 || fader.classList.contains('is-idle') || fader.classList.contains('is-away')) return;
    const t = e.changedTouches[0];
    touchId = t.identifier; lastTouchY = t.clientY;
    dragMax = maxScroll(); dragTravel = travel();
    dragRatio = dragMax ? Math.min(1, Math.max(0, scrollY / dragMax)) : 0;
    dragging = true;
    root.style.scrollBehavior = 'auto';
    drive(true); wake();
    e.preventDefault();
  }, { passive: false });
  fader.addEventListener('touchmove', (e) => {
    if (touchId === null) return;
    const t = [...e.changedTouches].find((x) => x.identifier === touchId);
    if (!t) return;
    if (!e.cancelable) { abortTouch(); return; } // native scroll took over mid-drag
    e.preventDefault();
    const dy = t.clientY - lastTouchY;
    lastTouchY = t.clientY;
    if (Math.abs(dy) > MAX_STEP) return;
    dragRatio = Math.min(1, Math.max(0, dragRatio + dy / dragTravel));
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      if (lastSet >= 0 && Math.abs(scrollY - lastSet) > 4) { abortTouch(); return; } // something else scrolled the page
      const target = Math.round(dragRatio * dragMax);
      scrollToY(target, false); lastSet = Math.min(Math.max(0, target), maxScroll()); update();
    });
  }, { passive: false });
  const touchEnd = (e) => {
    if (touchId === null || ![...e.changedTouches].some((x) => x.identifier === touchId)) return;
    if (frame) { cancelAnimationFrame(frame); frame = 0; scrollToY(dragRatio * dragMax, false); }
    touchId = null; lastSet = -1;
    end();
  };
  fader.addEventListener('touchend', touchEnd);
  fader.addEventListener('touchcancel', touchEnd);

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
