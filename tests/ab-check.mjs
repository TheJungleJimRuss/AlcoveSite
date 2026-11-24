// Work page cassette A/B deck: flip keeps the playhead, transport keys, seek, keyboard, events, reduced motion.
// Run: node tests/ab-check.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.mjs': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    const body = await readFile(join(root, decodeURIComponent(path)));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);

const browser = await chromium.launch();
const url = `http://localhost:${server.address().port}/work.html`;
let fail = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fail++; };
const loaded = p => p.waitForFunction(() => [...document.querySelectorAll('.ab-player audio')].every(a => a.src.startsWith('blob:') && a.readyState >= 1));
const st = p => p.evaluate(() => { const s = window.__abDeck.state(); return { ...s, audio: undefined }; });
const open = async (opts = {}) => {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.evaluate(() => document.querySelector('.ab-compare').scrollIntoView({ block: 'center' }));
  return { ctx, page, errors };
};

{
  const { ctx, page, errors } = await open({ reducedMotion: 'no-preference' });
  await loaded(page);
  check(await page.evaluate(() => !!window.__abDeck && document.querySelector('.ab-compare').dataset.version === 'memo'), 'deck starts on Side A (memo)');
  // events
  await page.evaluate(() => {
    window.__ev = [];
    const s = document.querySelector('.ab-compare');
    ['ab:flip-start', 'ab:flip-end'].forEach(n => s.addEventListener(n, e => window.__ev.push([n, e.detail])));
    window.__states = 0; s.addEventListener('ab:state', () => window.__states++);
  });
  // seek + flip keeps playhead
  await page.evaluate(() => window.__abDeck.seek(1.5));
  await page.click('#ab-key-flip');
  check(await page.evaluate(() => window.__abDeck.state().flipping), 'flipping is true during the animation');
  await page.click('#ab-key-flip'); // double flip guard
  await page.waitForFunction(() => !window.__abDeck.state().flipping);
  check(await page.evaluate(() => document.querySelector('.ab-compare').dataset.version) === 'master', 'flip shows Side B (master)');
  const t = await page.evaluate(() => document.querySelector('audio[data-version="master"]').currentTime);
  check(Math.abs(t - 1.5) < 0.05, `master picks up at the memo position (got ${t})`);
  check(await page.textContent('#ab-time') === '0:01', 'counter shows the shared position');
  check(/Finished Master/.test(await page.textContent('.ab-player .deck-label')), 'deck label names the master');
  const ev = await page.evaluate(() => window.__ev);
  check(ev.length === 2 && ev[0][0] === 'ab:flip-start' && ev[0][1].from === 'memo' && ev[0][1].to === 'master' && ev[1][0] === 'ab:flip-end' && ev[1][1].version === 'master', `double flip ran once, events fired (${JSON.stringify(ev.map(e => e[0]))})`);
  // tapping the cassette flips back
  await page.click('#cassette-stage');
  await page.waitForFunction(() => !window.__abDeck.state().flipping);
  check(await page.evaluate(() => document.querySelector('.ab-compare').dataset.version) === 'memo', 'tapping the cassette flips it');
  // keys: F, Space
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('f');
  await page.waitForFunction(() => !window.__abDeck.state().flipping);
  check((await st(page)).version === 'master', 'F flips the tape');
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  check((await st(page)).playing && await page.getAttribute('#ab-key-play', 'aria-pressed') === 'true', 'Space plays; Play key latched (aria-pressed)');
  check(await page.evaluate(() => document.querySelector('.site-header .nav-wave')?.classList.contains('is-on')), 'nav waveform shows while audio plays');
  check(await page.evaluate(() => window.__states) > 3, 'ab:state fires while playing');
  // reels spin while playing (rAF may be throttled in hidden tabs; allow either a changed angle)
  const reel0 = (await st(page)).reel;
  await page.waitForTimeout(500);
  const s1 = await st(page);
  check(s1.reel !== reel0 && await page.evaluate(() => document.querySelector('.cd-reel-l').style.rotate) !== '', 'reels turn while playing (rotate on the reel images)');
  const packs = await page.evaluate(() => ({ l: parseFloat(document.querySelector('.cd-pack-l').style.scale), r: parseFloat(document.querySelector('.cd-pack-r').style.scale) }));
  check(packs.l < 0.9 && packs.r > 0.5, `tape pack moves left to right with progress (${JSON.stringify(packs)})`);
  // flip while playing keeps playing
  const before = s1.time;
  await page.click('#ab-key-flip');
  await page.waitForFunction(() => !window.__abDeck.state().flipping);
  await page.waitForTimeout(300);
  const s2 = await st(page);
  check(s2.version === 'memo' && s2.playing && s2.time >= before - 0.05, `flip while playing keeps playing on the other side (t ${before.toFixed(2)} -> ${s2.time.toFixed(2)})`);
  const reelFlip = await page.evaluate(async () => { window.__abDeck.flip(); const a = window.__abDeck.state().reel; await new Promise(r => setTimeout(r, 120)); const b = window.__abDeck.state().reel; return [a, b]; });
  check(reelFlip[0] === reelFlip[1], 'reels hold still during a flip');
  await page.waitForFunction(() => !window.__abDeck.state().flipping);
  // pause
  await page.click('#ab-key-pause');
  await page.waitForTimeout(300);
  check(!(await st(page)).playing && await page.getAttribute('#ab-key-play', 'aria-pressed') === 'false', 'Pause stops playback and unlatches Play');
  check(await page.evaluate(() => !document.querySelector('.site-header .nav-wave').classList.contains('is-on')), 'nav waveform hides when paused');

  // no on-page scrubber or VU dials; seeking stays available through __abDeck
  check(await page.evaluate(() => !document.getElementById('ab-seek') && !document.querySelector('.vu-face,.deck-meters,input[type=range].ab-seek') && !window.__vuMeters), 'scrubber and VU dials are gone');
  await page.evaluate(() => window.__abDeck.seek(3));
  check(Math.abs((await st(page)).time - 3) < 0.1 && await page.textContent('#ab-time') === '0:03', '__abDeck.seek moves the counter');
  check(await page.evaluate(() => !document.querySelector('.key-glyph') && ['play', 'pause', 'stop', 'flip'].every(k => { const b = document.getElementById('ab-key-' + k); return b.getAttribute('aria-label') && b.textContent.trim() === '' && !b.closest('#cassette-stage'); })), 'key row is gone: the 4 keys are labelled overlay buttons on the player, outside the stage click target')
  // stop
  await page.click('#ab-key-play'); await page.waitForTimeout(200);
  await page.click('#ab-key-stop');
  const s3 = await st(page);
  check(!s3.playing && s3.time === 0 && await page.textContent('#ab-time') === '0:00', 'Stop returns to 0:00');
  // keys ignored in buttons: F on a focused key does not flip
  const vBefore = (await st(page)).version;
  await page.focus('#ab-key-stop'); await page.keyboard.press('f'); await page.waitForTimeout(500);
  check((await st(page)).version === vBefore, 'F on a focused key does not flip');
  // edit keys
  const keys = await page.evaluate(() => ['work.ab.label-memo', 'work.ab.label-master', 'work.ab.col-memo', 'work.ab.col-master', 'work.ab.mic.memo', 'work.p.slide-the-switch-while-it-plays'].every(k => document.querySelector(`[data-edit-key="${k}"]`)));
  check(keys, 'edit keys still present');
  check((await page.evaluate(() => [...document.querySelectorAll('.ab-player audio')].map(a => a.src))).every(s => s.startsWith('blob:')), 'both clips are fully loaded in memory (seekable on any server)');
  check(errors.length === 0, 'no console errors ' + errors.join(' | '));
  await ctx.close();
}

