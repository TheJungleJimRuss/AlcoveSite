// Work page Record player (tickets 01-04): milk crate (flip by buttons/keys/wheel/swipe, loaded marker, disc travel), motion (spin, lifted arm, swing, rapid clicks, reduced motion); sleeves load and play records, toggle, swap, rest the arm at the end,
// the Crate is a plain song list (no genre tabs), the A/B deck and record player pause each other.
// Run: node tests/record-player-check.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const flip = (pg, d) => pg.evaluate(d => document.querySelector('.rp-fader').dispatchEvent(new KeyboardEvent('keydown', { key: d > 0 ? 'ArrowRight' : 'ArrowLeft', bubbles: true, cancelable: true })), d);
const atStart = pg => pg.getAttribute('.rp-fader', 'aria-valuenow').then(v => v === '1');
const atEnd = pg => Promise.all([pg.getAttribute('.rp-fader', 'aria-valuenow'), pg.getAttribute('.rp-fader', 'aria-valuemax')]).then(([a, b]) => a === b);

const root = join(fileURLToPath(import.meta.url), '..', '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
// These checks use the four authored placeholder songs in work.html, so content.json is served without its saved
// `songs` list and A/B clips (Seth's real songs replace the authored Crate); `saved` serves it unchanged for the one check of that.
const mk = (range, saved = false) => createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    let body = await readFile(join(root, decodeURIComponent(path)));
    if (path === '/content.json' && !saved) { // and the saved A/B clips: the memo is AAC, which Playwright's Chromium cannot play
      const j = JSON.parse(body); delete j.songs; if (j.media) { delete j.media['work.ab.memo']; delete j.media['work.ab.master']; }
      body = Buffer.from(JSON.stringify(j));
    }
    const type = types[extname(path)] || 'application/octet-stream';
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || ''); // like GitHub Pages: Range support gives audio a finite duration
    if (m && range) {
      const a = m[1] ? +m[1] : 0, z = m[2] ? Math.min(+m[2], body.length - 1) : body.length - 1;
      res.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${a}-${z}/${body.length}`, 'content-length': z - a + 1 });
      return res.end(body.subarray(a, z + 1));
    }
    res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const server = mk(true), plain = mk(false), savedSrv = mk(true, true); // plain = like python http.server: no Range, no 206
const url = `http://localhost:${server.address().port}/work.html`;

const browser = await chromium.launch();
{ // sleeves are named by their audio file in these checks: __g(sleeve) -> indie | pop | acoustic | punk
  const g = () => { window.__g = el => ({ 1: 'indie', 2: 'pop', 3: 'acoustic', 4: 'punk' })[/track-(\d)/.exec(el.dataset.src)[1]]; };
  const np = browser.newPage.bind(browser); browser.newPage = async o => { const p = await np(o); await p.addInitScript(g); return p; };
  const nc = browser.newContext.bind(browser); browser.newContext = async o => { const c = await nc(o); await c.addInitScript(g); return c; };
}
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let fail = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fail++; };
const NUM = { indie: 1, pop: 2, acoustic: 3, punk: 4 }; // sleeves are identified by their audio file (genres are retired)
const S = g => `.sleeve[data-src*="track-${NUM[g]}"]`;
const flipTo = async (pg, g) => { // flip the crate until the genre's sleeve is in front (waits out a record being lifted)
  await pg.waitForFunction(() => !document.querySelector('.record-player').dataset.picking);
  for (let i = 0; i < 6 && (await pg.getAttribute(S(g), 'data-pos')) !== 'front'; i++) { await flip(pg, (await pg.getAttribute(S(g), 'data-pos')) === 'tipped' ? -1 : 1); await pg.waitForTimeout(40); }
  await pg.waitForFunction(() => !document.querySelector('.rp-stack').getAnimations({ subtree: true }).some(a => a.playState === 'running')); // let the tipping settle before clicking
};
const playing = () => page.waitForFunction(() => !document.getElementById('audio-player').paused, null, { timeout: 4000 });
const pick = async (pg, g) => { await flipTo(pg, g); await pg.click(S(g)); };
const st = () => page.evaluate(() => {
  const a = document.getElementById('audio-player'), r = document.querySelector('.record-player');
  return { src: a.dataset.track, paused: a.paused, state: r.dataset.state, playing: r.dataset.playing, arm: r.dataset.arm };
});
await page.goto(url);

let s = await st();
check((await page.getAttribute('.rp-arm', 'aria-disabled')) === 'true' && (await page.getAttribute('.rp-arm', 'role')) === 'slider' && (await page.getAttribute('.rp-arm', 'tabindex')) === null, 'tonearm is a disabled, unfocusable slider before a record is loaded');
{ const b = await page.locator('.rp-arm-hit').boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + 100); await page.mouse.down(); await page.mouse.move(b.x + 20, b.y + 140); await page.mouse.up();
  check((await st()).state === 'empty' && (await page.evaluate(() => document.getElementById('audio-player').currentTime)) === 0, 'dragging the disabled arm does nothing'); }
