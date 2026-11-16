// Work page A/B player: switching versions keeps the playhead and swaps the highlighted spec column.
// Run: node tests/ab-check.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.wav': 'audio/wav', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    const body = await readFile(join(root, decodeURIComponent(path)));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);

const browser = await chromium.launch();
const page = await browser.newPage();
let fail = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fail++; };
await page.goto(`http://localhost:${server.address().port}/work.html`);
await page.evaluate(() => document.querySelector('.ab-compare').scrollIntoView());
await page.waitForFunction(() => [...document.querySelectorAll('.ab-player audio')].every(a => a.src.startsWith('blob:') && a.readyState >= 1));

await page.evaluate(() => { document.querySelector('.ab-player audio[data-version="memo"]').currentTime = 1.5; });
await page.click('.ab-slide');
check(await page.getAttribute('.ab-slide', 'aria-checked') === 'true', 'toggle reports Finished Master as on');
const t = await page.evaluate(() => document.querySelector('.ab-player audio[data-version="master"]').currentTime);
check(Math.abs(t - 1.5) < 0.05, `master picks up at the memo position (got ${t})`);
const col = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.ab-specs thead [data-version="master"]')); return s.boxShadow + ' ' + s.backgroundImage; });
// Highlight = the deeper etched groove (textures.css) or, without textures, the accent underline
check(/3px|inset/.test(col), 'master column is highlighted after switching');
const time = await page.textContent('.ab-time');
check(time === '0:01', `timestamp shows the shared position (got ${time})`);
const label = await page.textContent('.ab-player .deck-label');
check(/Finished Master/.test(label), `deck display names the master (got ${label})`);
await page.click('.ab-slide-label[data-version="memo"]');
check(await page.getAttribute('.ab-slide', 'aria-checked') === 'false', 'clicking the Voice Memo tag flips back');
await page.focus('.ab-slide'); await page.keyboard.press('Space');
check(await page.getAttribute('.ab-slide', 'aria-checked') === 'true', 'Space flips the toggle');
await page.keyboard.press('ArrowLeft');
check(await page.getAttribute('.ab-slide', 'aria-checked') === 'false', 'ArrowLeft slides to Voice Memo');
const srcs = await page.evaluate(() => [...document.querySelectorAll('.ab-player audio')].map(a => a.src));
check(srcs.every(s => s.startsWith('blob:')), 'both clips are fully loaded in memory (seekable on any server)');
const bars = await page.evaluate(() => document.querySelectorAll('.vu, .track-eq').length);
check(bars === 0, `old level meters removed (found ${bars})`);
await page.evaluate(() => document.querySelector('.ab-play').click());
await page.waitForTimeout(400);
check(await page.evaluate(() => document.querySelector('.site-header .nav-wave')?.classList.contains('is-on')), 'nav waveform shows while audio plays');
await page.evaluate(() => document.querySelector('.ab-play').click());
await page.waitForTimeout(400);
check(await page.evaluate(() => !document.querySelector('.site-header .nav-wave').classList.contains('is-on')), 'nav waveform hides when paused');

// Later in the song: the hidden track may not be buffered yet (server without Range support).
const page2 = await browser.newPage();
await page2.goto(`http://localhost:${server.address().port}/work.html`);
await page2.evaluate(() => document.querySelector('.ab-compare').scrollIntoView());
await page2.waitForFunction(() => [...document.querySelectorAll('.ab-player audio')].every(a => a.src.startsWith('blob:') && a.readyState >= 1));
await page2.evaluate(() => { document.querySelector('.ab-player audio[data-version="memo"]').currentTime = 14; });
await page2.waitForTimeout(200);
await page2.click('.ab-slide');
await page2.waitForTimeout(300);
const late = await page2.evaluate(() => document.querySelector('.ab-player audio[data-version="master"]').currentTime);
check(Math.abs(late - 14) < 0.3, `master picks up at 0:14 when it was not buffered yet (got ${late})`);

// Play before the clips finish loading, then switch: the master must still load, seek and play.
const page3 = await browser.newPage();
await page3.route('**/*.wav', async r => { await new Promise(res => setTimeout(res, 1500)); r.continue(); });
await page3.goto(`http://localhost:${server.address().port}/work.html`);
await page3.evaluate(() => document.querySelector('.ab-compare').scrollIntoView());
await page3.click('.ab-play');
await page3.waitForTimeout(2500);
await page3.click('.ab-slide');
await page3.waitForTimeout(1500);
const early = await page3.evaluate(() => { const m = document.querySelector('.ab-player audio[data-version="master"]'); return { t: m.currentTime, playing: !m.paused, dur: m.duration }; });
check(early.playing && early.t > 0.5 && early.dur > 0, `master loads and plays after an early switch (got ${JSON.stringify(early)})`);

await browser.close(); server.close();
process.exit(fail ? 1 : 0);
