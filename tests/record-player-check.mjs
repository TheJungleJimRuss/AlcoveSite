// Work page Record player (tickets 01-04): milk crate (flip by buttons/keys/wheel/swipe, loaded marker, disc travel), motion (spin, lifted arm, swing, rapid clicks, reduced motion); sleeves load and play records, toggle, swap, rest the arm at the end,
// the Crate is a plain song list (no genre tabs), the A/B deck and record player pause each other.
// Run: node tests/record-player-check.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.wav': 'audio/wav', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
const mk = range => createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    const body = await readFile(join(root, decodeURIComponent(path)));
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
const server = mk(true), plain = mk(false); // plain = like python http.server: no Range, no 206
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
  for (let i = 0; i < 6 && (await pg.getAttribute(S(g), 'data-pos')) !== 'front'; i++) { await pg.click((await pg.getAttribute(S(g), 'data-pos')) === 'tipped' ? '.rp-prev' : '.rp-next'); await pg.waitForTimeout(40); }
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
check((await page.locator('.sleeve').count()) === 4 && (await page.locator('.record-player .deck-reels, .track-row, .play-btn').count()) === 0 && (await page.locator('.ab-player .deck-reels').count()) === 1, 'four sleeves; old tape display, track rows and Play Preview buttons are gone from the sampler');

await page.click(S('indie'));
await page.waitForFunction(() => !document.getElementById('audio-player').paused);
s = await st();
check(s.src === 'media/track-1-indie.wav' && !s.paused && s.arm === 'on' && s.playing === 'true', 'sleeve click loads its src, plays and puts the arm on the record');
check((await page.getAttribute(S('indie'), 'aria-pressed')) === 'true' && (await page.getAttribute(S('indie'), 'aria-current')) === 'true', 'current sleeve is marked (aria-pressed, aria-current)');
check((await page.textContent('.rp-label-text')).trim() === 'Indie Rock Demo', 'centre label shows the title');
check(/^Now playing: Indie Rock Demo$/.test(await page.textContent('.rp-status')) && (await page.getAttribute('.rp-status', 'aria-live')) === 'polite', 'live region announces "Now playing: ..."');
check(!(await page.isDisabled('.rp-play')) && (await page.getAttribute('.rp-play', 'aria-label')) === 'Pause', 'play/pause key is enabled and offers Pause');
await page.waitForTimeout(700);
check((await page.textContent('#current-time')) !== '0:00' || (await page.evaluate(() => document.getElementById('audio-player').currentTime)) > 0.3, 'timeline time advances');
check((await page.textContent('#total-time')) !== '0:00', `total time shows the real duration (${await page.textContent('#total-time')})`);
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
check(s.src === 'media/track-4-punk.wav' && !s.paused && (await page.getAttribute(S('indie'), 'aria-pressed')) === 'false' && (await page.getAttribute(S('punk'), 'aria-current')) === 'true', 'another sleeve swaps the record and plays it');
check((await page.textContent('.rp-label-text')).includes('Punk'), 'centre label follows the swap');