check(s.state === 'empty' && s.arm === 'rest' && !s.src, 'starts empty: no record, arm at rest, nothing loaded');
check(await page.isDisabled('.rp-play'), 'play/pause key is disabled until a record is loaded');
check((await page.locator('.sleeve').count()) === 4 && (await page.locator('.record-player .deck-reels, .track-row, .play-btn').count()) === 0 && (await page.locator('.ab-player .cd-reel').count()) === 2, 'four sleeves; old tape display, track rows and Play Preview buttons are gone from the sampler');

await page.click(S('indie'));
await page.waitForFunction(() => !document.getElementById('audio-player').paused);
s = await st();
check(s.src === 'media/track-1-indie.mp3' && !s.paused && s.arm === 'on' && s.playing === 'true', 'sleeve click loads its src, plays and puts the arm on the record');
check((await page.getAttribute(S('indie'), 'aria-pressed')) === 'true' && (await page.getAttribute(S('indie'), 'aria-current')) === 'true', 'current sleeve is marked (aria-pressed, aria-current)');
check((await page.textContent('.rp-label-text')).trim() === 'Indie Rock Demo', 'centre label shows the title');
check(/^Now playing: Indie Rock Demo$/.test(await page.textContent('.rp-status')) && (await page.getAttribute('.rp-status', 'aria-live')) === 'polite', 'live region announces "Now playing: ..."');
check(!(await page.isDisabled('.rp-play')) && (await page.getAttribute('.rp-play', 'aria-label')) === 'Pause', 'play/pause key is enabled and offers Pause');
check((await page.getAttribute('.rp-play', 'aria-pressed')) === 'true' && (await page.evaluate(() => getComputedStyle(document.querySelector('.rp-lamp')).backgroundColor)) !== (await page.evaluate(() => getComputedStyle(document.querySelector('.rp-play')).backgroundColor)), 'the Start/Stop key stays down with its lamp lit while a record plays');
await page.waitForTimeout(700);
check((await page.evaluate(() => document.getElementById('audio-player').currentTime)) > 0.3, 'playback time advances');
check(await page.evaluate(() => document.querySelector('.site-header .nav-wave')?.classList.contains('is-on')), 'header oscilloscope reacts while the record plays');

await page.click(S('indie'));
s = await st();
check(s.paused && s.arm === 'lifted' && s.state === 'loaded', 'clicking the current sleeve pauses and lifts the arm in place; record stays');
check(/^Paused: Indie Rock Demo$/.test(await page.textContent('.rp-status')) && (await page.getAttribute(S('indie'), 'aria-pressed')) === 'false', 'announces "Paused: ..." and sleeve is no longer pressed');
await page.click('.rp-play');
s = await st();
check(!s.paused && s.arm === 'on', 'play/pause key resumes');
await page.click('.rp-play');
check((await st()).paused, 'play/pause key pauses');
await page.focus(S('indie')); await page.keyboard.press('Enter');
check(!(await st()).paused, 'Enter on the focused sleeve plays');
await page.keyboard.press('Space');
check((await st()).paused, 'Space on the focused sleeve pauses');

await pick(page, 'punk');
await page.waitForFunction(() => !document.getElementById('audio-player').paused);
s = await st();
check(s.src === 'media/track-4-punk.mp3' && !s.paused && (await page.getAttribute(S('indie'), 'aria-pressed')) === 'false' && (await page.getAttribute(S('punk'), 'aria-current')) === 'true', 'another sleeve swaps the record and plays it');
check((await page.textContent('.rp-label-text')).includes('Punk'), 'centre label follows the swap');

