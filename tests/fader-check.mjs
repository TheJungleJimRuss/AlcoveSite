// Fader behavior: mirrors scroll, drag scrolls, keys scroll, mobile target/idle hide, no-JS fallback.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(fileURLToPath(import.meta.url), '..', '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer(async (req, res) => {
  try { const p = new URL(req.url, 'http://x').pathname; const b = await readFile(join(root, decodeURIComponent(p)));
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); } }).listen(0);
const base = `http://localhost:${server.address().port}`;
let fails = 0;
const t = (name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const browser = await chromium.launch();

for (const [label, vp, mobile] of [['desktop', { width: 1280, height: 800 }, false], ['phone', { width: 375, height: 700 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/index.html`);
  const fader = page.locator('.fader'); const cap = page.locator('.fader-cap');
  t(`${label}: fader present with slider role`, await fader.count() === 1 && await fader.getAttribute('role') === 'slider');
  const max = () => page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const y = () => page.evaluate(() => scrollY);
  const val = async () => +(await fader.getAttribute('aria-valuenow'));
  // scroll -> fader
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(200);
  t(`${label}: fader follows scroll to bottom`, await val() >= 99, `valuenow=${await val()}`);
  // keyboard
  await page.evaluate(() => document.querySelector('.fader').focus());
  await page.keyboard.press('Home'); await page.waitForTimeout(800);
  t(`${label}: Home key scrolls to top`, await y() === 0, `y=${await y()}`);
  await page.keyboard.press('End'); await page.waitForTimeout(1200);
  t(`${label}: End key scrolls to bottom`, Math.abs(await y() - await max()) < 2);
  await page.keyboard.press('PageUp'); await page.waitForTimeout(1200);
  t(`${label}: PageUp scrolls up`, await y() < await max() - 100);
  // hero: the fader is hidden and not clickable while the home hero fills the view
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(300);
  t(`${label}: fader hidden on home hero`, await page.evaluate(() => { const f = document.querySelector('.fader'), cs = getComputedStyle(f);
    return f.classList.contains('is-away') && cs.pointerEvents === 'none'; }));
  // drag (start just past the hero, where the fader shows)
  const pastHero = () => page.evaluate(() => scrollTo({ top: Math.ceil(document.querySelector('.hero-wordmark-viewport').offsetHeight * 0.5), behavior: 'instant' }));
  await pastHero(); await page.waitForTimeout(400);
  t(`${label}: fader shows past the hero`, await page.evaluate(() => !document.querySelector('.fader').classList.contains('is-away')));
  if (mobile) await page.evaluate(() => document.querySelector('.fader').dispatchEvent(new Event('focus')));
  const cb = await cap.boundingBox(), fb = await fader.boundingBox();
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.mouse.down();
  await page.mouse.move(cb.x + cb.width / 2, fb.y + fb.height - 2, { steps: 8 });
  await page.mouse.up(); await page.waitForTimeout(300);
  if (mobile) {
    // Touch screens: the mouse path is ignored; only a touch on the visible cap drags, by relative steps.
    t('phone: strip is click-through, only the cap is grabbable', await page.evaluate(() => getComputedStyle(document.querySelector('.fader')).pointerEvents === 'none'));
    await pastHero(); await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('.fader').dispatchEvent(new Event('focus')));
    const c = await cap.boundingBox(); const cx = c.x + c.width / 2; let cy = c.y + c.height / 2;
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, yy) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: cx, y: yy, id: 1 }] });
    const start = await y(); await touch('touchStart', cy);
    const seen = [start]; let back = 0;
    for (let i = 0; i < 20; i++) { cy += 6; await touch('touchMove', cy); await page.waitForTimeout(32); const v = await y(); if (v < seen.at(-1) - 1) back++; seen.push(v); }
    await touch('touchEnd'); await page.waitForTimeout(200);
    const moved = seen.at(-1) - start;
    t('phone: touch-dragging the cap scrolls the page down', moved > 50, `start=${start} end=${seen.at(-1)}`);
    t('phone: touch drag never scrolls backwards', back === 0, `back=${back}`);
    t('phone: touch drag does not throw the page to the end', seen.at(-1) < await max() - 50, `end=${seen.at(-1)} max=${await max()}`);
    // iOS taking the gesture as a page scroll (touchmove no longer cancelable): the fader must let go at once.
    await pastHero(); await page.waitForTimeout(400);
    const r = await page.evaluate(async () => {
      const f = document.querySelector('.fader'), cap = f.querySelector('.fader-cap'); f.dispatchEvent(new Event('focus'));
      const b = cap.getBoundingClientRect(); let cy = b.top + b.height / 2; const x = b.left + b.width / 2;
      const fire = (type, cancelable) => { const t = new Touch({ identifier: 7, target: cap, clientX: x, clientY: cy });
        cap.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable, touches: type === 'touchend' ? [] : [t], changedTouches: [t] })); };
      const frame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      fire('touchstart', true);
      for (let i = 0; i < 3; i++) { cy += 6; fire('touchmove', true); await frame(); }
      cy += 6; fire('touchmove', false); await frame();
      const before = scrollY;
      for (let i = 0; i < 5; i++) { cy += 6; fire('touchmove', true); await frame(); }
      fire('touchend', true); await frame();
      return { before, after: scrollY };
    });
    t('phone: fader lets go when Safari takes the touch as a page scroll', Math.abs(r.after - r.before) < 2, JSON.stringify(r));
  } else t(`${label}: dragging cap to bottom scrolls page to bottom`, await y() >= await max() - 2, `y=${await y()} max=${await max()}`);
  // jitter: dragging across the home fold must not change page height or make the cap move backwards
  await pastHero(); await page.waitForTimeout(400);
  const cb2 = await cap.boundingBox(); const x = cb2.x + cb2.width / 2;
  await page.mouse.move(x, cb2.y + cb2.height / 2); await page.mouse.down();
  const heights = new Set(); let lastY = -1, backwards = 0;
  for (let i = 0; i <= 60; i++) {
    await page.mouse.move(x, cb2.y + cb2.height / 2 + i * 3, { steps: 1 });
    await page.waitForTimeout(16);
    heights.add(await page.evaluate(() => document.documentElement.scrollHeight));
    const cy = (await cap.boundingBox()).y; if (cy < lastY - 0.5) backwards++; lastY = cy;
  }
  await page.mouse.up();
  t(`${label}: no page-height change while dragging past the fold`, heights.size === 1, `heights=${[...heights]}`);
  t(`${label}: cap never jumps backwards while dragging down`, backwards === 0, `backwards=${backwards}`);
  // size + overflow
  t(`${label}: touch target >= 44px`, fb.width >= 44, `w=${fb.width}`);
  t(`${label}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  t(`${label}: native scrollbar hidden`, await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth === 'none'));
  t(`${label}: body keeps vertical touch scrolling`, await page.evaluate(() => getComputedStyle(document.body).touchAction !== 'none'));
  if (mobile) {
    await page.evaluate(() => document.activeElement.blur()); await page.waitForTimeout(2200);
    t('phone: fader hides when idle', await page.evaluate(() => +getComputedStyle(document.querySelector('.fader')).opacity) === 0);
    const tab = await page.evaluate(() => { const f = document.querySelector('.fader').getBoundingClientRect(), n = document.querySelector('.nav-links').getBoundingClientRect(); return f.bottom <= n.top + 1; });
    t('phone: fader stays above bottom tab bar', tab);
    // A thumb landing on the strip (idle, or off the cap) must not jump the page (iPhone "jumps back" bug).
    await page.evaluate(() => scrollTo({ top: 2000, behavior: 'instant' })); await page.waitForTimeout(100);
    const strip = await page.evaluate(() => { const f = document.querySelector('.fader').getBoundingClientRect(); return { x: f.x + f.width / 2, y: f.y + 8 }; });
    const before = await page.evaluate(() => scrollY);
    await page.touchscreen.tap(strip.x, strip.y); await page.waitForTimeout(150);
    const after = await page.evaluate(() => scrollY);
    t('phone: touch on the idle strip does not jump the page', Math.abs(after - before) < 2, `${before} -> ${after}`);
    t('phone: strip allows native vertical pan', await page.evaluate(() => getComputedStyle(document.querySelector('.fader')).touchAction === 'pan-y'));
    t('phone: film grain sits under the bars', await page.evaluate(() => {
      const root = document.documentElement; if (!root.dataset.film) root.dataset.film = 'subtle';
      return +getComputedStyle(root, '::after').zIndex < 100; }));
    t('phone: tab bar colour extends below the bar', await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('.site-header nav'), '::after');
      return s.content !== 'none' && s.backgroundColor === getComputedStyle(document.querySelector('.site-header nav')).backgroundColor; }));
  }
  t(`${label}: no page errors`, errors.length === 0, errors.join(';'));
  await ctx.close();
}
// reduced motion: keys scroll instantly
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }); const page = await ctx.newPage();
  await page.goto(`${base}/index.html`); await page.evaluate(() => document.querySelector('.fader').focus());
  await page.keyboard.press('End'); await page.waitForTimeout(50);
  t('reduced-motion: End scrolls instantly', await page.evaluate(() => scrollY > 100));
  await ctx.close();
}
// no JS: native scrollbar remains
{
  const ctx = await browser.newContext({ javaScriptEnabled: false }); const page = await ctx.newPage();
  await page.goto(`${base}/index.html`);
  t('no-JS: no fader and native scrollbar not hidden', await page.locator('.fader').count() === 0 && !(await page.evaluate(() => document.documentElement.classList.contains('has-fader'))));
  await ctx.close();
}
await browser.close(); server.close(); process.exit(fails ? 1 : 0);
