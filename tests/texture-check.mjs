// Tactile textures: size budget, license list, --tex-strength toggles, scheme attr, accessibility off-switches.
// Run: node tests/texture-check.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
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
const check = (ok, label, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ' ' + detail : ''}`); };

// Files: budget and licenses
const texDir = join(root, 'images', 'textures');
const webps = (await readdir(texDir)).filter(f => f.endsWith('.webp'));
let total = 0;
for (const f of webps) total += (await stat(join(texDir, f))).size;
check(webps.length > 0 && total <= 150 * 1024, 'texture files <= 150 KB', `(${webps.length} files, ${(total / 1024).toFixed(1)} KB)`);
const licenses = await readFile(join(texDir, 'LICENSES.md'), 'utf8');
for (const f of webps) check(licenses.includes(f), `LICENSES.md names ${f}`);
// Tiles carry alpha (VP8X header with the alpha flag): mask tiles are alpha-only and tape.webp's
// alpha is the strip outline. paper.webp is the one opaque scan (multiplied onto the page colour).
for (const f of webps.filter(f => f !== 'paper.webp')) {
  const b = await readFile(join(texDir, f));
  const alpha = b.toString('ascii', 12, 16) === 'VP8X' && (b[20] & 0x10) !== 0;
  check(alpha, `${f} has an alpha channel`);
}
// Engines disagree on mask-composite / multi-layer luminance masks: never use them
const css = (await readFile(join(root, 'textures.css'), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
check(!/mask-composite/.test(css) && !/mask-mode/.test(css), 'textures.css has no mask-composite or mask-mode');
check(!/mask(-image)?:[^;]*,[^;]*;/.test(css.replace(/url\([^)]*\)/g, 'u')), 'textures.css has no multi-layer masks');

// Browser behavior
const browser = await chromium.launch();
const strength = page => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tex-strength').trim());
async function open(query = '', ctxOpts = {}, file = 'index.html') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...ctxOpts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  await page.goto(`${base}/${file}${query}`);
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

{
  const { ctx, page, errors } = await open('?devtoolbar'); // the theme toolbar is dev-only: localhost + ?devtoolbar
  check(await strength(page) === '1', 'default --tex-strength is 1', `(got ${await strength(page)})`);
  check(errors.length === 0, 'no console/network errors on index.html', errors.join('; '));
  // toolbar buttons: dispatch real clicks even if the dock is collapsed
  for (const [mode, expected] of [['off', '0'], ['bold', '1.6'], ['quiet', '1']]) {
    await page.locator(`[data-texture-btn="${mode}"]`).evaluate(b => b.click());
    await page.waitForTimeout(100);
    const attr = await page.evaluate(() => document.documentElement.dataset.texture);
    check(attr === mode && await strength(page) === expected, `Texture button ${mode} sets data-texture and --tex-strength=${expected}`, `(attr=${attr}, strength=${await strength(page)})`);
  }
  await ctx.close();
}
for (const [mode, expected] of [['off', '0'], ['bold', '1.6']]) {
  const { ctx, page } = await open(`?texture=${mode}`);
  check(await strength(page) === expected, `?texture=${mode} gives --tex-strength ${expected}`, `(got ${await strength(page)})`);
  await ctx.close();
}
{
  const { ctx, page } = await open('?theme=seth-olive-orange-dark');
  const scheme = await page.evaluate(() => document.documentElement.dataset.scheme);
  check(scheme === 'dark', '?theme=seth-olive-orange-dark sets data-scheme=dark', `(got ${scheme})`);
  await ctx.close();
}

// Hero wordmark at ?texture=off: no mask on the h1 or the mark, and the wear overlay is not rendered
{
  const { ctx, page } = await open('?texture=off');
  const r = await page.evaluate(() => {
    const h1 = document.querySelector('h1.studio-wordmark'), mark = h1.querySelector('.logo-mark--hero');
    const after = getComputedStyle(h1, '::after');
    return { h1Mask: getComputedStyle(h1).maskImage, after: after.display, opacity: after.opacity, markMask: getComputedStyle(mark).webkitMaskImage };
  });
  check(r.h1Mask === 'none', 'hero h1 has no mask at ?texture=off', `(mask-image=${r.h1Mask})`);
  check(r.after === 'none' || r.opacity === '0', 'hero wear overlay is invisible at ?texture=off', `(display=${r.after}, opacity=${r.opacity})`);
  check(r.markMask !== 'none', 'hero logo mark keeps its own logo mask', `(${r.markMask.slice(0, 40)})`);
  await ctx.close();
}
{
  const { ctx, page } = await open('?texture=quiet');
  const r = await page.evaluate(() => { const a = getComputedStyle(document.querySelector('h1.studio-wordmark'), '::after'); return { display: a.display, opacity: parseFloat(a.opacity) }; });
  check(r.display !== 'block', 'hero has no wear overlay at quiet', `(display=${r.display})`);
  await ctx.close();
}

// Hero logo: subtle grainy blur edge (no switch); clean at ?texture=off and under reduced transparency
const logoEdge = page => page.evaluate(() => ({ filter: getComputedStyle(document.querySelector('h1.studio-wordmark')).filter,
  def: !!document.querySelector('filter#logo-edge-grain feGaussianBlur') && !!document.querySelector('filter#logo-edge-grain feTurbulence'), ink: !!document.querySelector('#logo-edge-ink, #logo-edge-fuzz'),
  control: !!document.querySelector('[data-edge-btn]') }));
// Page layer: the brushed metal sheet in body::before (paper is not a page surface)
const pagePaper = page => page.evaluate(() => { const c = getComputedStyle(document.body, '::before');
  return { display: c.display, position: c.position, height: parseFloat(c.height), docH: document.documentElement.scrollHeight, opacity: parseFloat(c.opacity), mask: c.maskImage || c.webkitMaskImage, bg: c.backgroundImage, blend: c.backgroundBlendMode }; });
{
  const { ctx, page } = await open();
  const r = await logoEdge(page);
  check(r.filter === 'none' && !r.def && !r.ink && !r.control, 'hero logo has no grainy edge filter (removed)', `(filter=${r.filter})`);
  const p = await pagePaper(page);
  check(p.display !== 'none' && p.position === 'absolute' && p.height >= p.docH - 1 && /metal\.webp/.test(p.mask) && p.bg === 'none' && p.opacity > 0 && p.opacity <= 0.3, 'page surface is the brushed metal sheet (no paper), scrolling with the page', `(opacity=${p.opacity}, height=${p.height}/${p.docH})`);
  await ctx.close();
}
{
  const { ctx, page } = await open('?texture=off');
  const r = await logoEdge(page), p = await pagePaper(page);
  check(r.filter === 'none' && p.display === 'none', 'logo edge and page surface are off at ?texture=off', `(filter=${r.filter}, surface=${p.display})`);
  await ctx.close();
}
{
  const { ctx, page } = await open();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  const r = await logoEdge(page), p = await pagePaper(page);
  check(r.filter === 'none' && p.display === 'none', 'reduced transparency hides logo edge and page surface', `(filter=${r.filter}, surface=${p.display})`);
  await ctx.close();
}

// Tape: a scanned strip multiplied onto the palette's tape colour, cut by its own alpha; flat at Off.
// Polaroid frame: the scanned paper multiplied onto the frame colour; plain at Off.
{
  const tape = page => page.evaluate(() => { const el = document.querySelector('.media-box.has-photo:not(.has-video)'); if (!el) return null;
    const c = getComputedStyle(el, '::before'), f = getComputedStyle(el); return { bg: c.backgroundImage, blend: c.backgroundBlendMode, mask: c.maskImage || c.webkitMaskImage, frame: f.backgroundImage, frameBlend: f.backgroundBlendMode }; });
  let { ctx, page } = await open('', {}, 'about.html');
  let t = await tape(page);
  check(t && /tape\.webp/.test(t.bg) && /tape\.webp/.test(t.mask) && t.blend === 'multiply', 'polaroid tape is the scanned strip with its own outline', `(blend=${t && t.blend})`);
  check(t && /paper\.webp/.test(t.frame) && /multiply/.test(t.frameBlend), 'polaroid frame carries the scanned paper', `(blend=${t && t.frameBlend})`);
  await ctx.close();
  ({ ctx, page } = await open('?texture=off', {}, 'about.html'));
  t = await tape(page);
  check(t && t.bg === 'none' && t.mask === 'none' && t.frame === 'none', 'tape is a flat strip and the frame is plain at ?texture=off');
  await ctx.close();
}

// Brushed metal is the default and only page surface (metal.webp sheet + fixed sheen); the
// Surface control offers only its two strengths, a stale ?surface=paper falls back to metal; Off hides both layers
{
  const surf = page => page.evaluate(() => { const b = getComputedStyle(document.body, '::before'), a = getComputedStyle(document.body, '::after');
    return { attr: document.documentElement.dataset.surface, mask: b.maskImage || b.webkitMaskImage, bg: b.backgroundImage, sheen: a.display !== 'none' && a.position === 'fixed' && /gradient/.test(a.backgroundImage), afterDisplay: a.display }; });
  let { ctx, page } = await open('?devtoolbar');
  let r = await surf(page);
  check(r.attr === 'metal' && /metal\.webp/.test(r.mask) && r.bg === 'none' && r.sheen, 'default surface is brushed metal with a fixed sheen', `(surface=${r.attr})`);
  const btns = await page.evaluate(() => [...document.querySelectorAll('[data-surface-btn]')].map(b => b.dataset.surfaceBtn).join(','));
  check(btns === 'metal,metal-subtle', 'Surface control has no Paper option', `(${btns})`);
  await ctx.close();
  ({ ctx, page } = await open('?surface=paper'));
  r = await surf(page);
  check(r.attr === 'metal' && r.sheen, '?surface=paper falls back to brushed metal', `(surface=${r.attr})`);
  await ctx.close();
  ({ ctx, page } = await open('?surface=metal&texture=off'));
  r = await surf(page);
  check(r.attr === 'metal' && r.afterDisplay === 'none', '?surface=metal works and Off hides the sheen', `(surface=${r.attr}, after=${r.afterDisplay})`);
  await ctx.close();
}

// Subtle metal and the Cards switch
{
  let { ctx, page } = await open('?surface=metal-subtle');
  const sub = await page.evaluate(() => ({ attr: document.documentElement.dataset.surface, mask: getComputedStyle(document.body, '::before').maskImage || getComputedStyle(document.body, '::before').webkitMaskImage, a: parseFloat(getComputedStyle(document.body, '::after').opacity) }));
  check(sub.attr === 'metal-subtle' && /metal\.webp/.test(sub.mask) && sub.a > 0 && sub.a < 0.6, 'Metal (Subtle) uses the metal tile at reduced strength', `(sheen opacity=${sub.a})`);
  await ctx.close();
  ({ ctx, page } = await open());
  const card = () => page.evaluate(() => { const c = getComputedStyle(document.querySelector('.card')); return { attr: document.documentElement.dataset.cards, border: c.borderTopWidth, shadow: c.boxShadow, bg: c.backgroundColor }; });
  const c = await card();
  check(c.attr === undefined && c.border === '0px' && c.shadow !== 'none' && c.bg !== 'rgba(0, 0, 0, 0)', 'Cards are Card Stock by default: a borderless sheet with a shadow', `(shadow=${c.shadow.slice(0, 30)})`);
  await ctx.close();
}

// Tape variation: strips on neighbouring cards differ (angle, flip, length, shift, shade).
{
  const { ctx, page } = await open('', {}, 'index.html');
  const sigs = await page.evaluate(() => { const boxes = [...document.querySelectorAll('.media-box.has-photo:not(.has-video)')];
    const grid = boxes.map(b => b.parentElement.parentElement).find(g => boxes.filter(b => b.parentElement.parentElement === g).length >= 3);
    return boxes.filter(b => b.parentElement.parentElement === grid).slice(0, 3).map(b => { const c = getComputedStyle(b, '::before'); return [c.scale, c.transform, c.width, c.marginLeft, c.filter].join(' ') + '|' + getComputedStyle(b).transform; }); });
  check(new Set(sigs.map(s => s.split('|')[1])).size === 3, 'three neighbouring polaroids all tilt differently');
  check(sigs.length === 3 && new Set(sigs).size === 3, 'three neighbouring strips of tape all differ', `(${new Set(sigs).size} distinct of ${sigs.length})`);
  await ctx.close();
}

// Tape: only masking tape, three different scans rotated across the cards.
{
  const tapes = page => page.evaluate(() => [...document.querySelectorAll('.media-box.has-photo:not(.has-video)')].map(el => { const c = getComputedStyle(el, '::before'); return { bg: c.backgroundImage, mask: c.maskImage || c.webkitMaskImage, display: c.display }; }));
  let { ctx, page } = await open('', {}, 'about.html');
  check(await page.locator('[data-tape-btn]').count() === 0, 'no Tape control: masking is the only tape');
  const all = await tapes(page);
  const scans = new Set(all.map(t => (t.mask.match(/tape(-\d)?\.webp/) || [])[0]));
  check(all.length > 0 && all.every(t => /^url\(/.test(t.bg) && t.display !== 'none'), 'every photo wears a scanned masking-tape strip', `(${all.length} photos)`);
  check(all.length < 3 || scans.size > 1, 'strips use more than one scan', `(${[...scans].join(',')})`);
  await ctx.close();
  ({ ctx, page } = await open('?texture=off', {}, 'about.html'));
  const off = await tapes(page);
  check(off.every(t => t.bg === 'none' && t.mask === 'none'), 'Off leaves a flat tape strip', `(${off[0] && off[0].bg})`);
  await ctx.close();
}

// Gradient intensity: full (default) sweeps the whole palette; flat collapses the wordmark gradient to the primary accent.
{
  const grad = page => page.evaluate(() => { const c = getComputedStyle(document.querySelector('.logo-mark--hero'));
    const stops = (c.backgroundImage.match(/(rgba?|color)\([^)]*\)/g) || []).map(v => { const n = v.match(/[\d.]+/g).slice(0, 3).map(Number); return (v.startsWith('color') ? n.map(x => Math.round(x * 255)) : n).join(','); }); return { attr: document.documentElement.dataset.gradient, stops }; });
  let { ctx, page } = await open('?devtoolbar', {}, 'index.html');
  const full = await grad(page);
  check(full.attr === 'full' && full.stops.length === 3 && new Set(full.stops).size === 3, 'default gradient is full: three distinct stops', `(gradient=${full.attr})`);
  const kinds = await page.locator('[data-gradient-btn]').evaluateAll(bs => bs.map(b => b.dataset.gradientBtn).join(','));
  check(kinds === 'flat,soft,medium,full,bold', 'Gradient control offers flat, soft, medium, full, bold', `(${kinds})`);
  await page.locator('[data-gradient-btn="soft"]').evaluate(b => b.click()); await page.waitForTimeout(100);
  let g = await grad(page);
  check(g.attr === 'soft' && g.stops[0] === full.stops[0] && g.stops[1] !== full.stops[1] && g.stops[1] !== g.stops[0], 'Soft gradient sits between flat and full');
  await page.locator('[data-gradient-btn="flat"]').evaluate(b => b.click()); await page.waitForTimeout(100);
  g = await grad(page);
  check(g.attr === 'flat' && new Set(g.stops).size === 1, 'Flat gradient is one colour', `(${g.stops.join(' ')})`);
  const raw = page => page.evaluate(() => getComputedStyle(document.querySelector('.logo-mark--hero')).backgroundImage);
  await page.locator('[data-gradient-btn="full"]').evaluate(b => b.click()); await page.waitForTimeout(100);
  const fullRaw = await raw(page);
  await page.locator('[data-gradient-btn="bold"]').evaluate(b => b.click()); await page.waitForTimeout(100);
  const boldRaw = await raw(page);
  check(/oklch/.test(boldRaw) && boldRaw !== fullRaw, 'Bold gradient pushes the far stops past the palette', `(${boldRaw.slice(0, 120)})`);
  await ctx.close();
  ({ ctx, page } = await open('?gradient=medium', {}, 'index.html'));
  g = await grad(page);
  check(g.attr === 'medium' && new Set(g.stops).size === 3, '?gradient= works', `(gradient=${g.attr})`);
  await ctx.close();
}

await browser.close(); server.close();
process.exit(failures ? 1 : 0);