// Song list: genres are retired (no tabs, no genre attributes or labels); the crate is a plain list in order
check((await page.locator('.filter-pill, .filter-bar, [data-genre], .sleeve-genre').count()) === 0, 'no genre tabs, data-genre attributes or genre labels remain on Work');
check((await page.$$eval('.sleeve .sleeve-title', t => t.map(x => x.textContent.trim()))).join('|') === 'Indie Rock Demo|Bedroom Pop Single|Acoustic Folk Song|Alternative & Punk Track', 'the four authored songs are listed in order by title');
for (let i = 0; i < 4 && (await page.getAttribute(S('indie'), 'data-pos')) !== 'front'; i++) { await flip(page, -1); await page.waitForTimeout(60); }
check(!(await st()).paused && (await page.getAttribute(S('indie'), 'data-pos')) === 'front', 'flipping the crate back to the first sleeve does not pause the record');
// ---- Ticket 04: the milk crate ----
const front = () => page.evaluate(() => __g(document.querySelector('.sleeve[data-pos="front"]')));
const live = () => page.textContent('#rp-crate-status');
const settle = () => page.waitForTimeout(80);
check((await front()) === 'indie' && (await atStart(page)) && !(await atEnd(page)), 'crate starts on the first record; previous is disabled at the start');
check((await page.getAttribute('.rp-fader', 'aria-label')) === 'Browse records' && (await page.evaluate(() => document.querySelector('.rp-fader').getBoundingClientRect().height >= 44)) && (await page.locator('.rp-prev, .rp-next, .rp-flip, .rp-count').count()) === 0, 'the fader is the only browse control: named "Browse records", at least 44px, no flip buttons or count');
check((await page.evaluate(() => [...document.querySelectorAll('.sleeve')].filter(x => x.tabIndex === 0).map(x => __g(x)).join())) === 'indie', 'only the front sleeve is a tab stop');
await flip(page, 1); await settle();
check((await front()) === 'pop' && (await live()) === 'Record 2 of 4: Bedroom Pop Single' && (await page.getAttribute(S('indie'), 'data-pos')) === 'tipped' && !(await atStart(page)), 'Next flips to record 2 and announces "Record 2 of 4: Bedroom Pop Single"');
check((await page.evaluate(() => getComputedStyle(document.querySelector('.sleeve[data-src*="track-1"]')).transform)) !== 'none', 'the flipped sleeve goes back into the pile (transformed)');
await page.focus(S('pop'));
await page.keyboard.press('ArrowRight'); await settle();
check((await front()) === 'acoustic' && (await live()) === 'Record 3 of 4: Acoustic Folk Song' && (await page.evaluate(() => __g(document.activeElement))) === 'acoustic', 'ArrowRight flips forward, announces it and keeps focus on the new front sleeve');
await page.keyboard.press('ArrowDown'); await settle();
check((await front()) === 'punk' && (await atEnd(page)) && (await live()) === 'Record 4 of 4: Alternative & Punk Track', 'ArrowDown flips to the last record; Next is disabled at the end');
await page.keyboard.press('ArrowRight'); await settle();
check((await front()) === 'punk', 'no wrap-around past the last record');
await page.keyboard.press('ArrowUp'); await settle();
check((await front()) === 'acoustic', 'ArrowUp flips back');
await page.keyboard.press('Home'); await settle();
check((await front()) === 'indie' && (await atStart(page)) && (await live()) === 'Record 1 of 4: Indie Rock Demo', 'Home goes to the first record');
await page.keyboard.press('ArrowLeft'); await settle();
check((await front()) === 'indie', 'no wrap-around before the first record');
await page.keyboard.press('End'); await settle();
check((await front()) === 'punk', 'End goes to the last record');
await page.keyboard.press('Home'); await settle();
// Wheel and swipe no longer move through the records; the fader does
{
  const b = await page.locator('.rp-stage').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  const w = await page.evaluate(() => { const e = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }); document.querySelector('.rp-stage').dispatchEvent(e); return e.defaultPrevented; });
  await settle();
  check((await front()) === 'indie' && w === false, 'the wheel does not flip records and is left to the page');
  const swipe = (dx) => page.evaluate(dx => { const s = document.querySelector('.rp-stage'), r = s.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, o = { pointerId: 9, pointerType: 'touch', bubbles: true }; s.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientX: x, clientY: y })); s.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: x + dx, clientY: y })); s.dispatchEvent(new PointerEvent('pointerup', { ...o, clientX: x + dx, clientY: y })); }, dx);
  await swipe(-80); await settle();
  check((await front()) === 'indie', 'swiping the crate does not flip records');
  const fb = await page.locator('.rp-fader').boundingBox(), capW = await page.evaluate(() => document.querySelector('.rp-fader-cap').offsetWidth), cy = fb.y + fb.height / 2;
  check((await page.getAttribute('.rp-fader', 'role')) === 'slider' && (await page.getAttribute('.rp-fader', 'aria-valuenow')) === '1' && (await page.getAttribute('.rp-fader', 'aria-valuemax')) === '4', 'the fader is a slider reading 1 of 4');
  await page.mouse.move(fb.x + capW / 2, cy); await page.mouse.down();
  await page.mouse.move(fb.x + fb.width / 2, cy, { steps: 6 }); await settle();
  check((await front()) === 'pop' || (await front()) === 'acoustic', 'dragging the fader to the middle brings a middle record forward');
  await page.mouse.move(fb.x + fb.width - capW / 2, cy, { steps: 6 }); await page.mouse.up(); await settle();
  check((await front()) === 'punk' && (await page.getAttribute('.rp-fader', 'aria-valuenow')) === '4', 'dragging the fader to the end brings the last record forward');
  await page.mouse.click(fb.x + capW / 2, cy); await settle();
  check((await front()) === 'indie', 'clicking the start of the fader track goes back to the first record');
  await flip(page, -1); await settle();
}
{
  // a point where the acoustic sleeve is the top element (a corner peeking out of the pile)
  await page.evaluate(() => { document.querySelector('.rp-stage').scrollIntoView({ block: 'start' }); scrollBy(0, -140); });
  const target = 'pop'; // the pile hangs off the screen edge: the next sleeve is the one whose corner always shows
  const peek = await page.evaluate(sel => { const el = document.querySelector(sel), r = el.getBoundingClientRect(); for (let y = r.top + 2; y < r.bottom; y += 4) for (let x = r.left + 2; x < r.right; x += 4) { const h = document.elementFromPoint(x, y); if (h && h.closest('.sleeve') === el) return [x, y]; } return null; }, S(target));
  if (peek) { await page.mouse.click(peek[0], peek[1]); await settle(); }
  check(peek && (await front()) === target, 'clicking the visible part of a sleeve in the pile brings it out');
  await page.evaluate(() => document.querySelector('.sleeve[data-src*="track-3"]').click()); await settle(); // acoustic in front, so Bedroom Pop is tipped for the next checks
  await page.evaluate(() => document.querySelector('.sleeve[data-src*="track-2"]').click()); await settle();
  check((await front()) === 'pop' && (await page.evaluate(() => document.getElementById('audio-player').dataset.track)).includes('punk'), 'clicking a tipped sleeve flips back to it without loading it');
}
// The loaded record is marked even when it is not in front (punk is on the platter). The visible "on the platter" tab
// is switched off in CSS (display: none !important), so this checks the marker class it hangs on.
{
  const mk = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.sleeve')].map(x => [__g(x), x.classList.contains('is-current') ? 'block' : 'none'])));
  const mkd = await mk();
  check(mkd.punk === 'block' && mkd.indie === 'none' && mkd.pop === 'none' && mkd.acoustic === 'none' && (await front()) === 'pop', 'the loaded sleeve (punk) stays marked is-current while another one is in front');
}
// Selecting a flipped-to record: lift, disc travels, sleeve drops back, then the arm swings in
await page.click(S('pop'));
await page.waitForFunction(() => document.querySelector('.record-player').dataset.picking === 'true');
await page.waitForTimeout(500);
{
  const mid = await page.evaluate(() => { const d = document.querySelector('.rp-disc'); return { op: getComputedStyle(d).opacity, anims: d.getAnimations().filter(a => a.playState === 'running').length, lifted: document.querySelector('.sleeve[data-src*="track-2"]').classList.contains('is-lifted'), nav: document.querySelector('.rp-fader').getAttribute('aria-disabled') === 'true', label: d.textContent.trim(), playing: !document.getElementById('audio-player').paused }; });
  check(mid.op === '1' && mid.anims > 0 && mid.lifted && mid.label === 'Bedroom Pop Single' && !mid.playing, 'while the record is picked: the sleeve is lifted and the disc (with its label) is moving');
  check(mid.nav, 'flip keys wait (disabled) while the record is being lifted');
}
await page.waitForFunction(() => !document.querySelector('.record-player').dataset.picking, null, { timeout: 4000 });
{
  const done = await page.evaluate(() => ({ op: getComputedStyle(document.querySelector('.rp-disc')).opacity, anims: document.querySelector('.rp-disc').getAnimations().length, lifted: document.querySelectorAll('.is-lifted').length, rec: document.querySelector('.record-player').dataset.record, label: document.querySelector('.rp-label-text').textContent.trim() }));
  check(done.op === '0' && done.anims === 0 && done.lifted === 0 && done.rec === 'in' && done.label === 'Bedroom Pop Single', 'after landing: the disc is gone, the sleeve dropped back, the record sits on the platter with its label');
}
await playing();
{
  const mk = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.sleeve')].map(x => [__g(x), x.classList.contains('is-current') ? 'block' : 'none'])));
  check(mk.pop === 'block' && mk.punk === 'none' && (await st()).src === 'media/track-2-bedroom-pop.mp3' && (await st()).arm === 'on', 'the loaded marker moved to the front sleeve and its record plays');
}
await page.click(S('pop'));
check((await st()).paused && (await st()).arm === 'lifted', 'clicking the loaded front sleeve toggles pause');
await pick(page, 'punk');
await playing();

