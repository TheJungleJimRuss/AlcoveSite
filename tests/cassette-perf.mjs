// Cassette frame-time check: plays (MODE=play) or plays then flips (MODE=flip) the 3D A/B deck for 3 s on a
// 4x-throttled CPU and reports frame intervals. Fails if the cassette label textures are redrawn (2D canvas work) while
// only the transport state changed (a ~100 ms hitch on every Play/Pause/Flip), or if p95 frame interval > 50 ms.
// Run: node tests/cassette-perf.mjs [throttle]   (env: MODE=play|flip, W=viewport width, DPR=device scale factor)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    const body = await readFile(join(root, path === '/' ? 'index.html' : decodeURIComponent(path)));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const throttle = +(process.argv[2] || 4);
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +(process.env.W||1200), height: 900 }, deviceScaleFactor: +(process.env.DPR||1) });
await page.goto(`${base}/work.html`, { waitUntil: 'load' });
await page.evaluate(() => document.querySelector('section.ab-compare').scrollIntoView({ block: 'center' }));
await page.waitForFunction(() => window.__cassette3d && window.__cassette3d.ready, null, { timeout: 30000 });
await page.waitForFunction(() => [...document.querySelectorAll('.ab-player audio')].every(a => a.src.startsWith('blob:') && a.readyState >= 1), null, { timeout: 30000 });
const gl = await page.evaluate(() => { const c = document.querySelector('.ab-compare canvas'); const g = c.getContext('webgl2'); const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?'; });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
await page.evaluate(m => window.__MODE = m, process.env.MODE || 'play');
const r = await page.evaluate(async () => {
  const renders0 = window.__cassette3d.renders;
  let lt = 0; const po = new PerformanceObserver(l => l.getEntries().forEach(e => lt += e.duration)); po.observe({ type: 'longtask' });
  let muts = 0; new MutationObserver(m => muts += m.length).observe(document.querySelector('section.ab-compare'), { subtree: true, characterData: true, childList: true });
  const c2 = HTMLCanvasElement.prototype.getContext; let ctx2d = 0; HTMLCanvasElement.prototype.getContext = function (t, ...a) { if (t === '2d') ctx2d++; return c2.call(this, t, ...a); };
  window.__muts = () => muts; window.__ctx2d = () => ctx2d;
  if (window.__MODE === 'flip') { await window.__abDeck.play(); setTimeout(() => window.__abDeck.flip(), 300); } else if (window.__MODE === 'idle') {} else await window.__abDeck.play();
  const iv = []; let last = performance.now();
  await new Promise(res => { const t0 = last; const f = now => { iv.push(now - last); last = now; now - t0 < 3000 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });
  window.__abDeck.pause(); po.disconnect();
  window.__first = iv.slice(0, 6).map(Math.round); window.__maxAt = iv.indexOf(Math.max(...iv)); iv.sort((a, b) => a - b);
  const q = p => Math.round(iv[Math.floor(p * (iv.length - 1))]);
  return { frames: iv.length, fps: Math.round(iv.length / 3), p50: q(0.5), p95: q(0.95), max: q(1), renders: window.__cassette3d.renders - renders0, longTaskMs: Math.round(lt), mutations: window.__muts(), first: window.__first, maxAt: window.__maxAt, ctx2dCalls: window.__ctx2d() };
});
console.log('GL:', gl, '| CPU throttle', throttle + 'x');
console.log(r);
const fail = r.ctx2dCalls > 0 || r.p95 > 50;
console.log(fail ? 'FAIL' : 'PASS', `label redraws (2D contexts)=${r.ctx2dCalls} p95=${r.p95}ms max=${r.max}ms`);
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