// Song list: genres are retired (no tabs, no genre attributes or labels); the crate is a plain list in order
check((await page.locator('.filter-pill, .filter-bar, [data-genre], .sleeve-genre').count()) === 0, 'no genre tabs, data-genre attributes or genre labels remain on Work');
check((await page.$$eval('.sleeve .sleeve-title', t => t.map(x => x.textContent.trim()))).join('|') === 'Indie Rock Demo|Bedroom Pop Single|Acoustic Folk Song|Alternative & Punk Track', 'the four authored songs are listed in order by title');
for (let i = 0; i < 4 && (await page.getAttribute(S('indie'), 'data-pos')) !== 'front'; i++) { await page.click('.rp-prev'); await page.waitForTimeout(60); }
check(!(await st()).paused && (await page.textContent('.rp-count')) === '1 of 4' && (await page.getAttribute(S('indie'), 'data-pos')) === 'front', 'flipping the crate back to the first sleeve does not pause the record; the count reads 1 of 4');
// ---- Ticket 04: the milk crate ----
const front = () => page.evaluate(() => __g(document.querySelector('.sleeve[data-pos="front"]')));
const live = () => page.textContent('#rp-crate-status');
const settle = () => page.waitForTimeout(80);
check((await front()) === 'indie' && (await page.textContent('.rp-count')) === '1 of 4' && (await page.isDisabled('.rp-prev')) && !(await page.isDisabled('.rp-next')), 'crate starts on the first record; previous is disabled at the start');
check((await page.getAttribute('.rp-prev', 'aria-label')) === 'Previous record' && (await page.getAttribute('.rp-next', 'aria-label')) === 'Next record' && (await page.evaluate(() => [...document.querySelectorAll('.rp-flip')].every(b => b.getBoundingClientRect().width >= 44 && b.getBoundingClientRect().height >= 44))), 'flip keys are named "Previous record" / "Next record" and are at least 44px');
check((await page.evaluate(() => [...document.querySelectorAll('.sleeve')].filter(x => x.tabIndex === 0).map(x => __g(x)).join())) === 'indie', 'only the front sleeve is a tab stop');
await page.click('.rp-next'); await settle();
check((await front()) === 'pop' && (await live()) === 'Record 2 of 4: Bedroom Pop Single' && (await page.getAttribute(S('indie'), 'data-pos')) === 'tipped' && !(await page.isDisabled('.rp-prev')), 'Next flips to record 2 and announces "Record 2 of 4: Bedroom Pop Single"');
check((await page.evaluate(() => getComputedStyle(document.querySelector('.sleeve[data-src*="track-1"]')).transform)) !== 'none', 'the flipped sleeve is tipped forward by a 3D transform');
await page.focus(S('pop'));
await page.keyboard.press('ArrowRight'); await settle();
check((await front()) === 'acoustic' && (await live()) === 'Record 3 of 4: Acoustic Folk Song' && (await page.evaluate(() => __g(document.activeElement))) === 'acoustic', 'ArrowRight flips forward, announces it and keeps focus on the new front sleeve');
await page.keyboard.press('ArrowDown'); await settle();
check((await front()) === 'punk' && (await page.isDisabled('.rp-next')) && (await live()) === 'Record 4 of 4: Alternative & Punk Track', 'ArrowDown flips to the last record; Next is disabled at the end');
await page.keyboard.press('ArrowRight'); await settle();
check((await front()) === 'punk', 'no wrap-around past the last record');
await page.keyboard.press('ArrowUp'); await settle();
check((await front()) === 'acoustic', 'ArrowUp flips back');
await page.keyboard.press('Home'); await settle();
check((await front()) === 'indie' && (await page.isDisabled('.rp-prev')) && (await live()) === 'Record 1 of 4: Indie Rock Demo', 'Home goes to the first record');
await page.keyboard.press('ArrowLeft'); await settle();
check((await front()) === 'indie', 'no wrap-around before the first record');
await page.keyboard.press('End'); await settle();
check((await front()) === 'punk', 'End goes to the last record');
await page.keyboard.press('Home'); await settle();
// Mouse wheel: one flip per gesture; ends are left to the page
{
  const b = await page.locator('.rp-stage').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.wheel(0, 100);
  await settle();
  check((await front()) === 'pop', 'one wheel notch flips exactly one record');
  await page.mouse.wheel(0, 100); await page.mouse.wheel(0, 100); await settle();
  check((await front()) === 'pop', 'wheel events right after a flip are throttled');
  await page.waitForTimeout(500);
  await page.mouse.wheel(0, -100); await settle();
  check((await front()) === 'indie', 'wheel up flips back');
  const ends = await page.evaluate(() => { const s = document.querySelector('.rp-stage'), up = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }), dn = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }); s.dispatchEvent(up); const a = up.defaultPrevented; s.dispatchEvent(dn); return [a, dn.defaultPrevented]; });
  check(ends[0] === false && ends[1] === true, 'at the first record a wheel-up is left to the page (page still scrolls); wheel-down is taken');
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('.rp-prev').click()); await settle();
}
// Touch swipe (Pointer Events, 30px threshold) and tap-on-edge
{
  const swipe = (dx, dy) => page.evaluate(([dx, dy]) => { const s = document.querySelector('.rp-stage'), r = s.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, o = { pointerId: 9, pointerType: 'touch', bubbles: true }; s.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientX: x, clientY: y })); s.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: x + dx / 3, clientY: y + dy / 3 })); s.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: x + dx, clientY: y + dy })); s.dispatchEvent(new PointerEvent('pointerup', { ...o, clientX: x + dx, clientY: y + dy })); }, [dx, dy]);
  await swipe(-60, 5); await settle();
  check((await front()) === 'pop', 'swiping left flips to the next record');
  await swipe(60, 0); await settle();
  check((await front()) === 'indie', 'swiping right flips back');
  await swipe(-15, 0); await settle();
  check((await front()) === 'indie', 'a short drag (under 30px) does not flip');
  check((await page.evaluate(() => getComputedStyle(document.querySelector('.rp-stage')).touchAction)) === 'pan-y', 'the crate leaves vertical page scroll to the browser (touch-action: pan-y)');
  await page.click(`${S('acoustic')} .sleeve-strip`); await settle();
  check((await front()) === 'acoustic', 'clicking the title strip of a sleeve behind flips straight to it');
  await page.evaluate(() => document.querySelector('.sleeve[data-src*="track-2"]').click()); await settle();
  check((await front()) === 'pop' && (await page.evaluate(() => document.getElementById('audio-player').dataset.track)).includes('punk'), 'clicking a tipped sleeve flips back to it without loading it');
}
// The loaded record is marked even when it is not in front (punk is on the platter)
{
  const mk = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.sleeve')].map(x => [__g(x), getComputedStyle(x.querySelector('.sleeve-tab')).display])));
  const mkd = await mk();
  check(mkd.punk === 'block' && mkd.indie === 'none' && mkd.pop === 'none' && mkd.acoustic === 'none' && (await front()) === 'pop', 'the "on the platter" tab shows on the loaded sleeve (punk) while another one is in front');
}
// Selecting a flipped-to record: lift, disc travels, sleeve drops back, then the arm swings in
await page.click(S('pop'));
await page.waitForFunction(() => document.querySelector('.record-player').dataset.picking === 'true');
await page.waitForTimeout(500);
{
  const mid = await page.evaluate(() => { const d = document.querySelector('.rp-disc'); return { op: getComputedStyle(d).opacity, anims: d.getAnimations().filter(a => a.playState === 'running').length, lifted: document.querySelector('.sleeve[data-src*="track-2"]').classList.contains('is-lifted'), nav: document.querySelector('.rp-next').disabled && document.querySelector('.rp-prev').disabled, label: d.textContent.trim(), playing: !document.getElementById('audio-player').paused }; });
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
  const mk = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.sleeve')].map(x => [__g(x), getComputedStyle(x.querySelector('.sleeve-tab')).display])));
  check(mk.pop === 'block' && mk.punk === 'none' && (await st()).src === 'media/track-2-bedroom-pop.wav' && (await st()).arm === 'on', 'the loaded marker moved to the front sleeve and its record plays');
}
await page.click(S('pop'));
check((await st()).paused && (await st()).arm === 'lifted', 'clicking the loaded front sleeve toggles pause');
await pick(page, 'punk');
await playing();