// A/B deck and record player pause each other
await page.evaluate(() => document.querySelector('.ab-compare').scrollIntoView());
await page.waitForFunction(() => [...document.querySelectorAll('.ab-player audio')].every(a => a.src.startsWith('blob:') && a.readyState >= 1));
await page.evaluate(() => document.querySelector('#ab-key-play').click());
await page.waitForTimeout(300);
s = await st();
check(s.paused && s.arm === 'lifted', 'starting the A/B deck pauses the record player');
await page.evaluate(() => document.querySelector('#ab-key-pause').click());
await page.evaluate(() => document.querySelector('.rp-play').click());
await page.waitForTimeout(300);
check((await page.evaluate(() => [...document.querySelectorAll('.ab-player audio')].every(a => a.paused))) && !(await st()).paused, 'starting the record player pauses the A/B deck');

// Track end: arm rests, record stays, nothing else starts
await page.evaluate(() => { const a = document.getElementById('audio-player'); a.currentTime = a.duration - 0.2; });
await page.waitForFunction(() => document.getElementById('audio-player').ended, null, { timeout: 5000 });
await page.waitForTimeout(300);
s = await st();
check(s.paused && s.arm === 'rest' && s.state === 'loaded' && s.src === 'media/track-4-punk.mp3', 'at track end the arm returns to rest, the record stays, nothing else starts');
check((await page.evaluate(() => [...document.querySelectorAll('audio')].every(a => a.paused))), 'no media element is playing after the end');
await pick(page, 'punk');
await page.waitForFunction(() => !document.getElementById('audio-player').paused, null, { timeout: 3000 });
check((await st()).arm === 'on', 'clicking the finished record swings the arm in and plays it again');

