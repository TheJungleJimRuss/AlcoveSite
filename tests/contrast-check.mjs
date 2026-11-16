// AA contrast of text on its effective background across the four themes.
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
const themes = ['seth-olive-orange', 'seth-olive-orange-dark', 'seth-sage-coral', 'seth-sage-coral-dark'];
const browser = await chromium.launch(); const page = await browser.newPage();
let fails = 0;
for (const t of themes) for (const f of ['retro-display']) for (const p of ['index', 'work', 'about', 'contact']) {
  await page.goto(`${base}/${p}.html?theme=${t}&font=${f}`);
  await page.waitForTimeout(700); // let theme + color transitions settle
  const bad = await page.evaluate(() => {
    const cv = document.createElement('canvas').getContext('2d');
    const rgba = c => { cv.clearRect(0,0,1,1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0,0,1,1); const d = cv.getImageData(0,0,1,1).data; return [d[0],d[1],d[2],d[3]/255]; };
    const lum = ([r,g,b]) => { const f = v => (v/=255) <= .03928 ? v/12.92 : ((v+.055)/1.055)**2.4; return .2126*f(r)+.7152*f(g)+.0722*f(b); };
    const out = [];
    for (const el of document.querySelectorAll('h1,h2,h3,h4,p,li,label,a,button,span')) {
      if (el.closest('.hero-wordmark, .studio-wordmark, .hero-nav, .scroll-cue, .site-header--smart, [class*=hero]')) continue;
      if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || !el.offsetParent && cs.position !== 'fixed') continue;
      let bg = [255,255,255], layers = [], stops = [];
      for (let n = el; n; n = n.parentElement) {
        const ns = getComputedStyle(n);
        const grad = ns.backgroundImage.match(/(rgba?\([^)]*\)|color\([^)]*\))/g);
        if (grad && !stops.length) stops = grad.map(rgba).filter(c => c[3] > 0.9);
        const c = rgba(ns.backgroundColor); if (c[3] > 0) layers.unshift(c); if (c[3] === 1 || stops.length) break; }
      for (const c of layers) bg = bg.map((v,i) => i<3 ? v*(1-c[3]) + c[i]*c[3] : v);
      const fgc = rgba(cs.color);
      const worst = (stops.length ? stops.map(c => c.slice(0,3)) : [bg]).map(b0 => {
        const b = b0.map(v => v*0.93); // allow for grain multiply darkening
        const fg = fgc.slice(0,3).map((v,i) => v*fgc[3] + b[i]*(1-fgc[3]));
        const L1 = lum(fg), L2 = lum(b); return (Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05); });
      const r = Math.min(...worst);
      const size = parseFloat(cs.fontSize), big = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
      if (r < (big ? 3 : 4.5)) out.push(`${el.tagName}.${el.className} "${el.textContent.trim().slice(0,25)}" ${r.toFixed(2)}`);
    }
    return out;
  });
  if (bad.length) { fails += bad.length; console.log(`FAIL ${t} ${p}\n  ` + [...new Set(bad)].join('\n  ')); }
  else console.log(`PASS ${t} ${p}`);
}
await browser.close(); server.close(); process.exit(fails ? 1 : 0);
