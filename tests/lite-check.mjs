// Lite mode (html[data-lite], content-loader.js): how it switches on, and what it turns off.
// Run: node tests/lite-check.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.webm': 'video/webm' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    const body = await readFile(join(root, path === '/' ? 'index.html' : decodeURIComponent(path)));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}`;
let failures = 0;
const check = (ok, name, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${info}`); if (!ok) failures++; };
const browser = await chromium.launch();
async function open(path, init) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/' + path);
  return { ctx, page, errors };
}
const lite = page => page.evaluate(() => document.documentElement.getAttribute('data-lite'));
const fx = page => page.evaluate(() => {
  const h = document.querySelector('.hero-media');
  return {
    sheen: getComputedStyle(document.body, '::after').display,
    film: getComputedStyle(document.documentElement, '::after').content,
    film_attr: document.documentElement.getAttribute('data-film'),
    hero: h ? getComputedStyle(h).animationName : null,
    word: (document.querySelector('h1.studio-wordmark') && getComputedStyle(document.querySelector('h1.studio-wordmark')).filter) || null,
  };
});

{ // default under automation: off, effects as authored (film grain follows Site Defaults, forced on here)
  const { ctx, page, errors } = await open('index.html?film=subtle');
  const f = await fx(page);
  check(await lite(page) === null, 'off by default (probe never runs under automation)');
  check(f.sheen !== 'none' && f.film === '""', 'without lite: sheen and film grain are on', JSON.stringify(f));
  check(errors.length === 0, 'no page errors', errors.join(' | '));
  await ctx.close();
}
{ // ?lite turns everything heavy off, and carries to the next page
  const { ctx, page, errors } = await open('index.html?lite&film=subtle');
  const f = await fx(page);
  check(await lite(page) === 'url', '?lite switches it on');
  check(f.sheen === 'none', 'lite: fixed metal sheen is gone', f.sheen);
  check(f.film === 'none', 'lite: film grain layer is gone even when Site Defaults turn it on', f.film);
  check(f.hero === 'none', 'lite: hero parallax animation is off', f.hero);
  await page.goto(base + '/about.html');
  check(await lite(page) === 'url', 'lite carries to the next page for the visit');
  await page.mouse.move(300, 300);
  const card = page.locator('.card').first();
  if (await card.count()) {
    const b = await card.boundingBox(); await card.scrollIntoViewIfNeeded(); await page.mouse.move(b.x + 10, b.y + 10); await page.mouse.move(b.x + b.width - 10, b.y + 20);
    check(await card.evaluate(el => el.style.getPropertyValue('--tx')) === '', 'lite: cards do not tilt toward the pointer');
  }
  await page.goto(base + '/work.html');
  await page.evaluate(() => document.getElementById('cassette-stage').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(800);
  const c = await page.evaluate(() => ({ deck: getComputedStyle(document.querySelector('.cd-deck')).display, canvas: !!document.querySelector('#cassette-stage canvas') }));
  check(c.deck !== 'none' && !c.canvas, 'lite: Work shows the image cassette deck', JSON.stringify(c));
  const three = await page.evaluate(() => performance.getEntriesByType('resource').some(r => /three|\.glb/.test(r.name)));
  check(!three, 'lite: no three.js or GLB requests');
  await page.goto(base + '/index.html?lite=0');
  check(await lite(page) === null, '?lite=0 switches it off');
  await page.goto(base + '/about.html');
  check(await lite(page) === null, '?lite=0 also carries for the visit');
  check(errors.length === 0, 'no page errors', errors.join(' | '));
  await ctx.close();
}
{ // device signals
  let { ctx, page } = await open('index.html', () => Object.defineProperty(navigator, 'connection', { get: () => ({ saveData: true, effectiveType: '4g' }) }));
  check(await lite(page) === 'save-data', 'Save-Data switches it on');
  await ctx.close();
  ({ ctx, page } = await open('index.html', () => Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 })));
  check(await lite(page) === 'low-memory', '2 GB device memory switches it on');
  await ctx.close();
  ({ ctx, page } = await open('index.html', () => { Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 }); Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }); }));
  check(await lite(page) === null, '8 GB / 8 cores stays full');
  await ctx.close();
  ({ ctx, page } = await open('index.html', () => Object.defineProperty(navigator, 'connection', { get: () => ({ saveData: false, effectiveType: '2g' }) })));
  check(await lite(page) === 'slow-network', '2G connection switches it on');
  await ctx.close();
}
{ // frame probe: a page that only manages ~20 fps switches to lite after load and remembers it for the visit
  const slow = () => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    const burn = () => { const t = performance.now(); while (performance.now() - t < 40); requestAnimationFrame(burn); };
    requestAnimationFrame(burn);
  };
  let { ctx, page } = await open('about.html', slow);
  await page.waitForFunction(() => document.documentElement.getAttribute('data-lite') === 'slow-frames', null, { timeout: 8000 }).catch(() => {});
  check(await lite(page) === 'slow-frames', 'frame probe: a slow page switches to lite after load');
  await ctx.close();
  ({ ctx, page } = await open('about.html', () => Object.defineProperty(navigator, 'webdriver', { get: () => false })));
  await page.waitForTimeout(3000);
  check(await lite(page) === null, 'frame probe: a smooth page stays full');
  await ctx.close();
}
await browser.close(); server.close();
console.log(failures ? `\n${failures} failure(s)` : '\nall lite checks passed');
process.exit(failures ? 1 : 0);