// ---- Ticket 02: seeking with the tonearm and the timeline ----
await pick(page, 'indie');
await page.waitForFunction(() => document.getElementById('audio-player').duration > 5 && !document.getElementById('audio-player').paused);
await page.click('.rp-play'); // pause so only our seeks move the playhead
const ct = () => page.evaluate(() => document.getElementById('audio-player').currentTime);
const arm = () => page.evaluate(() => ({ now: +document.querySelector('.rp-arm').getAttribute('aria-valuenow'), max: +document.querySelector('.rp-arm').getAttribute('aria-valuemax'), text: document.querySelector('.rp-arm').getAttribute('aria-valuetext'), ang: parseFloat(document.querySelector('.record-player').style.getPropertyValue('--arm-angle')) }));
let a = await arm();
const dur = a.max;
check(dur > 5 && (await page.getAttribute('.rp-arm', 'aria-disabled')) === 'false' && (await page.getAttribute('.rp-arm', 'tabindex')) === '0', `tonearm is enabled once a record is loaded (duration ${dur}s)`);
check(/^0:0\d of \d+:\d\d$/.test(a.text) && a.ang > 25 && a.ang < 40, `arm at the outer groove at the start (${a.ang}deg, "${a.text}")`);
await page.focus('.rp-arm');
await page.keyboard.press('ArrowRight');
a = await arm();
check(Math.abs((await ct()) - 5) < 0.3 && a.now === 5, 'ArrowRight seeks +5s; aria-valuenow follows on the arm');
await page.keyboard.press('ArrowLeft');
check(Math.abs(await ct()) < 0.3, 'ArrowLeft seeks -5s');
await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
check(Math.abs((await ct()) - 10) < 0.3, 'ArrowUp seeks +5s each');
await page.keyboard.press('PageDown');
check((await ct()) < 0.3, 'PageDown seeks -30s, clamped at 0');
await page.keyboard.press('End');
a = await arm();
check(Math.abs((await ct()) - (dur - 1)) < 0.3 && a.ang > 45, `End goes near the end; arm at the inner groove (${a.ang}deg)`);
check((await st()).paused, 'keyboard seeking while paused does not start playback');
await page.keyboard.press('Home');
a = await arm();
check((await ct()) < 0.3 && /^0:00 of /.test(a.text), 'Home goes to 0:00; aria-valuetext reads "0:00 of m:ss"');

// Pointer drag on the arm: needle follows, seek commits on release, proportional to the angle
await page.locator('.rp-turntable').scrollIntoViewIfNeeded();
const svgBox = await page.locator('.rp-arm-svg').boundingBox();
const k = svgBox.width / 500;
const at = deg => { const r = deg * Math.PI / 180; return [svgBox.x + (435 - 254 * Math.sin(r)) * k, svgBox.y + (60 + 254 * Math.cos(r)) * k]; };
await page.keyboard.press('Home');
const angStart = (await arm()).ang;
await page.keyboard.press('End');
const angEnd = (await arm()).ang;
await page.keyboard.press('Home');
const midAng = (angStart + angEnd) / 2;
await page.mouse.move(...at(angStart));
await page.mouse.down();
await page.mouse.move(...at(midAng), { steps: 6 });
a = await arm();
check(Math.abs(a.ang - midAng) < 1.5 && Math.abs(await ct()) < 0.3, 'during the drag the needle follows the pointer and the seek has not committed yet');
await page.mouse.up();
check(Math.abs((await ct()) - dur / 2) < dur * 0.06, `drag to mid-record seeks about halfway (${(await ct()).toFixed(1)}s of ${dur.toFixed(1)}s)`);
check((await st()).paused, 'dragging the arm while paused seeks without starting playback');
await page.mouse.move(...at(angStart)); await page.mouse.down(); await page.mouse.move(...at(angEnd + 6), { steps: 5 }); await page.mouse.up();
check(Math.abs((await ct()) - dur) < dur * 0.01, 'dragging past the inner groove clamps at the end');
await page.keyboard.press('Home');
// (Touch uses the same Pointer Events path; the arm sets touch-action: none so a finger drag is not taken as a scroll.)
const hb = await page.locator('.rp-arm-hit').evaluate(el => ({ ta: getComputedStyle(el).touchAction, w: parseFloat(getComputedStyle(el).strokeWidth) }));
check(hb.ta === 'none' && hb.w * k >= 44, `arm hit area: touch-action none and ${Math.round(hb.w * k)}px wide (>= 44)`);

// No timeline bar or timestamps any more: the tonearm is the only seek control
check((await page.locator('.scrubber-track, #progress-bar, #current-time, #total-time').count()) === 0, 'the progress bar and timestamps are gone');
await page.focus('.rp-arm');
await page.keyboard.press('Home'); const t0 = await ct(); await page.keyboard.press('ArrowRight');
check(Math.abs((await ct()) - (t0 + 5)) < 1, 'the tonearm is the seek slider: ArrowRight seeks +5s');
// Ended returns the arm to rest (angle 0)
await page.keyboard.press('End');
await page.click('.rp-play');
await page.waitForFunction(() => document.getElementById('audio-player').ended, null, { timeout: 5000 });
await page.waitForTimeout(200);
check(!(await page.evaluate(() => document.querySelector('.record-player').style.getPropertyValue('--arm-angle'))) && (await st()).arm === 'rest', 'after the track ends the arm is back at rest');

