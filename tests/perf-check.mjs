// Slow-device performance snapshot: 4x CPU throttle + ~1.6 Mbps / 150ms network, phone viewport.
// Reports per page: bytes on load, FCP, LCP, total long-task (blocking) time, frame rate while idle-scrolling.
// Run: node tests/perf-check.mjs   (no pass/fail; prints a table for before/after comparisons)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.mp3': 'audio/mpeg', '.webm': 'video/webm' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    const body = await readFile(join(root, path === '/' ? 'index.html' : decodeURIComponent(path)));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const pages = (process.argv[2] || 'index,work,about,contact').split(',');
const browser = await chromium.launch();
const rows = [];
for (const p of pages) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  let bytes = 0; const big = [];
  cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; });
  cdp.on('Network.responseReceived', e => { big.push(e.response.url); });
  await page.addInitScript(() => {
    window.__perf = { lcp: 0, tbt: 0 };
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.tbt += Math.max(0, e.duration - 50); }).observe({ type: 'longtask', buffered: true });
  });
  const t0 = Date.now();
  await page.goto(`${base}/${p}.html`, { waitUntil: 'load', timeout: 120000 });
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(1500);
  const fcp = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0);
  const lcp = await page.evaluate(() => window.__perf.lcp);
  // frame rate while scrolling down the page
  const fps = await page.evaluate(async () => {
    let frames = 0; const start = performance.now(); const H = document.documentElement.scrollHeight - innerHeight;
    await new Promise(r => { const f = t => { frames++; scrollTo(0, H * Math.min(1, (t - start) / 3000)); t - start < 3000 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); });
    return Math.round(frames / ((performance.now() - start) / 1000));
  });
  await page.waitForTimeout(2000);
  const tbt = await page.evaluate(() => Math.round(window.__perf.tbt));
  rows.push({ page: p, KB: Math.round(bytes / 1024), loadMs, fcp: Math.round(fcp), lcp: Math.round(lcp), tbt, scrollFps: fps });
  await ctx.close();
}
console.table(rows);
await browser.close(); server.close();