// A/B deck and record player pause each other
await page.evaluate(() => document.querySelector('.ab-compare').scrollIntoView());
await page.waitForFunction(() => [...document.querySelectorAll('.ab-player audio')].every(a => a.src.startsWith('blob:') && a.readyState >= 1));
await page.evaluate(() => document.querySelector('.ab-play').click());
await page.waitForTimeout(300);
s = await st();
check(s.paused && s.arm === 'lifted', 'starting the A/B deck pauses the record player');
await page.evaluate(() => document.querySelector('.ab-play').click());
await page.evaluate(() => document.querySelector('.rp-play').click());
await page.waitForTimeout(300);
check((await page.evaluate(() => [...document.querySelectorAll('.ab-player audio')].every(a => a.paused))) && !(await st()).paused, 'starting the record player pauses the A/B deck');

// Track end: arm rests, record stays, nothing else starts
await page.evaluate(() => { const a = document.getElementById('audio-player'); a.currentTime = a.duration - 0.2; });
await page.waitForFunction(() => document.getElementById('audio-player').ended, null, { timeout: 5000 });
await page.waitForTimeout(300);
s = await st();
check(s.paused && s.arm === 'rest' && s.state === 'loaded' && s.src === 'media/track-4-punk.wav', 'at track end the arm returns to rest, the record stays, nothing else starts');
check((await page.evaluate(() => [...document.querySelectorAll('audio')].every(a => a.paused))), 'no media element is playing after the end');
await pick(page, 'punk');
await page.waitForFunction(() => !document.getElementById('audio-player').paused, null, { timeout: 3000 });
check((await st()).arm === 'on', 'clicking the finished record swings the arm in and plays it again');

// ---- Ticket 02: seeking with the tonearm and the timeline ----
await pick(page, 'indie');
await page.waitForFunction(() => document.getElementById('audio-player').duration > 5 && !document.getElementById('audio-player').paused);
await page.click('.rp-play'); // pause so only our seeks move the playhead
const ct = () => page.evaluate(() => document.getElementById('audio-player').currentTime);
const arm = () => page.evaluate(() => ({ now: +document.querySelector('.rp-arm').getAttribute('aria-valuenow'), max: +document.querySelector('.rp-arm').getAttribute('aria-valuemax'), text: document.querySelector('.rp-arm').getAttribute('aria-valuetext'), ang: parseFloat(document.querySelector('.record-player').style.getPropertyValue('--arm-angle')), tl: document.querySelector('.scrubber-track').getAttribute('aria-valuenow') }));
let a = await arm();
const dur = a.max;
check(dur > 5 && (await page.getAttribute('.rp-arm', 'aria-disabled')) === 'false' && (await page.getAttribute('.rp-arm', 'tabindex')) === '0', `tonearm is enabled once a record is loaded (duration ${dur}s)`);
check(/^0:0\d of \d+:\d\d$/.test(a.text) && a.ang > 25 && a.ang < 40, `arm at the outer groove at the start (${a.ang}deg, "${a.text}")`);
await page.focus('.rp-arm');
await page.keyboard.press('ArrowRight');
a = await arm();
check(Math.abs((await ct()) - 5) < 0.3 && a.now === 5 && a.tl === '5', 'ArrowRight seeks +5s; aria-valuenow follows on arm and timeline');
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