// ---- Ticket 03: motion ----
const anims = () => page.evaluate(() => document.querySelector('.rp-record').getAnimations().map(a => ({ s: a.playState, it: a.effect.getComputedTiming().iterations })));
const armAng = () => page.evaluate(() => parseFloat(document.querySelector('.record-player').style.getPropertyValue('--arm-angle')));
await pick(page, 'acoustic');
await page.waitForFunction(() => document.querySelector('.record-player').dataset.arm === 'swing');
check(await page.evaluate(() => document.getElementById('audio-player').paused) && (await st()).playing === 'false', 'mid-swing: the arm is moving in and playback has not started yet');
await playing();
await page.waitForTimeout(300);
check((await anims()).some(x => x.s === 'running' && x.it === Infinity) && (await page.getAttribute('.record-player', 'data-spin')) === 'on', 'while playing the record spins (infinite running animation)');
check(!(await page.evaluate(() => getComputedStyle(document.querySelector('.rp-arm')).transitionProperty)).includes('transform'), 'no angle transition while the arm tracks playback');
let before = await armAng(), scaleOn = await page.evaluate(() => getComputedStyle(document.querySelector('.rp-arm')).scale);
await page.click(S('acoustic'));
await page.waitForTimeout(400);
check((await st()).arm === 'lifted' && (await page.getAttribute('.record-player', 'data-spin')) === 'stopping', 'pause: arm lifted and the platter is easing to a stop, not frozen');
check(Math.abs((await armAng()) - before) < 0.6, `pause keeps the needle over its position (${before}deg -> ${await armAng()}deg)`);
await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('.rp-arm')).scale) > 1.04 && getComputedStyle(document.querySelector('.rp-arm')).filter.includes('13px'), null, { timeout: 3000 }).catch(() => {});
check(parseFloat(await page.evaluate(() => getComputedStyle(document.querySelector('.rp-arm')).scale)) > (parseFloat(scaleOn) || 1) && (await page.evaluate(() => getComputedStyle(document.querySelector('.rp-arm')).filter)).includes('13px'), 'lifted arm is bigger with a softer shadow');
await page.waitForTimeout(1300);
check((await anims()).every(x => x.s !== 'running') && (await page.getAttribute('.record-player', 'data-spin')) === 'off', 'a little later the platter has stopped (no running animation)');
await page.click('.rp-play');
await page.waitForTimeout(200);
check((await st()).arm === 'on' && (await anims()).some(x => x.s === 'running' && x.it === Infinity), 'resume lowers the arm and the spin restarts');
// Rapid input while a record is being lifted: clicks and flips wait; only the first selection counts, state stays consistent
await flipTo(page, 'indie');
await page.evaluate(() => { const q = g => document.querySelector(`.sleeve[data-src*="track-${({ indie: 1, pop: 2, acoustic: 3, punk: 4 })[g]}"]`), nx = { click: () => document.querySelector('.rp-fader').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })) }; [() => q('indie').click(), () => q('indie').click(), () => nx.click(), () => q('pop').click(), () => q('acoustic').click()].forEach((f, i) => setTimeout(f, i * 40)); });
await page.waitForTimeout(150);
check(await page.evaluate(() => document.getElementById('audio-player').paused) && (await page.getAttribute(S('indie'), 'data-pos')) === 'front', 'rapid input: nothing plays yet and the crate has not flipped while the record is lifted');
await playing();
await page.waitForTimeout(300);
const rc = await page.evaluate(() => { const l = [...document.querySelectorAll('.sleeve')], a = document.getElementById('audio-player'), r = document.querySelector('.record-player'); return { cur: l.filter(x => x.getAttribute('aria-current')).map(x => __g(x)), pl: l.filter(x => x.classList.contains('is-playing')).map(x => __g(x)), track: a.dataset.track, paused: a.paused, arm: r.dataset.arm, label: document.querySelector('.rp-label-text').textContent.trim(), title: l[0].querySelector('.sleeve-title').textContent.trim(), status: document.querySelector('.rp-status').textContent, plays: [...document.querySelectorAll('audio')].filter(x => !x.paused).length };
});
check(rc.cur.join() === 'indie' && rc.pl.join() === 'indie' && rc.track.includes('indie') && !rc.paused && rc.arm === 'on' && rc.label === rc.title && rc.status === 'Now playing: ' + rc.title && rc.plays === 1, `rapid input: only the first sleeve is loaded and playing, state consistent (${JSON.stringify(rc.cur)})`);
// A new pick during the arm swing supersedes the older one
await pick(page, 'pop');
await page.waitForFunction(() => document.querySelector('.record-player').dataset.arm === 'swing');
await pick(page, 'punk');
await playing();
await page.waitForTimeout(2800);
const rd = await page.evaluate(() => ({ cur: [...document.querySelectorAll('.sleeve')].filter(x => x.getAttribute('aria-current')).map(x => __g(x)).join(), track: document.getElementById('audio-player').dataset.track, paused: document.getElementById('audio-player').paused, arm: document.querySelector('.record-player').dataset.arm, rec: document.querySelector('.record-player').dataset.record, plays: [...document.querySelectorAll('audio')].filter(x => !x.paused).length }));
check(rd.cur === 'punk' && rd.track.includes('punk') && !rd.paused && rd.arm === 'on' && rd.rec === 'in' && rd.plays === 1, `a pick during the swing supersedes the older record cleanly (${JSON.stringify(rd)})`);
// Dragging the arm during a swing cancels the swing and drops the needle
await pick(page, 'indie');
await page.waitForFunction(() => document.querySelector('.record-player').dataset.arm === 'swing');
await page.focus('.rp-arm').catch(() => {});
await page.evaluate(() => document.querySelector('.rp-arm').focus());
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(100);
s = await st();
check(!s.paused && s.arm === 'on' && Math.abs((await ct()) - 5) < 1, 'seeking the arm mid-swing cancels the swing and plays from there');
await page.waitForTimeout(900);
check((await st()).arm === 'on' && !(await st()).paused, 'the cancelled swing leaves no stale state behind');
// Another click after pausing mid-way still works (play/pause spam)
for (let i = 0; i < 5; i++) await page.click('.rp-play');
await page.waitForTimeout(1500);
s = await st();
check(s.paused === (s.arm === 'lifted') && s.paused === (s.playing === 'false') && (await page.evaluate(() => document.querySelectorAll('.sleeve.is-playing').length)) === (s.paused ? 0 : 1), `play/pause spam ends consistent (arm ${s.arm}, paused ${s.paused})`);
await page.evaluate(() => document.getElementById('audio-player').pause());

