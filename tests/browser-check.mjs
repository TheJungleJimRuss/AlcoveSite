// Loads each page at phone/tablet/desktop widths; fails on console errors or horizontal overflow.
// Run: npx -y -p playwright node tests/browser-check.mjs   (needs `npx playwright install chromium` once)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    const body = await readFile(join(root, path === '/' ? 'index.html' : decodeURIComponent(path)));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const pages = ['index', 'work', 'about', 'contact'];
const widths = { phone: [375, 812], tablet: [768, 1024], desktop: [1280, 800] };
const browser = await chromium.launch();
let failures = 0;
for (const [name, [w, h]] of Object.entries(widths)) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', e => errors.push(e.message));
  for (const p of pages) {
    errors.length = 0;
    await page.goto(`${base}/${p}.html`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    // nav hover/active must not shift layout
    let shift = 0;
    for (const a of await page.locator('.site-header .nav-links a').all()) {
      if (!(await a.isVisible())) continue;
      if (!(await a.evaluate(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; }))) continue;
      const before = await a.boundingBox(); await a.hover(); await page.waitForTimeout(150);
      const after = await a.boundingBox(); shift += Math.abs(before.x - after.x) + Math.abs(before.width - after.width) + Math.abs(before.height - after.height);
    }
    const ok = errors.length === 0 && overflow <= 0 && shift < 0.5;
    if (shift >= 0.5) errors.push(`nav hover layout shift ${shift}`);
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${p}.html @ ${name} (${w}px) overflow=${overflow} errors=${errors.length}`, errors.join('; '));
  }
  await page.close();
}
await browser.close(); server.close();
process.exit(failures ? 1 : 0);
