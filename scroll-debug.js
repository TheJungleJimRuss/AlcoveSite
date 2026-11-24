// Scroll jump probe (dev only): open any page with ?scrolldebug on the phone, scroll until the page jumps, then
// screenshot the panel. Logs big scrollY jumps between frames, every script-driven scroll (with the calling file:line),
// viewport resizes, and layout height changes. Loaded by fader.js only when the URL has ?scrolldebug.
(() => {
  const lines = [];
  const panel = document.createElement('pre');
  panel.style.cssText = 'position:fixed;z-index:10050;top:calc(env(safe-area-inset-top,0px) + 4px);left:4px;right:52px;max-height:46vh;overflow:auto;margin:0;padding:6px;font:10px/1.35 ui-monospace,Menlo,monospace;color:#0f0;background:rgb(0 0 0 / .82);border-radius:6px;pointer-events:auto;white-space:pre-wrap';
  const t0 = performance.now();
  const log = (msg) => {
    lines.push(`${((performance.now() - t0) / 1000).toFixed(2)} ${msg}`);
    if (lines.length > 40) lines.shift();
    panel.textContent = lines.slice().reverse().join('\n');
  };
  const caller = () => {
    const st = (new Error().stack || '').split('\n').map(l => l.trim()).filter(l => !/scroll-debug/.test(l) && /:\d+/.test(l));
    return (st[0] || '?').replace(location.origin + '/', '').slice(0, 70);
  };
  const wrap = (obj, name) => {
    const orig = obj[name]; if (!orig) return;
    obj[name] = function (...a) { log(`CALL ${name}(${JSON.stringify(a).slice(0, 50)}) from ${caller()}`); return orig.apply(this, a); };
  };
  wrap(window, 'scrollTo'); wrap(window, 'scrollBy'); wrap(window, 'scroll');
  wrap(Element.prototype, 'scrollIntoView'); wrap(Element.prototype, 'scrollTo'); wrap(Element.prototype, 'scrollBy');
  wrap(HTMLElement.prototype, 'focus');
  const d = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
  Object.defineProperty(Element.prototype, 'scrollTop', { configurable: true, get() { return d.get.call(this); },
    set(v) { log(`SET scrollTop=${v} on ${this.tagName.toLowerCase()}${this.className ? '.' + String(this.className).split(' ')[0] : ''} from ${caller()}`); d.set.call(this, v); } });

  let lastY = scrollY, lastH = document.documentElement.scrollHeight, touching = false;
  addEventListener('touchstart', () => { touching = true; }, { passive: true });
  addEventListener('touchend', () => { touching = false; }, { passive: true });
  const frame = () => {
    const y = scrollY, h = document.documentElement.scrollHeight;
    if (Math.abs(y - lastY) > 120) log(`JUMP y ${Math.round(lastY)} -> ${Math.round(y)} ${touching ? '(finger down)' : '(momentum)'}`);
    if (h !== lastH) log(`HEIGHT ${lastH} -> ${h} at y=${Math.round(y)}`);
    lastY = y; lastH = h;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  const vv = window.visualViewport;
  addEventListener('resize', () => log(`RESIZE inner ${innerWidth}x${innerHeight}${vv ? ` vv ${Math.round(vv.height)} top ${Math.round(vv.offsetTop)}` : ''} y=${Math.round(scrollY)}`));
  addEventListener('pageshow', (e) => log(`PAGESHOW persisted=${e.persisted}`));
  log(`start ${navigator.userAgent.match(/OS [\d_]+|Version\/[\d.]+/g)?.join(' ') || ''} inner ${innerWidth}x${innerHeight}`);
  document.body.append(panel);
})();