// Reduced motion: no spin, slide or swing; playback starts at once
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p3 = await ctx.newPage();
  await p3.goto(url);
  await p3.click(S('indie'));
  await p3.waitForFunction(() => !document.getElementById('audio-player').paused, null, { timeout: 600 });
  await p3.waitForTimeout(300);
  const rm = await p3.evaluate(() => ({ anims: document.querySelector('.record-player').getAnimations({ subtree: true }).filter(a => a.playState !== 'finished').length, arm: document.querySelector('.record-player').dataset.arm, rot: getComputedStyle(document.querySelector('.rp-record')).rotate, spin: document.querySelector('.record-player').dataset.spin }));
  check(rm.anims === 0 && rm.arm === 'on' && rm.spin !== 'on' && (rm.rot === 'none' || parseFloat(rm.rot) === 0), 'reduced motion: playback starts at once with no running animations');
  await p3.click(S('indie'));
  await p3.waitForTimeout(100);
  check((await p3.evaluate(() => document.querySelector('.record-player').dataset.arm)) === 'lifted' && (await p3.evaluate(() => document.querySelector('.record-player').getAnimations({ subtree: true }).filter(a => a.playState !== 'finished').length)) === 0, 'reduced motion: pause jumps to the lifted state without animations');
  await flip(p3, 1);
  await p3.click(S('pop'));
  await p3.waitForFunction(() => document.getElementById('audio-player').dataset.track === 'media/track-2-bedroom-pop.mp3' && !document.getElementById('audio-player').paused, null, { timeout: 600 });
  const rm2 = await p3.evaluate(() => ({ anims: document.querySelector('.record-player').getAnimations({ subtree: true }).filter(a => a.playState !== 'finished').length, front: __g(document.querySelector('.sleeve[data-pos="front"]')), lifted: document.querySelectorAll('.is-lifted').length, disc: getComputedStyle(document.querySelector('.rp-disc')).opacity, picking: document.querySelector('.record-player').dataset.picking || '' }));
  check(rm2.anims === 0 && rm2.front === 'pop' && rm2.lifted === 0 && rm2.disc === '0' && !rm2.picking, 'reduced motion: flipping and selecting change state instantly (no tipping, lift or disc travel)');
  await ctx.close();
}

// A server without Range support (python http.server): real duration and working seeks
{
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const hdrs = [];
  p2.on('response', r => { if (r.url().includes('/media/track-1')) hdrs.push(r.status()); });
  await p2.goto(`http://localhost:${plain.address().port}/work.html`);
  await p2.waitForFunction(() => document.querySelector('.record-player').dataset.loaded === 'true');
  await p2.click(S('indie'));
  await p2.waitForFunction(() => document.getElementById('audio-player').duration > 5);
  const r = await p2.evaluate(() => { const a = document.getElementById('audio-player'); return { blob: a.src.startsWith('blob:'), d: a.duration, shown: '' }; });
  check(r.blob && isFinite(r.d) && hdrs.every(c => c === 200), `no-Range server: clip is a blob, real duration ${r.d.toFixed(1)}s`);
  await p2.focus('.rp-arm'); await p2.keyboard.press('ArrowRight'); await p2.keyboard.press('ArrowRight');
  await p2.waitForTimeout(300);
  const t2 = await p2.evaluate(() => document.getElementById('audio-player').currentTime);
  check(t2 >= 9.5, `no-Range server: seeking sticks (now ${t2.toFixed(1)}s, not back at 0:00)`);
  await p2.close();
}

