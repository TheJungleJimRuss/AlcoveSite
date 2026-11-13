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
  t(`${label}: dragging cap to bottom scrolls page to bottom`, await y() >= await max() - 2, `y=${await y()} max=${await max()}`);
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