// Timeline slider: click and keys seek, in sync with the arm
await page.locator('.scrubber-track').scrollIntoViewIfNeeded();
const tl = await page.locator('.scrubber-track').boundingBox();
await page.mouse.click(tl.x + tl.width * 0.25, tl.y + tl.height / 2);
a = await arm();
check(Math.abs((await ct()) - dur * 0.25) < dur * 0.05 && a.now === Math.round(await ct()) , 'clicking the timeline seeks, and the arm follows');
await page.focus('.scrubber-track');
await page.keyboard.press('ArrowRight');
check(Math.abs((await ct()) - (dur * 0.25 + 5)) < dur * 0.06 && (await page.getAttribute('.scrubber-track', 'role')) === 'slider', 'timeline is a slider; ArrowRight seeks +5s');
await page.mouse.move(tl.x + 4, tl.y + tl.height / 2); await page.mouse.down(); await page.mouse.move(tl.x + tl.width * 0.75, tl.y + tl.height / 2, { steps: 4 });
check(Math.abs((await arm()).ang - (angStart + (angEnd - angStart) * 0.75)) < 2, 'dragging the timeline moves the needle too');
await page.mouse.up();
check(Math.abs((await ct()) - dur * 0.75) < dur * 0.05, 'timeline drag commits on release');
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
await page.evaluate(() => { const q = g => document.querySelector(`.sleeve[data-src*="track-${({ indie: 1, pop: 2, acoustic: 3, punk: 4 })[g]}"]`), nx = document.querySelector('.rp-next'); [() => q('indie').click(), () => q('indie').click(), () => nx.click(), () => q('pop').click(), () => q('acoustic').click()].forEach((f, i) => setTimeout(f, i * 40)); });
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
  await p3.click('.rp-next');
  await p3.click(S('pop'));
  await p3.waitForFunction(() => document.getElementById('audio-player').dataset.track === 'media/track-2-bedroom-pop.wav' && !document.getElementById('audio-player').paused, null, { timeout: 600 });
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
  const r = await p2.evaluate(() => { const a = document.getElementById('audio-player'); return { blob: a.src.startsWith('blob:'), d: a.duration, shown: document.getElementById('total-time').textContent }; });
  check(r.blob && isFinite(r.d) && r.shown !== '0:00' && hdrs.every(c => c === 200), `no-Range server: clip is a blob, real duration ${r.d.toFixed(1)}s shown as ${r.shown}`);
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
  const nav = [...document.querySelectorAll('.rp-flip')].map(b => b.getBoundingClientRect());
  return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, below: c.top >= t.bottom - 1, tw: t.width, cwid: c.width, left: c.left, right: c.right, nav: nav.every(r => r.width >= 44 && r.height >= 44) };
});
check(m.sw <= m.cw, `no horizontal overflow at 375px (scrollWidth ${m.sw}, client ${m.cw})`);
check(m.below && m.left >= 0 && m.right <= m.cw, 'phone: the crate sits below the turntable and fits the screen');
check(m.tw > 300 && m.cwid > 300, `phone: turntable and crate are full width (${Math.round(m.tw)}px, ${Math.round(m.cwid)}px)`);
check(m.nav, 'phone: previous/next keys are at least 44px');
await page.click('.rp-next'); await page.click(S('pop'));
await page.waitForFunction(() => !document.getElementById('audio-player').paused, null, { timeout: 6000 });
check((await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)), 'phone: no horizontal overflow while a record is on the platter');
{ // the disc travels: take a look mid-way that it never makes the page wider
  await page.click('.rp-next'); await page.waitForTimeout(0);
  await page.evaluate(() => document.querySelector('.sleeve[data-pos="front"]').click());
  const ws = [];
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(160); ws.push(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)); }
  check(ws.every(w => w <= 0), `phone: no horizontal overflow while the disc travels (${ws})`);
}

await browser.close(); server.close(); plain.close();
process.exit(fail ? 1 : 0);