// Phone: no horizontal overflow, sleeves in a scroll-snap row
await page.setViewportSize({ width: 375, height: 800 });
await page.reload();
await page.waitForTimeout(300);
const m = await page.evaluate(() => {
  const c = document.querySelector('.rp-stage').getBoundingClientRect(), t = document.querySelector('.rp-turntable').getBoundingClientRect();
  const nav = [document.querySelector('.rp-fader').getBoundingClientRect()];
  return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, below: c.top >= t.bottom - 1, tw: t.width, cwid: c.width, left: c.left, right: c.right, nav: nav.every(r => r.width >= 44 && r.height >= 44) };
});
check(m.nav, 'phone: the fader is at least 44px');
check(m.sw <= m.cw, `no horizontal overflow at 375px (scrollWidth ${m.sw}, client ${m.cw})`);
check(m.below && m.left >= 0 && m.right <= m.cw, 'phone: the crate sits below the turntable and fits the screen');
check(m.tw > 300 && m.cwid > 300, `phone: turntable and crate are full width (${Math.round(m.tw)}px, ${Math.round(m.cwid)}px)`);
await flip(page, 1); await page.click(S('pop'));
await page.waitForFunction(() => !document.getElementById('audio-player').paused, null, { timeout: 6000 });
check((await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)), 'phone: no horizontal overflow while a record is on the platter');
{ // the disc travels: take a look mid-way that it never makes the page wider
  await flip(page, 1); await page.waitForTimeout(0);
  await page.evaluate(() => document.querySelector('.sleeve[data-pos="front"]').click());
  const ws = [];
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(160); ws.push(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)); }
  check(ws.every(w => w <= 0), `phone: no horizontal overflow while the disc travels (${ws})`);
}

{ // Sleeve covers (admin media ticket 06): a song with a cover shows the picture unblended, centre-cropped, and no printed pattern
  const cp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await cp.goto(url);
  await cp.evaluate(() => { const rp = window.AlcoveRecordPlayer, l = rp.getSongs(); l[1].cover = 'images/studio-live-room.jpg'; l[2].cover = 'javascript:alert(1)'; rp.setSongs(l); });
  const cv = await cp.evaluate(() => [...document.querySelectorAll('.sleeve')].map(s => {
    const b = getComputedStyle(s.querySelector('.sleeve-art'), '::before'), a = getComputedStyle(s.querySelector('.sleeve-art'), '::after');
    return { has: s.classList.contains('has-cover'), blend: b.mixBlendMode, bg: b.backgroundImage, size: b.backgroundSize, pos: b.backgroundPosition, after: a.display, cover: s.dataset.cover || null };
  }));
  check(cv[1].has && cv[1].blend === 'normal' && /studio-live-room\.jpg/.test(cv[1].bg) && cv[1].size === 'cover' && cv[1].pos === '50% 50%', 'a song with a cover draws it unblended and centre-cropped: ' + JSON.stringify(cv[1]));
  check(cv[1].after === 'none', 'the printed pattern is hidden on a sleeve with a cover');
  check(!cv[0].has && cv[0].blend === 'multiply' && cv[0].bg === 'none' && cv[0].after === 'block' && !cv[3].has, 'sleeves without a cover keep the pattern');
  check(!cv[2].has && cv[2].cover === null, 'an unsafe cover value is ignored (sleeve keeps its pattern)');
  check(JSON.stringify(await cp.evaluate(() => window.AlcoveRecordPlayer.getSongs().map(x => x.cover || null))) === '[null,"images/studio-live-room.jpg",null,null]', 'getSongs returns the cover only where one is set');
  await cp.evaluate(() => { const rp = window.AlcoveRecordPlayer, l = rp.getSongs(); l.reverse(); rp.setSongs(l); });
  check((await cp.evaluate(() => [...document.querySelectorAll('.sleeve')].map(s => s.dataset.cover || '-').join())) === '-,-,images/studio-live-room.jpg,-' + '', 'the cover follows its song when the list is reordered');
  check((await cp.evaluate(() => document.querySelector('.sleeve[data-pos="front"] .sleeve-title').textContent.trim() !== '')), 'the sleeve keeps its title as its accessible name');
  await cp.close();
}

{ // The saved song list in content.json replaces the authored Crate, in order, with its covers
  const lp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await lp.goto(`http://localhost:${savedSrv.address().port}/work.html`);
  const want = JSON.parse(await readFile(join(root, 'content.json'), 'utf8')).songs;
  const got = await lp.evaluate(() => [...document.querySelectorAll('.sleeve')].map(s => ({ title: s.querySelector('.sleeve-title').textContent.trim(), file: s.dataset.src, cover: s.dataset.cover || null })));
  check(JSON.stringify(got) === JSON.stringify(want.map(x => ({ title: x.title, file: x.file, cover: x.cover || null }))), `saved songs replace the authored Crate (${got.length} sleeves)`);
  await lp.close();
}

await browser.close(); server.close(); plain.close(); savedSrv.close();
process.exit(fail ? 1 : 0);