{
  // Reduced motion: flip is instant, no spin.
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  await loaded(page);
  await page.evaluate(() => { window.__abDeck.seek(2); window.__abDeck.play(); });
  await page.waitForTimeout(300);
  await page.click('#ab-key-flip');
  const instant = await page.evaluate(() => ({ s: window.__abDeck.state().flipping, v: document.querySelector('.ab-compare').dataset.version, anims: document.querySelector('.cd-door-strip').getAnimations().length }));
  await page.waitForTimeout(100);
  check(instant.anims === 0 && (await st(page)).version === 'master' && !(await st(page)).flipping, 'reduced motion: flip has no animation and lands on B');
  check((await st(page)).playing, 'reduced motion: flip while playing keeps playing');
  await page.waitForTimeout(400);
  check((await st(page)).reel === 0, 'reduced motion: reels do not spin');
  await ctx.close();
}

{
  // Later in the song: the hidden track may not be buffered yet (server without Range support).
  const { ctx, page } = await open();
  await loaded(page);
  await page.evaluate(() => { document.querySelector('.ab-player audio[data-version="memo"]').currentTime = 14; });
  await page.waitForTimeout(200);
  await page.click('#ab-key-flip');
  await page.waitForFunction(() => !window.__abDeck.state().flipping);
  await page.waitForTimeout(200);
  const late = await page.evaluate(() => document.querySelector('.ab-player audio[data-version="master"]').currentTime);
  check(Math.abs(late - 14) < 0.3, `master picks up at 0:14 (got ${late})`);
  await ctx.close();
}

{
  // Play before the clips finish loading, then flip: the master must still load, seek and play.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route('**/*.mp3', async r => { await new Promise(res => setTimeout(res, 1500)); r.continue(); });
  await page.goto(url);
  await page.evaluate(() => document.querySelector('.ab-compare').scrollIntoView());
  await page.click('#ab-key-play');
  await page.waitForTimeout(2500);
  await page.click('#ab-key-flip');
  await page.waitForTimeout(2000);
  const early = await page.evaluate(() => { const m = document.querySelector('.ab-player audio[data-version="master"]'); return { t: m.currentTime, playing: !m.paused, dur: m.duration }; });
  check(early.playing && early.t > 0.5 && early.dur > 0, `master loads and plays after an early flip (got ${JSON.stringify(early)})`);
  await ctx.close();
}

// Controls live on the player: transparent buttons sit over the rendered keys. Click each at its centre with a real mouse.
async function keyChecks(page, label) {
  await page.evaluate(() => document.querySelector('.deck-top').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(600);
  const geo = await page.evaluate(() => { const st = document.getElementById('cassette-stage').getBoundingClientRect(); return ['play', 'pause', 'stop', 'flip'].map(k => { const r = document.getElementById('ab-key-' + k).getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { k, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, inside: r.top > st.top && r.bottom < st.bottom && r.left >= st.left - 1 && r.right <= st.right + 1, hit: hit && hit.id, cursor: getComputedStyle(document.getElementById('ab-key-' + k)).cursor }; }); });
  check(geo.every(g => g.inside && g.hit === 'ab-key-' + g.k && g.w >= 40 && g.h >= 40), label + ': the four keys sit on the player, hit-testable, at least 40px (' + geo.map(g => g.k + ' ' + Math.round(g.w) + 'x' + Math.round(g.h)).join(', ') + ')');
  check(geo.every(g => g.cursor !== 'auto' && g.cursor !== 'default'), label + ': keys show a pointer cursor');
  const at = k => geo.find(g => g.k === k);
  const click = async k => { await page.mouse.click(at(k).x, at(k).y); await page.waitForTimeout(150); };
  await click('play');
  check((await st(page)).playing && await page.getAttribute('#ab-key-play', 'aria-pressed') === 'true', label + ': clicking the Play key plays and latches it (aria-pressed)');
  await click('pause');
  check(!(await st(page)).playing && await page.getAttribute('#ab-key-play', 'aria-pressed') === 'false', label + ': clicking the Pause key pauses and unlatches Play');
  await click('play'); await page.waitForTimeout(300); await click('stop');
  check(!(await st(page)).playing && (await st(page)).time === 0, label + ': clicking the Stop key stops at 0:00');
  const v0 = (await st(page)).version;
  await click('flip'); await page.waitForFunction(() => !window.__abDeck.state().flipping, null, { timeout: 8000 });
  check((await st(page)).version !== v0, label + ': clicking the Flip key turns the tape');
  const v1 = (await st(page)).version;
  await page.focus('#ab-key-flip'); await page.keyboard.press('Enter'); await page.waitForFunction(() => !window.__abDeck.state().flipping, null, { timeout: 8000 });
  check((await st(page)).version !== v1, label + ': focus + Enter on the Flip key flips');
  await page.focus('#ab-key-play'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  check((await st(page)).playing && await page.getAttribute('#ab-key-play', 'aria-pressed') === 'true', label + ': focus + Enter on Play plays');
  await page.focus('#ab-key-stop'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  check(!(await st(page)).playing, label + ': focus + Enter on Stop stops');
  const ring = await page.evaluate(() => { document.getElementById('ab-key-pause').focus(); return getComputedStyle(document.getElementById('ab-key-pause')).outlineStyle; });
  check(ring !== 'none', label + ': focused key draws a focus ring');
}

{
  // Image deck: Blender layers, no canvas or three.js; the door swings through its rendered frames on a flip and ends shut.
  const { ctx, page, errors } = await open({ reducedMotion: 'no-preference' });
  const reqs = [];
  page.on('request', r => reqs.push(r.url()));
  await loaded(page);
  const imgs = await page.evaluate(() => [...document.querySelectorAll('#cassette-stage img')].map(i => ({ src: i.currentSrc.split('/').pop(), ok: i.complete && i.naturalWidth > 0 })));
  check((imgs.length === 8 || imgs.length === 9) && imgs.every(i => i.ok), 'all deck layers load (' + imgs.map(i => i.src + (i.ok ? '' : ' MISSING')).join(', ') + ')');
  check(await page.evaluate(() => !document.querySelector('#cassette-stage canvas')), 'no canvas in the stage');
  check(!reqs.some(u => /three|\.glb/.test(u)), 'no three.js or GLB requests');
  const door = await page.evaluate(async () => {
    const strip = document.querySelector('.cd-door-strip'), seen = new Set();
    window.__abDeck.flip();
    const a = strip.getAnimations()[0]; if (!a) return { anim: false };
    a.pause();
    for (let t = 0; t <= 380; t += 19) { a.currentTime = t; seen.add(getComputedStyle(strip).translate); }
    const mid = window.__abDeck.state().version;
    a.play();
    await new Promise(r => { const w = () => (window.__abDeck.state().flipping ? setTimeout(w, 30) : r()); w(); });
    return { anim: true, frames: seen.size, mid, end: window.__abDeck.state().version, rest: strip.getAnimations().length, tr: getComputedStyle(strip).translate };
  });
  check(door.anim && door.frames >= 8, `door steps through its rendered frames while opening (${door.frames} frames)`);
  check(door.mid === 'memo' && door.end === 'master', 'side swaps while the door is open, B after the flip');
  check(door.rest === 0 && /^(none|0px( 0px| 0%)?)$/.test(door.tr), `door is shut again after the flip (${door.tr})`);
  const label = await page.evaluate(() => [...document.querySelectorAll('.cd-label .cs-side')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.dataset.version));
  check(label.join() === 'master', 'label shows Side B only (' + label.join() + ')');
  const chrome = await page.evaluate(() => { const st = getComputedStyle(document.getElementById('cassette-stage')), dk = getComputedStyle(document.querySelector('.cassette-deck')); return { stBg: st.backgroundColor, stPad: st.paddingTop, dkBorder: dk.borderTopWidth, dkBg: dk.backgroundColor, dkPad: dk.paddingTop }; });
  check(chrome.stBg === 'rgba(0, 0, 0, 0)' && chrome.stPad === '0px' && chrome.dkBorder === '0px' && chrome.dkBg === 'rgba(0, 0, 0, 0)' && chrome.dkPad === '0px', 'player has no panel, frame or padding around it (' + JSON.stringify(chrome) + ')');
  await keyChecks(page, 'image deck');
  check(errors.length === 0, 'no console errors with the image deck (' + errors.join('|') + ')');
  await ctx.close();
}

await browser.close(); server.close();
process.exit(fail ? 1 : 0);
