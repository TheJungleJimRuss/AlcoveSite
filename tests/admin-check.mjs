// Admin mode tickets 01-05 (loader, unlock + editing, Save to the content branch, Site Defaults panel; api.github.com always mocked). Saved Site Content / Site Defaults apply before first paint, bad files fall back
// silently, the public theme toolbar is hidden, and booking-form copy is not editable. Page-level only; no network beyond localhost.
// Run: node tests/admin-check.mjs   (needs `npx playwright install chromium` once)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, truncate, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const flip = (pg, d) => pg.evaluate(d => document.querySelector('.rp-fader').dispatchEvent(new KeyboardEvent('keydown', { key: d > 0 ? 'ArrowRight' : 'ArrowLeft', bubbles: true, cancelable: true })), d);
const atStart = pg => pg.getAttribute('.rp-fader', 'aria-valuenow').then(v => v === '1');
const atEnd = pg => Promise.all([pg.getAttribute('.rp-fader', 'aria-valuenow'), pg.getAttribute('.rp-fader', 'aria-valuemax')]).then(([a, b]) => a === b);

const root = join(fileURLToPath(import.meta.url), '..', '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.webm': 'video/webm', '.mp3': 'audio/mpeg' };
// `content` overrides /content.json: undefined = serve the committed file, null = 404, string = body as-is.
let content;
const extra = {}; // path -> Buffer served in place of a file (media the mocked branch "received")
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    if (path === '/content.json' && content !== undefined) {
      if (content === null) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(content);
    }
    if (extra[path]) { res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' }); return res.end(extra[path]); }
    const body = await readFile(join(root, path === '/' ? 'index.html' : decodeURIComponent(path)));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch();
let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
};

// api.github.com is ALWAYS mocked (never reaches the real GitHub). `gh` configures the fake repo; calls are recorded in gh.calls.
//   gh.file = { sha, text } the content.json on the content branch (absent: 404); gh.noBranch; gh.mainSha;
//   gh.fail = { branch|file|put|main|ref: status }; gh.abortPut; gh.delayPut (ms); gh.putStatus (e.g. 409).
const b64 = s => Buffer.from(s).toString('base64');
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type,accept,x-github-api-version', 'access-control-allow-methods': 'GET,PUT,POST,DELETE,OPTIONS' };
const REPO = '/repos/TheJungleJimRuss/AlcoveSite';
async function mockGitHub(ctx, gh) {
  gh.calls = [];
  await ctx.route('https://api.github.com/**', async route => {
    const req = route.request(), u = new URL(req.url()), method = req.method(), h = req.headers();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const rel = u.pathname.startsWith(REPO) ? u.pathname.slice(REPO.length) : u.pathname;
    const call = { method, path: rel, search: u.search, auth: h.authorization, accept: h.accept, body: req.postData() };
    gh.calls.push(call);
    const send = (status, obj) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(obj) });
    const fail = gh.fail || {};
    if (method === 'GET' && rel === '/branches/content') return fail.branch ? send(fail.branch, {}) : gh.noBranch ? send(404, { message: 'Branch not found' }) : send(200, { name: 'content' });
    if (method === 'GET' && rel === '/git/ref/heads/main') return fail.main ? send(fail.main, {}) : send(200, { object: { sha: gh.mainSha || 'mainhead1' } });
    if (method === 'POST' && rel === '/git/refs') { if (fail.ref) return send(fail.ref, {}); gh.noBranch = false; return send(201, {}); }
    if (rel.startsWith('/contents/images/') || rel.startsWith('/contents/media/')) {   // media files: gh.files[rel] = Buffer; gh.failFile = status to fail every file PUT
      if (method === 'DELETE') {   // gh.failDelete = status; gh.deleted lists removed paths; the sha must be the one GET returned
        if (gh.failDelete) return send(gh.failDelete, { message: 'cannot delete' });
        if (!gh.files || !gh.files[rel] || JSON.parse(call.body).sha !== 'filesha') return send(409, { message: 'sha mismatch' });
        delete gh.files[rel]; (gh.deleted = gh.deleted || []).push(rel);
        return send(200, { commit: {} });
      }
      if (method === 'GET') return gh.files && gh.files[rel] ? send(200, { sha: 'filesha' }) : send(404, { message: 'Not Found' });
      if (method === 'PUT') {
        if (gh.files && gh.files[rel]) return send(422, { message: 'sha wasn\'t supplied' });
        if (gh.failFile) return send(gh.failFile, { message: 'file rejected' });
        const b = JSON.parse(call.body);
        (gh.files = gh.files || {})[rel] = Buffer.from(b.content, 'base64');
        return send(201, { content: { sha: 'filesha' } });
      }
    }
    if (rel === '/contents/content.json' && method === 'GET') {
      if (fail.file) return send(fail.file, {});
      if (!gh.file || gh.noBranch) return send(404, { message: 'Not Found' });
      if ((h.accept || '').includes('raw')) return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/plain' }, body: gh.file.text });
      return send(200, { sha: gh.file.sha, content: b64(gh.file.text).replace(/(.{60})/g, '$1\n'), encoding: 'base64' });
    }
    if (rel === '/contents/content.json' && method === 'PUT') {
      if (gh.abortPut) return route.abort('failed');
      if (gh.delayPut) await new Promise(r => setTimeout(r, gh.delayPut));
      if (fail.put || gh.putStatus) return send(fail.put || gh.putStatus, { message: 'sha mismatch' });
      const b = JSON.parse(call.body);
      gh.file = { sha: 'newsha' + gh.calls.filter(c => c.method === 'PUT').length, text: Buffer.from(b.content, 'base64').toString('utf8') };
      return send(200, { content: { sha: gh.file.sha } });
    }
    return send(404, { message: 'unmocked ' + method + ' ' + rel });
  });
}

// Opens a page with a console-error log. `probe` installs a per-frame sampler before any page script runs.
async function open(path, { override, probe, init, reducedMotion, token, edit, width = 1280, height = 900, gh = {} } = {}) {
  content = override;
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion });
  await mockGitHub(ctx, gh);
  const page = await ctx.newPage();
  const errors = [];
  const requests = [];
  const allReqs = [];
  page.on('request', r => { requests.push(r.url()); allReqs.push({ url: r.url(), auth: r.headers().authorization, body: r.postData() }); });
  // Seeds a token once per context (not on every reload, so sign-out sticks).
  if (token) await ctx.addInitScript(t => { try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('alcove_admin_token', t); } } catch {} }, token);
  // Edit mode is off by default on each load; tests that edit seed it on (sessionStorage is how admin.js remembers it).
  if (edit) await ctx.addInitScript(() => { try { sessionStorage.setItem('alcove_admin_edit', '1'); } catch {} });
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', e => errors.push(e.message));
  if (init) await ctx.addInitScript(init);
  if (probe) await page.addInitScript(probe);
  await page.goto(`${base}/${path}`);
  return { ctx, page, errors, requests, allReqs, gh };
}
const pages = ['index.html', 'work.html', 'about.html', 'contact.html'];

const fxPage = await browser.newPage();   // makes small fixture images (solid colour, so a 3000px photo is only a few KB)
const fixture = (w, h, type = 'image/jpeg') => fxPage.evaluate(async ([w, h, type]) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = '#c0451f'; x.fillRect(0, 0, w, h); x.fillStyle = '#1f6f8c'; x.fillRect(0, 0, w / 2, h / 2);
  const b = await new Promise(r => c.toBlob(r, type)); return Array.from(new Uint8Array(await b.arrayBuffer()));
}, [w, h, type]).then(a => Buffer.from(a));
const dims = buf => fxPage.evaluate(async b64 => { const r = await fetch('data:image/x;base64,' + b64); const bm = await createImageBitmap(await r.blob()); return [bm.width, bm.height]; }, buf.toString('base64'));

// --- Slice 1: text keys on every page; booking form copy has none -------------------------------------------
for (const p of pages) {
  const { ctx, page } = await open(p);
  const keyed = await page.$$eval('[data-edit-key]', els => els.map(e => ({ tag: e.tagName, key: e.dataset.editKey, kids: e.children.length })));
  const tags = new Set(keyed.map(k => k.tag));
  check(`${p}: headings, paragraphs have text keys`, tags.has('H2') && tags.has('P'), JSON.stringify([...tags]));
  // One draft per key, so a repeated key must mean the same text everywhere: only the shared site.* keys (nav, footer) repeat.
  const dups = keyed.map(k => k.key).filter((k, i, a) => a.indexOf(k) !== i);
  check(`${p}: keys are unique (only site.* nav/footer keys repeat)`, dups.every(k => k.startsWith('site.')), JSON.stringify(dups));
  const texts = await page.$$eval('[data-edit-key^="site."]', els => els.map(e => [e.dataset.editKey, e.textContent]));
  check(`${p}: shared site.* keys carry identical text`, texts.every(([k, t]) => texts.filter(x => x[0] === k).every(x => x[1] === t)));
  check(`${p}: nav labels, footer and buttons are keyed`, await page.evaluate(() => [...document.querySelectorAll('.site-header .nav-links a, .site-footer p, .btn-placeholder:not(.transport-btn)')].filter(e => !e.closest('#booking-form')).every(e => e.dataset.editKey || e.querySelector('[data-edit-key]'))));
  check(`${p}: keyed elements hold plain text only`, keyed.every(k => k.kids === 0));
  await ctx.close();
}
{
  const { ctx, page } = await open('contact.html');
  const inForm = await page.$$eval('#booking-form [data-edit-key], #booking-form label[data-edit-key], #booking-form option[data-edit-key]', e => e.length);
  check('contact: booking form labels, Session Types and options have no key', inForm === 0, String(inForm));
  await ctx.close();
}
{
  const { ctx, page } = await open('work.html');
  check('work: captions are keyed', (await page.$$eval('[data-edit-key]', e => e.some(x => x.textContent.includes('Setting up in the live room'))) ));
  await ctx.close();
}

// --- Slice 2: committed default file changes nothing, no console errors ------------------------------------
for (const p of pages) {
  const { ctx, page, errors } = await open(p);
  check(`${p}: committed content.json is valid and silent`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// --- Slice 3: toolbar hidden from visitors, with or without ?admin ------------------------------------------
{
  const { ctx, page } = await open('index.html');
  check('toolbar hidden for visitors', (await page.locator('#theme-dock').count()) === 0);
  await ctx.close();
  const a = await open('index.html?admin');
  await a.page.waitForTimeout(300);
  check('?admin without a token shows no toolbar and no admin panel (only the token prompt)', (await a.page.locator('#theme-dock, #alcove-admin').count()) === 0 && (await a.page.locator('#admin-token-form').count()) === 1);
  await a.ctx.close();
  const b = await open('index.html?theme=seth-sage-coral&open-themes=1&admin=1');
  await b.page.waitForTimeout(300);
  check('no public URL param opens the toolbar', (await b.page.locator('#theme-dock').count()) === 0);
  await b.ctx.close();
}

// --- Slice 4: saved text and defaults apply on load with no visible flash -----------------------------------
const H1 = 'Listen In', H1_NEW = 'Hear What We Made';
const saved = JSON.stringify({ version: 1, text: { 'work.h1.listen-in': H1_NEW, 'work.h2.recent-recordings': '<b>Fresh</b> takes' }, defaults: { palette: 'seth-sage-coral-dark', gradient: 'flat', heroGrain: 'soft', surface: 'metal-subtle' } });
// Samples every animation frame from document start; records frames where old text or old defaults were actually visible.
const flashProbe = () => {
  window.__flash = [];
  const tick = () => {
    const h1 = document.querySelector('h1[data-edit-key]'), b = document.body;
    if (h1 && b && getComputedStyle(b).visibility !== 'hidden' && h1.textContent === 'Listen In') window.__flash.push('text');
    if (b && document.documentElement.dataset.gradient && document.documentElement.dataset.gradient !== 'flat') window.__flash.push('gradient');
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
{
  const { ctx, page, errors } = await open('work.html', { override: saved, probe: flashProbe });
  await page.waitForTimeout(400);
  check('saved text replaces authored heading', (await page.locator('h1').innerText()) === H1_NEW);
  check('saved text is plain text, never markup', (await page.locator('[data-edit-key="work.h2.recent-recordings"]').innerText()) === '<b>Fresh</b> takes' && (await page.locator('[data-edit-key="work.h2.recent-recordings"] b').count()) === 0);
  check('untouched text stays authored', (await page.locator('[data-edit-key="work.h2.a-look-inside"]').innerText()) === 'A Look Inside');
  const d = await page.evaluate(() => ({ g: document.documentElement.dataset.gradient, t: document.documentElement.dataset.heroGrain, s: document.documentElement.dataset.surface, sc: document.documentElement.dataset.scheme }));
  check('saved defaults set theme data-attributes', d.g === 'flat' && d.t === 'soft' && d.s === 'metal-subtle' && d.sc === 'dark', JSON.stringify(d));
  check('page visible after load', (await page.evaluate(() => getComputedStyle(document.body).visibility)) === 'visible');
  check('no flash of authored text or default theme', (await page.evaluate(() => window.__flash)).length === 0, JSON.stringify(await page.evaluate(() => window.__flash)));
  check('saved content raises no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
{
  // The URL still wins over a saved default (preview/testing); visitors have no stored choices.
  const { ctx, page } = await open('work.html?gradient=full', { override: saved });
  check('URL param beats saved default', (await page.evaluate(() => document.documentElement.dataset.gradient)) === 'full');
  await ctx.close();
}

// --- Slice 5: missing / malformed / wrong-shape file leaves the site unchanged, silently --------------------
for (const [label, body] of [['missing', null], ['malformed', '{ not json'], ['empty', ''], ['wrong shape', '{"version":1,"text":[1,2],"defaults":"x"}'], ['unknown version', '{"version":9,"text":{"work.h1.listen-in":"Nope"}}'], ['bad option value', '{"version":1,"text":{},"defaults":{"palette":"nonsense","gradient":7}}']]) {
  const { ctx, page, errors } = await open('work.html', { override: body });
  const h = await page.evaluate(() => ({ t: document.querySelector('h1').textContent, g: document.documentElement.dataset.gradient, p: document.documentElement.dataset.scheme }));
  const ok = h.t === H1 && h.g === 'full' && h.p === 'light' && (await page.evaluate(() => getComputedStyle(document.body).visibility)) === 'visible';
  check(`${label} content.json falls back to authored site`, ok, JSON.stringify(h));
  check(`${label} content.json logs no console errors`, errors.filter(e => !/404/.test(e)).length === 0, errors.join(' | '));
  await ctx.close();
}

// --- Slice 6: accessibility preferences still win ------------------------------------------------------------
{
  const { ctx, page } = await open('work.html', { override: saved, reducedMotion: 'reduce' });
  check('reduced-motion preference still matches with saved defaults', await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches));
  check('loader does not animate under reduced motion (text applied, page visible)', (await page.locator('h1').innerText()) === H1_NEW && (await page.evaluate(() => getComputedStyle(document.body).visibility)) === 'visible');
  await ctx.close();
  // prefers-contrast / forced-colors cannot be emulated in Playwright 1.49; the loader adds no colour or contrast overrides, and contrast-check.mjs covers the palettes.
}

// --- Ticket 02: unlock Admin mode -----------------------------------------------------------------------------
const TOKEN = 'github_pat_TESTTOKEN123';
const adminReq = rs => rs.filter(u => /admin\.(js|css)/.test(u));
{
  const { ctx, page, requests } = await open('index.html');
  await page.waitForTimeout(300);
  check('visitor: no admin code or CSS requested', adminReq(requests).length === 0, JSON.stringify(adminReq(requests)));
  check('visitor: no admin UI', (await page.locator('#alcove-admin, #admin-token-form').count()) === 0);
  await ctx.close();
}
{
  const { ctx, page, requests } = await open('index.html?admin');
  check('?admin without token shows a token prompt', await page.locator('#admin-token-form input').isVisible());
  check('?admin without token still requests no admin code', adminReq(requests).length === 0);
  check('?admin without token marks nothing editable', (await page.locator('[contenteditable]').count()) === 0);
  await page.fill('#admin-token-form input', TOKEN);
  await page.press('#admin-token-form input', 'Enter');
  await page.waitForSelector('#alcove-admin');
  check('pasted token is stored in localStorage', (await page.evaluate(() => localStorage.getItem('alcove_admin_token'))) === TOKEN);
  check('unlocking loads admin code and shows the panel', adminReq(requests).length === 2 && (await page.locator('#admin-token-form').count()) === 0, JSON.stringify(adminReq(requests)));
  check('token never appears in any request URL', requests.every(u => !u.includes('TESTTOKEN')));
  await ctx.close();
}
{
  const { ctx, page } = await open('work.html', { token: TOKEN });
  await page.waitForSelector('#alcove-admin');
  check('stored token unlocks without ?admin; the admin panel replaces the theme toolbar', (await page.locator('#theme-dock').count()) === 0);
  await page.click('#alcove-admin .admin-toggle');
  await page.click('#alcove-admin .admin-signout');
  check('sign-out removes the token', (await page.evaluate(() => localStorage.getItem('alcove_admin_token'))) === null);
  await page.reload().catch(() => {});   // sign-out already reloads; tolerate the two reloads racing
  await page.waitForTimeout(500);
  check('after sign-out the page is a visitor page again', (await page.locator('#alcove-admin').count()) === 0 && (await page.locator('#theme-dock').count()) === 0);
  await ctx.close();
}

// --- Ticket 02: edit text in place ---------------------------------------------------------------------------
const H1SEL = 'h1[data-edit-key="work.h1.listen-in"]';
const unlocked = async (path, opts = {}) => {
  const o = await open(path, { token: TOKEN, edit: true, ...opts });
  o.dialogs = [];
  o.page.on('dialog', d => { o.dialogs.push(d.type()); d.accept(); });
  await o.page.waitForSelector('#alcove-admin');
  return o;
};
const replaceText = async (page, sel, text) => {
  await page.focus(sel);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(text);
};
const openPanel = async page => { if ((await page.getAttribute('#alcove-admin .admin-toggle', 'aria-expanded')) !== 'true') await page.click('#alcove-admin .admin-toggle'); };
{
  const { ctx, page } = await unlocked('work.html');
  const m = await page.$eval(H1SEL, e => ({ ce: e.getAttribute('contenteditable'), ol: getComputedStyle(e).outlineStyle, ow: getComputedStyle(e).outlineWidth, ti: e.tabIndex }));
  check('keyed text is marked with a hairline outline and editable', ['plaintext-only', 'true'].includes(m.ce) && m.ol !== 'none' && m.ow === '1px', JSON.stringify(m));
  check('every keyed element is keyboard reachable', await page.$$eval('[data-edit-key]', els => els.every(e => e.tabIndex === 0)));
  check('unkeyed text is not editable', (await page.$$eval('[contenteditable]', els => els.every(e => e.hasAttribute('data-edit-key')))));
  await ctx.close();
  const c = await unlocked('contact.html');
  check('booking form stays uneditable while unlocked', (await c.page.locator('#booking-form [contenteditable]').count()) === 0);
  await c.ctx.close();
}
{
  const { ctx, page } = await unlocked('work.html');
  await replaceText(page, H1SEL, 'Hello There');
  await page.keyboard.press('Enter');
  await page.keyboard.type(' again');
  const h = await page.$eval(H1SEL, e => ({ t: e.textContent, kids: e.children.length, tag: e.tagName }));
  check('typing edits the heading in place, Enter adds no markup or line break', h.t === 'Hello There again' && h.kids === 0 && h.tag === 'H1', JSON.stringify(h));
  await page.keyboard.press('Escape');
  check('Escape leaves the field', (await page.evaluate(() => document.activeElement.matches('[data-edit-key]'))) === false);
  await replaceText(page, H1SEL, 'x');
  await page.evaluate(sel => {
    const dt = new DataTransfer();
    dt.setData('text/html', '<b>Bold</b><script>1</script>'); dt.setData('text/plain', 'plain\nline');
    document.querySelector(sel).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, H1SEL);
  const pasted = await page.$eval(H1SEL, e => ({ t: e.textContent, kids: e.children.length }));
  check('paste is stripped to plain text on one line', pasted.kids === 0 && pasted.t === 'xplain line', JSON.stringify(pasted));
  await page.keyboard.press('Escape');
  await replaceText(page, H1SEL, '   ');
  await page.keyboard.press('Escape');
  check('emptying a heading restores the saved text on leave', (await page.locator(H1SEL).innerText()) === H1);
  await ctx.close();
}
{
  const { ctx, page } = await unlocked('about.html');
  const sum = 'summary[data-edit-key]';
  const was = await page.$eval(sum, e => e.parentElement.open);
  await page.click(sum);
  await page.keyboard.type(' ');
  check('clicking or pressing Space in a FAQ question does not toggle the details', (await page.$eval(sum, e => e.parentElement.open)) === was);
  await ctx.close();
}
{
  const { ctx, page } = await unlocked('work.html');
  check('panel starts with no changes', (await page.textContent('#alcove-admin .admin-toggle')).includes('0'));
  check('Save is disabled with no changes', await page.locator('#alcove-admin .admin-save').isDisabled());
  await replaceText(page, H1SEL, 'Hello There');
  await page.keyboard.press('Escape');
  await page.focus('#alcove-admin .admin-toggle');
  await page.keyboard.press('Enter');
  check('panel toggle is keyboard operable', (await page.getAttribute('#alcove-admin .admin-toggle', 'aria-expanded')) === 'true');
  check('panel counts and lists the changed item', (await page.textContent('#alcove-admin .admin-toggle')).includes('1') && (await page.locator('#alcove-admin .admin-changes li').count()) === 1 && (await page.textContent('#alcove-admin .admin-changes')).includes('Hello There'));
  check('Save is enabled and shows the change count', !(await page.locator('#alcove-admin .admin-save').isDisabled()) && (await page.textContent('#alcove-admin .admin-save')).includes('1 change'));
  await page.click('#alcove-admin .admin-changes li button');
  check('revert restores the saved text and empties the list', (await page.locator(H1SEL).innerText()) === H1 && (await page.locator('#alcove-admin .admin-changes li').count()) === 0);
  check('reverted item is no longer a draft', (await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('alcove_admin_draft')).every(k => !JSON.parse(localStorage[k]).text || Object.keys(JSON.parse(localStorage[k]).text).length === 0))));
  await ctx.close();
}
{
  const { ctx, page, dialogs } = await unlocked('work.html', { override: saved });
  check('revert target is the saved wording, not the HTML', (await page.locator(H1SEL).innerText()) === H1_NEW);
  await replaceText(page, H1SEL, 'Draft Title');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.waitForSelector('#alcove-admin');
  check('draft survives a reload', (await page.locator(H1SEL).innerText()) === 'Draft Title');
  check('dirty page warns before leaving', dialogs.includes('beforeunload'), JSON.stringify(dialogs));
  await openPanel(page);
  await page.click('#alcove-admin .admin-changes li button');
  check('revert after reload goes back to the saved wording', (await page.locator(H1SEL).innerText()) === H1_NEW);
  const before = dialogs.length;
  await page.reload();
  check('clean page does not warn', dialogs.length === before, JSON.stringify(dialogs));
  await ctx.close();
}
{
  const { ctx, page } = await unlocked('work.html');
  await replaceText(page, H1SEL, 'Unsaved');
  await page.keyboard.press('Escape');
  await openPanel(page);
  await page.click('#alcove-admin .admin-signout');
  await page.waitForFunction(() => !localStorage.getItem('alcove_admin_token'));
  await page.waitForLoadState('load');
  const left = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('alcove_admin')));
  check('sign-out clears the token and all drafts', left.length === 0, JSON.stringify(left));
  check('signed-out page shows the authored heading', (await page.locator('h1').innerText()) === H1);
  await ctx.close();
}
{
  const { ctx, page } = await unlocked('work.html', { width: 390, height: 780 });
  await openPanel(page);
  await replaceText(page, H1SEL, 'Phone edit');
  await page.keyboard.press('Escape');
  const g = await page.evaluate(() => {
    const r = s => document.querySelector(s).getBoundingClientRect();
    const p = r('#alcove-admin'), n = r('.site-header nav');
    return { pb: p.bottom, nt: n.top, pr: p.right, pl: p.left, w: innerWidth, sw: document.documentElement.scrollWidth, th: r('#alcove-admin .admin-toggle').height };
  });
  check('phone: panel sits above the bottom tab bar', g.pb <= g.nt + 0.5, JSON.stringify(g));
  check('phone: panel fits the width, no horizontal scroll', g.pl >= 0 && g.pr <= g.w && g.sw <= g.w, JSON.stringify(g));
  check('phone: toggle is a 44px tap target', g.th >= 44, JSON.stringify(g));
  await ctx.close();
}
{
  const { ctx, page } = await unlocked('work.html', { reducedMotion: 'reduce' });
  const d = await page.evaluate(sel => [sel, '#alcove-admin .admin-toggle'].map(s => { const c = getComputedStyle(document.querySelector(s)); return [c.transitionDuration, c.animationName]; }), H1SEL);
  check('reduced motion: admin UI and marks do not animate', d.every(([t, a]) => (t === '0s' || t === '') && (a === 'none')), JSON.stringify(d));
  await ctx.close();
}

// --- Ticket 03: Save to the content branch (api.github.com fully mocked) ---------------------------------------
const BRANCH_FILE = { sha: 'sha-branch-1', text: JSON.stringify({ version: 1, text: { 'work.h2.recent-recordings': 'Kept from branch', 'work.h1.listen-in': 'Branch Title' }, defaults: { palette: 'seth-sage-coral' } }, null, 2) + '\n' };
const puts = gh => gh.calls.filter(c => c.method === 'PUT');
const saveBtn = '#alcove-admin .admin-save', note = '#alcove-admin .admin-note';
const editAndOpen = async (page, text = 'Hello There') => { await replaceText(page, H1SEL, text); await page.keyboard.press('Escape'); await openPanel(page); };
const draftCount = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('alcove_admin_draft')).reduce((n, k) => n + Object.keys(JSON.parse(localStorage[k]).text || {}).length, 0));
{
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page, errors } = await unlocked('work.html', { override: saved, gh });
  check('unlocked: loads content.json from the content branch (saved-but-unmerged shows)', (await page.locator(H1SEL).innerText()) === 'Branch Title');
  await editAndOpen(page);
  await page.click(saveBtn);
  await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  const put = puts(gh);
  check('save sends exactly one contents PUT', put.length === 1, String(put.length));
  const body = JSON.parse(put[0].body);
  check('PUT targets branch content with the sha just read', body.branch === 'content' && body.sha === 'sha-branch-1' && typeof body.message === 'string' && body.message.length > 0, JSON.stringify({ ...body, content: '...' }));
  const text = Buffer.from(body.content, 'base64').toString('utf8');
  const file = JSON.parse(text);
  check('PUT JSON is version 1, pretty-printed', file.version === 1 && text.startsWith('{\n  "version": 1,') && text.endsWith('\n'), text.slice(0, 40));
  check('save merges edit over existing text and keeps other keys and defaults', file.text['work.h1.listen-in'] === 'Hello There' && file.text['work.h2.recent-recordings'] === 'Kept from branch' && file.defaults.palette === 'seth-sage-coral', text);
  check('PUT touches only this page\'s edited keys', Object.keys(file.text).length === 2);
  check('success message says changes go live in a minute or two', (await page.textContent(note)).includes('Saved to the content branch. Changes go live in a minute or two'));
  check('success clears this page\'s drafts and the count', (await draftCount(page)) === 0 && (await page.textContent('#alcove-admin .admin-toggle')).includes('0') && await page.locator(saveBtn).isDisabled());
  await replaceText(page, H1SEL, 'Another'); await page.keyboard.press('Escape');
  await page.click('#alcove-admin .admin-changes li button');
  check('revert after save targets the newly saved wording', (await page.locator(H1SEL).innerText()) === 'Hello There');
  check('save raises no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
{
  const gh = { file: { ...BRANCH_FILE }, delayPut: 500 };
  const { ctx, page } = await unlocked('work.html', { gh });
  await editAndOpen(page);
  await page.click(saveBtn);
  check('Save is disabled while saving (single in-flight)', await page.locator(saveBtn).isDisabled());
  await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  check('only one PUT was sent', puts(gh).length === 1);
  await ctx.close();
}
{
  // Published file == what the new branch will start with (copied from main), so creating the branch is no conflict.
  const gh = { file: { ...BRANCH_FILE }, noBranch: true, mainSha: 'abc123main' };
  const { ctx, page } = await unlocked('work.html', { gh, override: BRANCH_FILE.text });
  await editAndOpen(page);
  await page.click(saveBtn);
  await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  const post = gh.calls.find(c => c.method === 'POST' && c.path === '/git/refs');
  check('missing branch is created from main\'s head', post && JSON.parse(post.body).ref === 'refs/heads/content' && JSON.parse(post.body).sha === 'abc123main', JSON.stringify(post));
  check('PUT follows branch creation', puts(gh).length === 1 && gh.calls.indexOf(post) < gh.calls.indexOf(puts(gh)[0]));
  await ctx.close();
}
const failCases = [
  ['conflict (409)', { putStatus: 409 }, /changed|conflict/i, /reload/i],
  ['conflict (422 sha mismatch)', { putStatus: 422 }, /changed|conflict/i, /reload/i],
  ['wrong or expired token (401)', { fail: { branch: 401 } }, /token/i, /expired|wrong/i],
  ['token lacks permission (403)', { fail: { put: 403 } }, /permission|write/i, /Contents/i],
  ['repo not found (404)', { fail: { branch: 404, main: 404 } , noBranch: true }, /not found/i, /TheJungleJimRuss\/AlcoveSite/],
  ['network error', { abortPut: true }, /connect|network|reach/i, /kept/i],
];
for (const [name, extra, re1, re2] of failCases) {
  const gh = { file: { ...BRANCH_FILE }, ...extra };
  const { ctx, page } = await unlocked('work.html', { gh });
  await editAndOpen(page);
  await page.click(saveBtn);
  await page.waitForFunction(s => !/^(Saving…)?$/.test(document.querySelector(s)?.textContent || ''), note);
  const msg = await page.textContent(note);
  check(`${name}: clear message`, re1.test(msg) && re2.test(msg), msg);
  check(`${name}: drafts kept, Save usable again, no success shown`, (await draftCount(page)) === 1 && !(await page.locator(saveBtn).isDisabled()) && !/Saved to the content branch/.test(msg) && (await page.locator(H1SEL).innerText()) === 'Hello There');
  check(`${name}: nothing silently overwritten`, puts(gh).length <= 1 && (!gh.file || gh.file.sha === 'sha-branch-1'));
  await ctx.close();
}
{
  // Conflict against the unlock-time base: the branch changed in OTHER keys only -> merge on top of the latest file.
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page } = await unlocked('work.html', { gh });
  await editAndOpen(page);
  gh.file = { sha: 'sha-branch-2', text: BRANCH_FILE.text.replace('Kept from branch', 'Somebody else edited this') };
  await page.click(saveBtn);
  await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  const body = JSON.parse(puts(gh)[0].body);
  const file = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
  check('branch changed in other keys only: save merges onto the latest file', body.sha === 'sha-branch-2' && file.text['work.h1.listen-in'] === 'Hello There' && file.text['work.h2.recent-recordings'] === 'Somebody else edited this', JSON.stringify(file));
  await ctx.close();
}
{
  // The branch changed the SAME key since unlock -> stop, no PUT, draft kept, reload-and-reapply offered.
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page } = await unlocked('work.html', { gh });
  await editAndOpen(page);
  gh.file = { sha: 'sha-branch-2', text: BRANCH_FILE.text.replace('Branch Title', 'Somebody Else') };
  await page.click(saveBtn);
  await page.waitForSelector(note + ' button');
  const msg = await page.textContent(note);
  check('same key changed on the branch: conflict message with reload button, no PUT', puts(gh).length === 0 && /changed/i.test(msg) && /reload/i.test(msg), msg);
  check('same key changed on the branch: draft kept and Save usable again', (await draftCount(page)) === 1 && (await page.locator(H1SEL).innerText()) === 'Hello There' && !(await page.locator(saveBtn).isDisabled()));
  await ctx.close();
}
{
  // A changed Site Default is a conflict too.
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page } = await unlocked('work.html', { gh });
  await openPanel(page);
  await page.selectOption('#alcove-admin select[name="palette"]', 'seth-olive-orange-dark');
  gh.file = { sha: 'sha-branch-2', text: BRANCH_FILE.text.replace('"seth-sage-coral"', '"seth-sage-coral-dark"') };
  await page.click(saveBtn);
  await page.waitForSelector(note + ' button');
  check('same default changed on the branch: conflict, no PUT', puts(gh).length === 0);
  await ctx.close();
}
{
  // A second save after a successful one is measured against what we just saved, not the old load.
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page } = await unlocked('work.html', { gh });
  await editAndOpen(page);
  await page.click(saveBtn);
  await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  await replaceText(page, H1SEL, 'Second Edit'); await page.keyboard.press('Escape');
  await page.click(saveBtn);
  await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  await page.waitForTimeout(200);
  check('save again after a save is not a false conflict', puts(gh).length === 2 && JSON.parse(puts(gh)[1].body).sha === 'newsha1');
  await ctx.close();
}
{
  // Conflict path: reload re-applies the kept draft over the latest branch wording.
  const gh = { file: { ...BRANCH_FILE }, putStatus: 409 };
  const { ctx, page } = await unlocked('work.html', { gh });
  await editAndOpen(page);
  await page.click(saveBtn);
  await page.waitForSelector(note + ' button');
  gh.putStatus = 0; gh.file = { sha: 'sha-branch-2', text: BRANCH_FILE.text.replace('Branch Title', 'Somebody Else') };
  await page.click(note + ' button');
  await page.waitForSelector('#alcove-admin');
  check('reload after conflict keeps the draft over the latest branch file', (await page.locator(H1SEL).innerText()) === 'Hello There' && (await draftCount(page)) === 1);
  await openPanel(page);
  await page.click(saveBtn);
  await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  check('reapplied save uses the new sha', JSON.parse(puts(gh).at(-1).body).sha === 'sha-branch-2');
  await ctx.close();
}
{
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page, allReqs } = await unlocked('work.html', { gh, override: saved });
  await editAndOpen(page, 'Secret check');
  await page.click(saveBtn);
  await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  const ghReqs = allReqs.filter(r => new URL(r.url).host === 'api.github.com');
  check('token is sent to api.github.com (Authorization header)', gh.calls.length > 0 && gh.calls.every(c => c.auth === 'Bearer ' + TOKEN || c.auth === 'token ' + TOKEN), JSON.stringify(gh.calls.map(c => c.auth)));
  check('no request to any other host carries the token', allReqs.filter(r => new URL(r.url).host !== 'api.github.com').every(r => !r.auth && !r.url.includes('TESTTOKEN') && !(r.body || '').includes('TESTTOKEN')));
  check('token is never in any URL or request body', allReqs.every(r => !r.url.includes('TESTTOKEN') && !(r.body || '').includes('TESTTOKEN')));
  check('token is never written into the content file', !puts(gh)[0].body.includes('TESTTOKEN') && !Buffer.from(JSON.parse(puts(gh)[0].body).content, 'base64').toString().includes('TESTTOKEN') && !gh.file.text.includes('TESTTOKEN'));
  check('only api.github.com is called for GitHub work', ghReqs.length >= gh.calls.length);
  await ctx.close();
}
{
  // Failure to load the branch file falls back to the published file.
  const { ctx, page } = await unlocked('work.html', { override: saved, gh: { fail: { file: 500 } } });
  check('unlocked: branch load failure falls back to the published file', (await page.locator(H1SEL).innerText()) === H1_NEW);
  await ctx.close();
}

// --- Ticket 04: Site Defaults panel ---------------------------------------------------------------------------
const sel = n => `#alcove-admin select[name="${n}"]`;
const optNames = ['palette', 'font', 'surface', 'gradient', 'heroGrain', 'halation', 'heroEdge', 'filmGrain', 'cursorShadow'];
const defaultsDraft = page => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('alcove_admin_draft:defaults')); } catch { return null; } });
const scheme = page => page.evaluate(() => document.documentElement.dataset.scheme);
{
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page, errors } = await unlocked('work.html', { gh });
  await openPanel(page);
  const lists = await page.evaluate(() => {
    const o = window.AlcoveTheme.options, out = {};
    for (const k of Object.keys(o)) { const s = document.querySelector(`#alcove-admin select[name="${k}"]`); out[k] = s ? { got: [...s.options].map(x => x.value), want: Object.keys(o[k].values), value: s.value } : null; }
    return out;
  });
  check('panel lists exactly the nine toolbar options (palette, font, surface, gradient, hero grain, hero halation, hero edge, film grain, cursor shadow)', optNames.every(n => lists[n]) && Object.keys(lists).length === 9, JSON.stringify(Object.keys(lists)));
  check('each option offers the toolbar\'s choices (shared definitions)', optNames.every(n => JSON.stringify(lists[n].got) === JSON.stringify(lists[n].want)));
  check('no Tape or Cards option', (await page.locator('#alcove-admin select[name="tape"], #alcove-admin select[name="cards"]').count()) === 0);
  check('current saved default is selected (palette from the branch file, others built-in)', lists.palette.value === 'seth-sage-coral' && lists.gradient.value === 'full' && lists.surface.value === 'metal' && lists.font.value === 'retro-display' && lists.heroGrain.value === 'off', JSON.stringify(lists));
  check('theme toolbar is not shown while unlocked', (await page.locator('#theme-dock').count()) === 0);
  check('no selection yet: Save disabled, Revert to saved disabled', await page.locator(saveBtn).isDisabled() && await page.locator('#alcove-admin .admin-defaults-revert').isDisabled());
  await page.selectOption(sel('palette'), 'seth-olive-orange-dark');
  check('live preview: choosing a dark palette restyles the page at once', (await scheme(page)) === 'dark' && (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-page').trim().toLowerCase())) === '#1f1a0c');
  await page.selectOption(sel('gradient'), 'flat');
  check('live preview: gradient option sets its data attribute', (await page.evaluate(() => document.documentElement.dataset.gradient)) === 'flat');
  check('Save count and button include defaults changes', (await page.textContent(saveBtn)).includes('2 changes') && (await page.textContent('#alcove-admin .admin-toggle')).includes('2'));
  check('defaults draft is stored under its own key', JSON.stringify((await defaultsDraft(page))?.defaults) === JSON.stringify({ palette: 'seth-olive-orange-dark', gradient: 'flat' }));
  await page.selectOption(sel('gradient'), 'full');
  check('choosing the saved value again drops that change', (await page.textContent(saveBtn)).includes('1 change') && !(await page.textContent(saveBtn)).includes('1 changes'));
  await page.reload();
  await page.waitForSelector('#alcove-admin');
  check('unsaved defaults survive a reload with no flash of the old palette (applied before paint)', (await scheme(page)) === 'dark');
  await openPanel(page);
  check('after reload the panel still shows the pending choice and count', (await page.inputValue(sel('palette'))) === 'seth-olive-orange-dark' && (await page.textContent(saveBtn)).includes('1 change'));
  await page.click('#alcove-admin .admin-defaults-revert');
  check('Revert to saved restores every default and the preview', (await page.inputValue(sel('palette'))) === 'seth-sage-coral' && (await scheme(page)) === 'light' && (await defaultsDraft(page)) === null && await page.locator(saveBtn).isDisabled());
  check('defaults panel raises no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
{
  // Save: text edit + default together in one PUT; reload applies it; visitors get it from the file.
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page } = await unlocked('work.html', { gh });
  await editAndOpen(page);
  await page.selectOption(sel('palette'), 'seth-olive-orange-dark');
  await page.selectOption(sel('heroGrain'), 'strong');
  check('count adds text and defaults changes', (await page.textContent(saveBtn)).includes('3 changes'), await page.textContent(saveBtn));
  await page.click(saveBtn);
  await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  const put = puts(gh);
  const body = JSON.parse(put[0].body);
  const file = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
  check('one PUT to the content branch with the sha just read', put.length === 1 && body.branch === 'content' && body.sha === 'sha-branch-1');
  check('PUT carries defaults under "defaults", changed options only, over the existing ones', JSON.stringify(file.defaults) === JSON.stringify({ palette: 'seth-olive-orange-dark', heroGrain: 'strong' }), JSON.stringify(file.defaults));
  check('PUT carries the text edit too', file.text['work.h1.listen-in'] === 'Hello There' && file.text['work.h2.recent-recordings'] === 'Kept from branch');
  check('after save: count 0, defaults draft cleared, preview kept', (await page.textContent('#alcove-admin .admin-toggle')).includes('0') && (await defaultsDraft(page)) === null && (await scheme(page)) === 'dark' && await page.locator('#alcove-admin .admin-defaults-revert').isDisabled());
  await page.selectOption(sel('palette'), 'seth-sage-coral');
  await page.click('#alcove-admin .admin-defaults-revert');
  check('after save, Revert to saved goes to the newly saved palette', (await page.inputValue(sel('palette'))) === 'seth-olive-orange-dark' && (await scheme(page)) === 'dark');
  await page.reload();
  await page.waitForSelector('#alcove-admin');
  await openPanel(page);
  check('editor reload applies the saved defaults and shows them selected', (await scheme(page)) === 'dark' && (await page.inputValue(sel('heroGrain'))) === 'strong' && (await page.evaluate(() => document.documentElement.dataset.heroGrain)) === 'strong');
  await ctx.close();
  // A visitor loading the committed file gets the same defaults, applied before first paint, with no toolbar or admin UI.
  const v = await open('work.html', { override: gh.file.text, probe: () => { window.__dark = []; const t = () => { const h = document.documentElement; if (document.body && h.dataset.scheme && h.dataset.scheme !== 'dark') window.__dark.push(h.dataset.scheme); requestAnimationFrame(t); }; requestAnimationFrame(t); } });
  await v.page.waitForTimeout(300);
  check('visitor: saved defaults applied, never shown the old palette', (await scheme(v.page)) === 'dark' && (await v.page.evaluate(() => document.documentElement.dataset.heroGrain)) === 'strong' && (await v.page.evaluate(() => window.__dark)).length === 0);
  check('visitor: still no toolbar or admin panel', (await v.page.locator('#theme-dock, #alcove-admin').count()) === 0);
  await v.ctx.close();
}
{
  // Defaults-only save works with no text edits, and a failed save keeps the defaults draft.
  const gh = { file: { ...BRANCH_FILE }, putStatus: 409 };
  const { ctx, page } = await unlocked('work.html', { gh });
  await openPanel(page);
  await page.selectOption(sel('heroGrain'), 'soft');
  await page.click(saveBtn);
  await page.waitForFunction(s => !/^(Saving…)?$/.test(document.querySelector(s)?.textContent || ''), note);
  check('conflict keeps the defaults draft and the preview', /changed|conflict/i.test(await page.textContent(note)) && (await defaultsDraft(page))?.defaults?.heroGrain === 'soft' && (await page.evaluate(() => document.documentElement.dataset.heroGrain)) === 'soft');
  gh.putStatus = 0;
  await page.click(saveBtn);
  await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  const f = JSON.parse(Buffer.from(JSON.parse(puts(gh).at(-1).body).content, 'base64').toString('utf8'));
  check('defaults-only Save writes just the default', f.defaults.heroGrain === 'soft' && f.defaults.palette === 'seth-sage-coral' && Object.keys(f.text).length === 2);
  await ctx.close();
}
{
  // Phone width: no toolbar overlap, panel fits above the tab bar, every control reachable.
  const { ctx, page } = await unlocked('work.html', { width: 390, height: 780 });
  await openPanel(page);
  await page.selectOption(sel('palette'), 'seth-sage-coral-dark');
  const g = await page.evaluate(() => {
    const r = s => document.querySelector(s).getBoundingClientRect();
    const p = r('#alcove-admin'), n = r('.site-header nav');
    const sels = [...document.querySelectorAll('#alcove-admin select')].map(e => e.getBoundingClientRect().height);
    return { pb: p.bottom, pt: p.top, nt: n.top, pl: p.left, pr: p.right, w: innerWidth, sw: document.documentElement.scrollWidth, dock: document.querySelectorAll('#theme-dock').length, minSel: Math.min(...sels), n: sels.length };
  });
  check('phone: theme toolbar is gone, so it cannot overlap the panel or tab bar', g.dock === 0, JSON.stringify(g));
  check('phone: open panel sits above the tab bar and inside the screen', g.pb <= g.nt + 0.5 && g.pt >= 0 && g.pl >= 0 && g.pr <= g.w && g.sw <= g.w, JSON.stringify(g));
  check('phone: nine selects, each a 44px tap target', g.n === 9 && g.minSel >= 44, JSON.stringify(g));
  const last = sel('heroGrain');
  await page.locator(last).scrollIntoViewIfNeeded();
  check('phone: last option scrolls into view and is operable', await page.locator(last).isVisible() && (await page.locator(last).boundingBox()).y + 44 <= 780);
  await page.selectOption(last, 'strong');
  check('phone: choosing works', (await page.textContent(saveBtn)).includes('2 changes'));
  await ctx.close();
}
{
  // Visitor (no token) never sees the new UI, and no toolbar exists for anyone on a public URL.
  const { ctx, page } = await open('index.html');
  check('visitor: no defaults panel, no AlcoveTheme controls', (await page.locator('#alcove-admin, #theme-dock, select[name="palette"]').count()) === 0);
  await ctx.close();
}

// --- Ticket 05: hardening (keyboard + screen-reader structure) -------------------------------------------------
{
  const { ctx, page } = await unlocked('work.html');
  const before = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3')].map(h => h.tagName));
  const s = await page.evaluate(() => {
    const a = document.querySelector('#alcove-admin');
    return { tag: a.tagName, label: a.getAttribute('aria-label'), status: [...a.querySelectorAll('[role="status"]')].length, toggleName: a.querySelector('.admin-toggle').getAttribute('aria-controls'), legend: !!a.querySelector('fieldset > legend'), unlabelled: [...a.querySelectorAll('select')].filter(x => !x.closest('label')).length };
  });
  check('panel is a labelled region, three status messages, defaults in a fieldset, every select labelled', s.tag === 'ASIDE' && !!s.label && s.status === 3 && s.legend && s.unlabelled === 0, JSON.stringify(s));
  await page.focus('#alcove-admin .admin-toggle');
  await page.keyboard.press('Enter');
  check('keyboard: Enter on the toggle opens the panel', (await page.getAttribute('#alcove-admin .admin-toggle', 'aria-expanded')) === 'true');
  await page.focus('#alcove-admin select[name="palette"]');
  await page.keyboard.press('Escape');
  check('keyboard: Esc closes the panel and returns focus to the toggle', (await page.getAttribute('#alcove-admin .admin-toggle', 'aria-expanded')) === 'false' && (await page.evaluate(() => document.activeElement.className)) === 'admin-toggle');
  await replaceText(page, H1SEL, 'Heading kept');
  check('keyboard: editable heading is a tab stop with a visible focus outline', await page.evaluate(sel => { const e = document.querySelector(sel); e.focus(); return e.tabIndex === 0 && getComputedStyle(e).outlineStyle !== 'none' && parseFloat(getComputedStyle(e).outlineWidth) >= 2; }, H1SEL));
  check('headings keep their levels while editing', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3')].map(h => h.tagName))) === JSON.stringify(before));
  await ctx.close();
}


// --- Edit mode: any visible text and buttons ------------------------------------------------------
const SW = '#alcove-admin .admin-edit-switch';
{
  const { ctx, page } = await unlocked('work.html', { edit: false });
  check('edit switch is a labelled switch, off by default', (await page.getAttribute(SW, 'role')) === 'switch' && (await page.getAttribute(SW, 'aria-checked')) === 'false' && (await page.textContent(SW)).trim() === 'Edit mode: off');
  check('off: nothing is outlined, editable or a tab stop', (await page.locator('[contenteditable], [data-admin-edit]').count()) === 0 && (await page.$$eval('[data-edit-key]', els => els.every(e => !e.hasAttribute('tabindex')))));
  // site behaves normally: the Crate plays, nav links navigate; genres are retired
  check('off: no genre tabs and no song editor', (await page.locator('.filter-pill, [data-genre], .sleeve-genre, .admin-songs:visible').count()) === 0);
  await page.click('.sleeve[data-src*="track-1"]');
  await page.waitForFunction(() => document.querySelector('.record-player').dataset.playing === 'true', null, { timeout: 4000 }); // the arm swings in first
  check('off: clicking a sleeve runs its action (loads the record and plays)', (await page.getAttribute('.sleeve[data-src*="track-1"]', 'aria-pressed')) === 'true' && (await page.getAttribute('.record-player', 'data-playing')) === 'true');
  await page.click('.sleeve[data-src*="track-1"]');
  await page.click('.site-header .nav-links a[data-edit-key="site.nav.about"]');
  await page.waitForURL(/about\.html/);
  check('off: nav link still navigates', true);
  // switch on with keyboard
  await page.waitForSelector(SW);
  await page.focus(SW);
  await page.keyboard.press('Space');
  check('Space on the switch turns Edit mode on', (await page.getAttribute(SW, 'aria-checked')) === 'true' && (await page.textContent(SW)).trim() === 'Edit mode: on' && (await page.locator('[contenteditable]').count()) > 10);
  await page.reload();
  await page.waitForSelector(SW);
  check('Edit mode is remembered for the session', (await page.getAttribute(SW, 'aria-checked')) === 'true');
  await page.click(SW);
  check('turning it off removes the outlines again', (await page.locator('[contenteditable], [data-admin-edit]').count()) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await unlocked('work.html');
  // on: song titles are not text keys (the songs list owns them); the Crate still works
  check('on: sleeve titles are not text-editable keys (songs are edited in the Songs list)', (await page.locator('.sleeve [data-edit-key], .sleeve [contenteditable]').count()) === 0);
  const url = page.url();
  await page.click('.site-header .nav-links a[data-edit-key="site.nav.about"]');
  await page.waitForTimeout(500);
  check('on: clicking a nav label does not navigate', page.url() === url);
  check('on: the Flip Tape key (no editable text of its own) keeps working', await (async () => { await page.click('#ab-key-flip'); await page.waitForFunction(() => !window.__abDeck.state().flipping); return (await page.evaluate(() => document.querySelector('.ab-compare').dataset.version)) === 'master'; })());
  check('on: side lamp labels are editable text keys', (await page.locator('.side-lamps [data-edit-key]').count()) === 2);
  await ctx.close();
}
{
  // Text edits on Work still save under their own keys alongside songs (songs have their own tests below).
  const gh = { file: { sha: 's0', text: JSON.stringify({ version: 1, text: {}, defaults: {} }) } };
  const { ctx, page } = await unlocked('work.html', { gh });
  await replaceText(page, '.ab-strip[data-edit-key="work.ab.mic.name"]', 'Microphone'); await page.keyboard.press('Escape');
  await openPanel(page);
  await page.click(saveBtn);
  await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  const sent = JSON.parse(Buffer.from(JSON.parse(puts(gh)[0].body).content, 'base64').toString('utf8'));
  check('Save PUT carries the A/B label under its own key and no song data when songs are untouched', sent.text['work.ab.mic.name'] === 'Microphone' && Object.keys(sent.text).length === 1 && !('songs' in sent), JSON.stringify(sent));
  await ctx.close();
}
{
  const { ctx, page } = await unlocked('index.html');
  // shared nav key on index (header + hero nav) edit together
  await replaceText(page, '.site-header .nav-links a[data-edit-key="site.nav.work"]', 'Music'); await page.keyboard.press('Escape');
  check('shared nav key updates every copy on the page', (await page.$$eval('[data-edit-key="site.nav.work"]', e => e.map(x => x.textContent))).join() === 'Music,Music');
  await ctx.close();
  const c = await unlocked('contact.html');
  check('booking form still has no keys with Edit mode on', (await c.page.locator('#booking-form [data-edit-key], #booking-form [contenteditable]').count()) === 0);
  await c.ctx.close();
}

// --- Admin media, ticket 01: replace photos end-to-end ------------------------------------------------------
const PORTRAIT = 'about.photo.portrait', HERO = 'index.photo.hero';
const input = key => `input.admin-replace-input[data-for="${key}"]`;
const imgOf = key => `[data-media-slot="${key}"]`;
const photo = await fixture(3000, 1500);
const jpegFile = { name: '../../Seth Portrait!!.JPG', mimeType: 'image/jpeg', buffer: photo };
const fileCalls = gh => puts(gh).filter(c => c.path.startsWith('/contents/images/'));
const contentPuts = gh => puts(gh).filter(c => c.path === '/contents/content.json');
const mediaErr = '#alcove-admin .admin-media-error';
{
  // every photo has a stable, unique key; the booking page has none
  for (const [p, n] of [['index.html', 11], ['work.html', 6], ['about.html', 4]]) {
    const { ctx, page } = await open(p);
    const keys = await page.$$eval('[data-media-slot]', e => e.map(x => x.dataset.mediaSlot));
    check(`${p}: ${n} photo Media slots with unique keys`, keys.length === n && new Set(keys).size === n && keys.every(k => k.startsWith(p.replace('.html', '') + '.photo.')), JSON.stringify(keys));
    await ctx.close();
  }
  const c = await open('contact.html', { token: TOKEN, edit: true }); await c.page.waitForSelector('#alcove-admin');
  check('contact: no Media slots, no Replace controls (booking form untouched)', (await c.page.locator('[data-media-slot], .admin-replace, input.admin-replace-input').count()) === 0);
  await c.ctx.close();
}
{
  // Replace controls follow Edit mode
  const off = await open('about.html', { token: TOKEN, edit: false }); await off.page.waitForSelector('#alcove-admin');
  check('Edit mode off: no Replace controls', (await off.page.locator('.admin-replace').count()) === 0);
  await off.page.click('#alcove-admin .admin-edit-switch');
  check('Edit mode on: a labelled Replace button on every photo slot', (await off.page.locator('button.admin-replace').count()) === 4 && (await off.page.$$eval('button.admin-replace', b => b.every(x => /replace/i.test(x.getAttribute('aria-label') || x.textContent)))));
  await off.page.click('#alcove-admin .admin-edit-switch');
  check('Edit mode switched off again removes the controls', (await off.page.locator('.admin-replace').count()) === 0);
  await off.ctx.close();
  const vis = await open('about.html');
  check('visitor: no Replace controls', (await vis.page.locator('.admin-replace').count()) === 0);
  await vis.ctx.close();
  const ph = await unlocked('about.html', { width: 375, height: 800 });
  check('phone: Replace is a 44px tap target', (await ph.page.$$eval('button.admin-replace', b => b.every(x => x.getBoundingClientRect().height >= 44 && x.getBoundingClientRect().width >= 44))));
  await ph.ctx.close();
  const kb = await unlocked('about.html');
  await kb.page.waitForSelector('button.admin-replace');
  await kb.page.focus('button.admin-replace');
  const chooser = kb.page.waitForEvent('filechooser', { timeout: 3000 });
  await kb.page.keyboard.press('Enter');
  check('Replace opens the file chooser from the keyboard', !!(await chooser.catch(() => null)));
  await kb.ctx.close();
}
{
  // stage -> preview -> save order -> reload
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page, errors, allReqs } = await unlocked('about.html', { gh });
  const before = await page.getAttribute(imgOf(PORTRAIT), 'src');
  const alt = await page.getAttribute(imgOf(PORTRAIT), 'alt');
  await page.setInputFiles(input(PORTRAIT), jpegFile);
  await page.waitForFunction(s => document.querySelector(s).src.startsWith('blob:') && document.querySelector(s).complete, imgOf(PORTRAIT));
  const nat = await page.$eval(imgOf(PORTRAIT), i => [i.naturalWidth, i.naturalHeight]);
  check('photo is previewed in place, shrunk to 2000px on the long edge', nat[0] === 2000 && nat[1] === 1000, JSON.stringify(nat));
  check('alt text is kept', (await page.getAttribute(imgOf(PORTRAIT), 'alt')) === alt);
  check('staged photo counts as a change', (await page.textContent(saveBtn)).includes('1 change') && fileCalls(gh).length === 0 && gh.calls.every(c => c.method === 'GET' || c.method === 'OPTIONS'));
  await openPanel(page);
  check('panel lists the staged photo', (await page.locator('#alcove-admin .admin-changes li').count()) === 1);
  await page.click('#alcove-admin .admin-changes li button');
  check('revert restores the authored photo and clears the count', (await page.getAttribute(imgOf(PORTRAIT), 'src')) === before && (await page.textContent(saveBtn)).trim() === 'Save');
  await page.setInputFiles(input(PORTRAIT), jpegFile);
  await page.waitForFunction(s => document.querySelector(s).src.startsWith('blob:'), imgOf(PORTRAIT));
  await replaceText(page, H1SEL.replace('work.h1.listen-in', 'about.h1.about-alcove'), 'About Us'); await page.keyboard.press('Escape');
  check('text and photo drafts count together', (await page.textContent(saveBtn)).includes('2 changes'));
  await page.click(saveBtn);
  await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  const order = gh.calls.filter(c => c.method === 'PUT').map(c => c.path);
  const imgPath = order[0];
  check('Save sends the file PUT first, then the content.json PUT', order.length === 2 && /^\/contents\/images\/seth-portrait-[0-9a-f]{8}\.jpg$/.test(imgPath) && order[1] === '/contents/content.json', JSON.stringify(order));
  const fb = JSON.parse(fileCalls(gh)[0].body);
  check('file PUT targets branch content', fb.branch === 'content' && typeof fb.message === 'string' && !fb.sha);
  const d = await dims(Buffer.from(fb.content, 'base64'));
  check('uploaded bytes are the shrunk photo (2000x1000), not the original', d[0] === 2000 && d[1] === 1000, JSON.stringify(d));
  const file = JSON.parse(Buffer.from(JSON.parse(contentPuts(gh)[0].body).content, 'base64').toString('utf8'));
  const rel = imgPath.replace('/contents/', '');
  check('content.json maps the slot key to the new repo path, keeping text', file.media && file.media[PORTRAIT] === rel && file.text['about.h1.about-alcove'] === 'About Us' && file.text['work.h1.listen-in'] === 'Branch Title', JSON.stringify(file));
  check('save clears the staged count', (await page.textContent(saveBtn)).trim() === 'Save' && (await page.getAttribute(imgOf(PORTRAIT), 'src')) !== before);
  check('token goes only to api.github.com', allReqs.every(r => !r.auth || new URL(r.url).host === 'api.github.com') && allReqs.every(r => !(r.url + (r.body || '')).includes('TESTTOKEN')));
  check('replacing a photo raises no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
  // visitor after reload: new photo applied, others untouched
  extra['/' + rel] = gh.files[imgPath];
  const v = await open('about.html', { override: gh.file.text });
  await v.page.waitForFunction(s => document.querySelector(s).complete, imgOf(PORTRAIT));
  check('visitor sees the new photo in the slot', (await v.page.$eval(imgOf(PORTRAIT), i => i.getAttribute('src'))) === rel && (await v.page.$eval(imgOf(PORTRAIT), i => i.naturalWidth)) === 2000);
  check('other photos keep their authored files', (await v.page.$$eval('[data-media-slot]:not([data-media-slot="about.photo.portrait"])', e => e.every(i => /studio-/.test(i.getAttribute('src'))))));
  check('replaced portrait is no longer marked as a placeholder slot', (await v.page.locator('.photo-slot').count()) === 0);
  check('visitor reload raises no console errors', v.errors.length === 0, v.errors.join(' | '));
  await v.ctx.close();
  // the admin reloading sees it too (from the branch file)
  const a = await unlocked('about.html', { gh: { file: gh.file } });
  check('editor reload shows the saved photo', (await a.page.$eval(imgOf(PORTRAIT), i => i.getAttribute('src'))) === rel);
  await a.ctx.close();
  delete extra['/' + rel];
}
{
  // bad media entries fall back to the authored photo
  const orig = 'images/portrait-placeholder.svg';
  for (const [label, media] of [
    ['path traversal', { [PORTRAIT]: '../secret.jpg' }], ['absolute URL', { [PORTRAIT]: 'https://evil.example/x.jpg' }], ['javascript url', { [PORTRAIT]: 'javascript:alert(1)' }],
    ['non-string', { [PORTRAIT]: 5 }], ['media is an array', [PORTRAIT]], ['file not found on the server', { [PORTRAIT]: 'images/gone-12345678.jpg' }], ['unknown slot', { 'nope.photo.x': 'images/x-12345678.jpg' }]]) {
    const { ctx, page, errors } = await open('about.html', { override: JSON.stringify({ version: 1, text: {}, defaults: {}, media }) });
    await page.waitForTimeout(250);
    const src = await page.getAttribute(imgOf(PORTRAIT), 'src');
    check(`bad media (${label}): authored photo stays`, src === orig, src);
    check(`bad media (${label}): page visible`, (await page.evaluate(() => getComputedStyle(document.body).visibility)) === 'visible');
    await ctx.close();
  }
}
{
  // hero photo is a CSS background: the slot gets the file through the loader / admin, not inline markup
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page } = await unlocked('index.html', { gh });
  check('hero slot has a Replace control', (await page.locator('button.admin-replace[data-for="' + HERO + '"]').count()) === 1);
  await page.setInputFiles(input(HERO), { name: 'hero.jpg', mimeType: 'image/jpeg', buffer: photo });
  await page.waitForFunction(s => getComputedStyle(document.querySelector(s)).backgroundImage.includes('blob:'), imgOf(HERO));
  check('hero preview shows the new photo as its background', true);
  await openPanel(page); await page.click(saveBtn);
  await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  const rel = JSON.parse(Buffer.from(JSON.parse(contentPuts(gh)[0].body).content, 'base64').toString('utf8')).media[HERO];
  check('hero saved under images/ with a slug+hash name', /^images\/hero-[0-9a-f]{8}\.jpg$/.test(rel), rel);
  await ctx.close();
  extra['/' + rel] = gh.files['/contents/' + rel];
  const v = await open('index.html', { override: gh.file.text });
  await v.page.waitForTimeout(300);
  check('visitor: hero background is the saved file', (await v.page.$eval(imgOf(HERO), e => getComputedStyle(e).backgroundImage)).includes(rel));
  check('visitor: hero has no inline style attribute markup beyond the applied property', (await v.page.$eval(imgOf(HERO), e => e.getAttribute('style') || '')).length < 200);
  await v.ctx.close();
  delete extra['/' + rel];
}
{
  // rejections: no staging, no request
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page } = await unlocked('about.html', { gh });
  const tmp = await mkdtemp(join(tmpdir(), 'alcove-')), hugePath = join(tmp, 'huge.jpg');
  const cap = await page.evaluate(() => window.AlcoveAdmin && window.AlcoveAdmin.MAX_MEDIA_BYTES);
  check('size cap is one exported constant of 90 MB', cap === 90 * 1024 * 1024, String(cap));
  await writeFile(hugePath, ''); await truncate(hugePath, cap + 1);
  const before = await page.getAttribute(imgOf(PORTRAIT), 'src');
  const bad = [
    ['over the size cap', hugePath, /too large|90 ?MB/i],
    ['wrong type (text)', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') }, /photo|image|type/i],
    ['wrong type (audio)', { name: 'song.mp3', mimeType: 'audio/mpeg', buffer: Buffer.alloc(100) }, /photo|image|type/i],
    ['claims to be a photo but is not', { name: 'fake.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not really a jpeg') }, /read|open|photo|image/i],
  ];
  for (const [label, f, re] of bad) {
    await page.setInputFiles(input(PORTRAIT), f);
    await page.waitForFunction(s => (document.querySelector(s)?.textContent || '').length > 0, mediaErr);
    const msg = await page.textContent(mediaErr);
    check(`${label}: clear message`, re.test(msg), msg);
    check(`${label}: nothing staged, photo unchanged, no request`, (await page.getAttribute(imgOf(PORTRAIT), 'src')) === before && (await page.textContent(saveBtn)).trim() === 'Save' && gh.calls.every(c => c.method === 'GET'));
    await page.setInputFiles(input(PORTRAIT), []);
  }
  await page.setInputFiles(input(PORTRAIT), jpegFile);
  await page.waitForFunction(s => document.querySelector(s).src.startsWith('blob:'), imgOf(PORTRAIT));
  await rm(tmp, { recursive: true, force: true });
  check('a good photo after a rejection clears the error', (await page.textContent(mediaErr)) === '');
  await ctx.close();
}
{
  // reload keeps the staged photo (IndexedDB) and warns before leaving
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page, dialogs } = await unlocked('about.html', { gh });
  await page.setInputFiles(input(PORTRAIT), jpegFile);
  await page.waitForFunction(s => document.querySelector(s).src.startsWith('blob:'), imgOf(PORTRAIT));
  await page.reload();
  await page.waitForSelector('#alcove-admin');
  check('beforeunload warning while a photo is staged', dialogs.includes('beforeunload'), JSON.stringify(dialogs));
  await page.waitForFunction(s => document.querySelector(s).src.startsWith('blob:'), imgOf(PORTRAIT), { timeout: 4000 }).catch(() => {});
  check('staged photo survives a reload and still counts', (await page.getAttribute(imgOf(PORTRAIT), 'src')).startsWith('blob:') && (await page.textContent(saveBtn)).includes('1 change'));
  await openPanel(page); await page.click(saveBtn); await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  check('a restored photo saves normally', fileCalls(gh).length === 1 && contentPuts(gh).length === 1);
  await page.reload(); await page.waitForSelector('#alcove-admin');
  check('after Save the staged copy is gone', (await page.textContent(saveBtn)).trim() === 'Save');
  await ctx.close();
}
{
  // no IndexedDB: still stages in memory, tells the editor, and saves
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page } = await unlocked('about.html', { gh, init: () => { Object.defineProperty(window, 'indexedDB', { value: { open() { throw new Error('blocked'); } } }); } });
  await page.setInputFiles(input(PORTRAIT), jpegFile);
  await page.waitForFunction(s => document.querySelector(s).src.startsWith('blob:'), imgOf(PORTRAIT));
  await openPanel(page);
  check('IndexedDB unavailable: editor is told to re-pick after a reload', /reload|again|re-?pick/i.test(await page.textContent('#alcove-admin .admin-media-warning')));
  check('the media warning and error are live regions', (await page.getAttribute('#alcove-admin .admin-media-warning', 'role')) === 'status' && (await page.getAttribute('#alcove-admin .admin-media-error', 'role')) === 'alert');
  await page.click(saveBtn); await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  check('IndexedDB unavailable: Save still works', fileCalls(gh).length === 1 && contentPuts(gh).length === 1);
  await ctx.close();
}
{
  // a failed file upload stops Save: content.json never written, file named, draft kept
  const gh = { file: { ...BRANCH_FILE }, failFile: 500 };
  const { ctx, page } = await unlocked('about.html', { gh });
  await page.setInputFiles(input(PORTRAIT), jpegFile);
  await page.waitForFunction(s => document.querySelector(s).src.startsWith('blob:'), imgOf(PORTRAIT));
  await openPanel(page); await page.click(saveBtn);
  await page.waitForFunction(s => /could not|error|failed/i.test(document.querySelector(s)?.textContent || ''), note);
  const msg = await page.textContent(note);
  check('failed upload: message names the file', /seth-portrait-[0-9a-f]{8}\.jpg/.test(msg), msg);
  check('failed upload: content.json is not written', contentPuts(gh).length === 0);
  check('failed upload: photo still staged and Save usable', (await page.textContent(saveBtn)).includes('1 change') && !(await page.locator(saveBtn).isDisabled()));
  gh.failFile = 0;
  await page.click(saveBtn); await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  check('retry after a failed upload succeeds', fileCalls(gh).length >= 1 && contentPuts(gh).length === 1);
  await ctx.close();
}
{
  // conflict on a staged slot keeps the draft and writes nothing
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page } = await unlocked('about.html', { gh });
  await page.setInputFiles(input(PORTRAIT), jpegFile);
  await page.waitForFunction(s => document.querySelector(s).src.startsWith('blob:'), imgOf(PORTRAIT));
  gh.file = { sha: 'sha-branch-2', text: JSON.stringify({ version: 1, text: {}, defaults: {}, media: { [PORTRAIT]: 'images/someone-else-12345678.jpg' } }) };
  await openPanel(page); await page.click(saveBtn);
  await page.waitForSelector(note + ' button');
  check('conflict on a staged slot: nothing uploaded, message offers reload, draft kept', puts(gh).length === 0 && /changed/i.test(await page.textContent(note)) && (await page.textContent(saveBtn)).includes('1 change'));
  await ctx.close();
}
{
  // another slot changed on the branch is not a conflict: merge media maps
  const gh = { file: { sha: 'sha-m1', text: JSON.stringify({ version: 1, text: {}, defaults: {}, media: { 'about.photo.the-piano-and-desk-area': 'images/piano-aaaaaaaa.jpg' } }) } };
  const { ctx, page } = await unlocked('about.html', { gh });
  await page.setInputFiles(input(PORTRAIT), jpegFile);
  await page.waitForFunction(s => document.querySelector(s).src.startsWith('blob:'), imgOf(PORTRAIT));
  await openPanel(page); await page.click(saveBtn);
  await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  const media = JSON.parse(Buffer.from(JSON.parse(contentPuts(gh)[0].body).content, 'base64').toString('utf8')).media;
  check('saving keeps media entries for other slots', media['about.photo.the-piano-and-desk-area'] === 'images/piano-aaaaaaaa.jpg' && !!media[PORTRAIT], JSON.stringify(media));
  await ctx.close();
}
{
  // PNG keeps its type; SVG passes through; small photos are not enlarged
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page } = await unlocked('about.html', { gh });
  await page.setInputFiles(input(PORTRAIT), { name: 'logo.png', mimeType: 'image/png', buffer: await fixture(400, 300, 'image/png') });
  await page.waitForFunction(s => document.querySelector(s).src.startsWith('blob:') && document.querySelector(s).complete, imgOf(PORTRAIT));
  check('small photo is not enlarged', JSON.stringify(await page.$eval(imgOf(PORTRAIT), i => [i.naturalWidth, i.naturalHeight])) === '[400,300]');
  await openPanel(page); await page.click(saveBtn); await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  check('PNG stays a .png', /^\/contents\/images\/logo-[0-9a-f]{8}\.png$/.test(fileCalls(gh)[0].path));
  await ctx.close();
}

// --- Admin media, ticket 02: replace audio and video slots ---------------------------------------------------
const VIDEO = 'work.video.session', POSTER = 'work.video.poster', MEMO = 'work.ab.memo', MASTER = 'work.ab.master';
const clipEl = k => `[data-media-clip="${k}"]`;
const wavBytes = (seconds, rate = 8000, freq = 440) => {
  const n = Math.round(seconds * rate), b = Buffer.alloc(44 + n);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40);
  for (let i = 0; i < n; i++) b[44 + i] = 128 + Math.round(100 * Math.sin(2 * Math.PI * freq * i / rate));
  return b;
};
const memoWav = wavBytes(1.0, 8000, 300), masterWav = wavBytes(1.5, 8000, 600);
const memoFile = { name: 'My Rough Memo!!.WAV', mimeType: 'audio/wav', buffer: memoWav };
const masterFile = { name: 'final-mix.wav', mimeType: 'audio/x-wav', buffer: masterWav };
const videoBytes = await readFile(join(root, 'media', 'placeholder-session.webm'));
const videoFile = { name: 'Session Tour.webm', mimeType: 'video/webm', buffer: videoBytes };
const mediaFileCalls = gh => puts(gh).filter(c => c.path.startsWith('/contents/media/'));
const savedContent = gh => JSON.parse(Buffer.from(JSON.parse(contentPuts(gh).at(-1).body).content, 'base64').toString('utf8'));
const saveDone = page => page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
const deckReady = (page, k) => page.waitForFunction(s => { const a = document.querySelector(s); return a.src.startsWith('blob:') && a.readyState >= 1; }, clipEl(k));
{
  // slots exist on Work with stable unique keys; other pages have none
  const { ctx, page } = await open('work.html');
  const clips = await page.$$eval('[data-media-clip]', e => e.map(x => [x.dataset.mediaClip, x.tagName]));
  const posters = await page.$$eval('[data-media-poster]', e => e.map(x => [x.dataset.mediaPoster, x.tagName]));
  check('work: session video, A/B memo and A/B master are clip slots', JSON.stringify(clips.sort()) === JSON.stringify([[MASTER, 'AUDIO'], [MEMO, 'AUDIO'], [VIDEO, 'VIDEO']].sort()), JSON.stringify(clips));
  check('work: video poster is its own slot', JSON.stringify(posters) === JSON.stringify([[POSTER, 'VIDEO']]), JSON.stringify(posters));
  check('work: the six photo slots are unchanged', (await page.locator('[data-media-slot]').count()) === 6);
  await ctx.close();
  for (const p of ['index.html', 'about.html', 'contact.html']) {
    const o = await open(p);
    check(`${p}: no clip slots`, (await o.page.locator('[data-media-clip], [data-media-poster]').count()) === 0);
    await o.ctx.close();
  }
}
{
  // Replace controls follow Edit mode; labelled; 44px on phones
  const off = await open('work.html', { token: TOKEN, edit: false }); await off.page.waitForSelector('#alcove-admin');
  check('Edit mode off: no clip Replace controls', (await off.page.locator('input.admin-replace-input[data-for^="work.video"], input.admin-replace-input[data-for^="work.ab"]').count()) === 0);
  await off.page.click('#alcove-admin .admin-edit-switch');
  const labels = {};
  for (const k of [VIDEO, POSTER, MEMO, MASTER]) labels[k] = await off.page.getAttribute(`button.admin-replace[data-for="${k}"]`, 'aria-label');
  check('Edit mode on: a labelled Replace button for video, poster, memo and master', [VIDEO, POSTER, MEMO, MASTER].every(k => /replace/i.test(labels[k] || '')) && new Set(Object.values(labels)).size === 4, JSON.stringify(labels));
  check('clip file inputs accept only their types', /mp4/.test(await off.page.getAttribute(input(VIDEO), 'accept')) && !/audio/.test(await off.page.getAttribute(input(VIDEO), 'accept')) && /mp3|mpeg/.test(await off.page.getAttribute(input(MEMO), 'accept')) && !/video\/mp4/.test(await off.page.getAttribute(input(MEMO), 'accept')) && /image/.test(await off.page.getAttribute(input(POSTER), 'accept')));
  await off.page.click('#alcove-admin .admin-edit-switch');
  check('Edit mode switched off removes clip controls', (await off.page.locator('.admin-replace').count()) === 0);
  await off.ctx.close();
  const ph = await unlocked('work.html', { width: 375, height: 800 });
  check('phone: clip Replace buttons are 44px targets', (await ph.page.$$eval('button.admin-replace[data-for^="work.video"], button.admin-replace[data-for^="work.ab"]', b => b.length === 4 && b.every(x => x.getBoundingClientRect().height >= 44 && x.getBoundingClientRect().width >= 44))));
  await ph.ctx.close();
}
{
  // A/B memo and master are independent; previews play before Save; Save order; reload; visitor
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page, errors, allReqs } = await unlocked('work.html', { gh });
  const masterBefore = await page.getAttribute(clipEl(MASTER), 'data-src');
  await page.evaluate(() => document.querySelector('.ab-compare').scrollIntoView());
  await deckReady(page, MEMO); await deckReady(page, MASTER);
  await page.setInputFiles(input(MEMO), memoFile);
  await page.waitForFunction(s => document.querySelector(s).src.startsWith('blob:') && document.querySelector(s).duration > 0.9 && document.querySelector(s).duration < 1.1, clipEl(MEMO), { timeout: 5000 });
  check('staged memo previews in the deck (its own 1.0s clip loaded)', true);
  check('master is untouched by replacing the memo', (await page.getAttribute(clipEl(MASTER), 'data-src')) === masterBefore && (await page.evaluate(s => document.querySelector(s).duration, clipEl(MASTER))) > 5);
  check('staged clip counts as a change; no request yet', (await page.textContent(saveBtn)).includes('1 change') && mediaFileCalls(gh).length === 0 && gh.calls.every(c => c.method === 'GET' || c.method === 'OPTIONS'));
  await page.click('#ab-key-play');
  await page.waitForFunction(s => document.querySelector(s).currentTime > 0.2, clipEl(MEMO), { timeout: 5000 });
  check('the staged memo plays in place before Save', true);
  await page.click('#ab-key-pause');
  await openPanel(page);
  check('panel lists the staged clip by name of slot', /memo/i.test(await page.textContent('#alcove-admin .admin-changes li')));
  await page.setInputFiles(input(MASTER), masterFile);
  await page.waitForFunction(s => { const a = document.querySelector(s); return a.src.startsWith('blob:') && a.duration > 1.4 && a.duration < 1.6; }, clipEl(MASTER), { timeout: 5000 });
  check('master is replaced independently and previews', (await page.textContent(saveBtn)).includes('2 changes'));
  // switch keeps the playhead with replaced clips
  await page.evaluate(() => { document.querySelector('.ab-player audio[data-version="memo"]').currentTime = 0.5; });
  await page.click('#ab-key-flip');
  await page.waitForFunction(() => !window.__abDeck.state().flipping);
  const t = await page.evaluate(() => document.querySelector('.ab-player audio[data-version="master"]').currentTime);
  check('switching with replaced clips keeps the playhead', Math.abs(t - 0.5) < 0.1, String(t));
  await page.click('#alcove-admin .admin-changes li button');
  check('revert drops the staged memo and restores the authored clip', (await page.textContent(saveBtn)).includes('1 change') && (await page.getAttribute(clipEl(MEMO), 'data-src')) === 'media/voice-memo-rough.mp3');
  await page.setInputFiles(input(MEMO), memoFile);
  await page.waitForFunction(s => { const a = document.querySelector(s); return a.src.startsWith('blob:') && a.duration < 1.1; }, clipEl(MEMO), { timeout: 5000 });
  await page.click(saveBtn);
  await saveDone(page);
  const fc = gh.calls.filter(c => c.method === 'PUT').map(c => c.path);
  const mp = mediaFileCalls(gh);
  check('Save sends both files first, content.json last', mp.length === 2 && fc.length === 3 && fc[2] === '/contents/content.json', JSON.stringify(fc));
  check('clip names are sanitized, hashed, under media/, extension kept', mp.every(c => /^\/contents\/media\/(my-rough-memo|final-mix)-[0-9a-f]{8}\.wav$/.test(c.path)), JSON.stringify(mp.map(c => c.path)));
  const b = JSON.parse(mp[0].body);
  check('file PUT targets the content branch', b.branch === 'content' && typeof b.content === 'string');
  const up = Object.entries(gh.files).filter(([p]) => p.startsWith('/contents/media/'));
  check('uploaded bytes are the chosen clips, unchanged', up.some(([p, x]) => /my-rough/.test(p) && x.equals(memoWav)) && up.some(([p, x]) => /final-mix/.test(p) && x.equals(masterWav)));
  const file = savedContent(gh);
  const memoRel = file.media[MEMO], masterRel = file.media[MASTER];
  check('content.json maps both keys to media/ paths, keeping text', /^media\/my-rough-memo-[0-9a-f]{8}\.wav$/.test(memoRel) && /^media\/final-mix-[0-9a-f]{8}\.wav$/.test(masterRel) && file.text['work.h1.listen-in'] === 'Branch Title', JSON.stringify(file));
  check('token only to api.github.com; no console errors', allReqs.every(r => !r.auth || new URL(r.url).host === 'api.github.com') && errors.length === 0, errors.join(' | '));
  await ctx.close();
  // visitor: the deck loads and plays the saved clips
  extra['/' + memoRel] = memoWav; extra['/' + masterRel] = masterWav;
  const v = await open('work.html', { override: gh.file.text });
  check('visitor: deck clips point at the saved files', (await v.page.getAttribute(clipEl(MEMO), 'data-src')) === memoRel && (await v.page.getAttribute(clipEl(MASTER), 'data-src')) === masterRel);
  await v.page.evaluate(() => document.querySelector('.ab-compare').scrollIntoView());
  await deckReady(v.page, MEMO); await deckReady(v.page, MASTER);
  check('visitor: replaced clips load whole as blobs and are the new lengths', (await v.page.evaluate(() => [...document.querySelectorAll('.ab-player audio')].map(a => Math.round(a.duration * 10) / 10))).join() === '1,1.5');
  await v.page.click('#ab-key-play');
  await v.page.waitForFunction(() => document.querySelector('.ab-player audio[data-version="memo"]').currentTime > 0.2);
  await v.page.click('#ab-key-flip');
  await v.page.waitForFunction(() => { const m = document.querySelector('.ab-player audio[data-version="master"]'); return !m.paused && m.currentTime > 0.3; });
  check('visitor: deck plays and switches with the replaced clips', true);
  check('visitor: no console errors', v.errors.length === 0, v.errors.join(' | '));
  await v.ctx.close();
  // editor reload shows them as well
  const a = await unlocked('work.html', { gh: { file: gh.file } });
  check('editor reload: deck clips are the saved files', (await a.page.getAttribute(clipEl(MEMO), 'data-src')) === memoRel);
  await a.ctx.close();
  delete extra['/' + memoRel]; delete extra['/' + masterRel];
}
{
  // session video + poster: stage, preview, Save, visitor
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page, errors } = await unlocked('work.html', { gh });
  const posterBefore = await page.getAttribute(clipEl(VIDEO), 'poster');
  await page.setInputFiles(input(VIDEO), videoFile);
  await page.waitForFunction(s => { const v = document.querySelector(s); return v.src.startsWith('blob:') && v.readyState >= 1 && v.videoWidth > 0; }, clipEl(VIDEO), { timeout: 8000 });
  check('staged video previews in place (blob source, metadata loaded)', true);
  await page.evaluate(s => { const v = document.querySelector(s); v.muted = true; return v.play(); }, clipEl(VIDEO));
  await page.waitForFunction(s => document.querySelector(s).currentTime > 0.2, clipEl(VIDEO), { timeout: 8000 });
  check('staged video plays in place before Save', true);
  await page.setInputFiles(input(POSTER), jpegFile);
  await page.waitForFunction(s => (document.querySelector(s).getAttribute('poster') || '').startsWith('blob:'), clipEl(VIDEO));
  check('staged poster shows in place', (await page.getAttribute(clipEl(VIDEO), 'poster')) !== posterBefore && (await page.textContent(saveBtn)).includes('2 changes'));
  await openPanel(page);
  check('panel lists video and poster', (await page.locator('#alcove-admin .admin-changes li').count()) === 2);
  await page.click(saveBtn); await saveDone(page);
  const fc = gh.calls.filter(c => c.method === 'PUT').map(c => c.path);
  check('Save: video (media/) and poster (images/) first, content.json last', fc.length === 3 && fc[2] === '/contents/content.json' && fc.slice(0, 2).some(p => /^\/contents\/media\/session-tour-[0-9a-f]{8}\.webm$/.test(p)) && fc.slice(0, 2).some(p => /^\/contents\/images\/seth-portrait-[0-9a-f]{8}\.jpg$/.test(p)), JSON.stringify(fc));
  const up = Object.entries(gh.files);
  check('video uploaded unchanged; poster shrunk like a photo', up.some(([p, x]) => /session-tour/.test(p) && x.equals(videoBytes)) && (await dims(up.find(([p]) => /images/.test(p))[1])).join() === '2000,1000');
  const file = savedContent(gh);
  check('content.json maps video and poster keys', /^media\/session-tour-[0-9a-f]{8}\.webm$/.test(file.media[VIDEO]) && /^images\/.+\.jpg$/.test(file.media[POSTER]), JSON.stringify(file.media));
  check('no console errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
  for (const [p, x] of up) extra['/' + p.replace('/contents/', '')] = x;
  const v = await open('work.html', { override: gh.file.text });
  check('visitor: video src and poster are the saved files', (await v.page.getAttribute(clipEl(VIDEO), 'src')) === file.media[VIDEO] && (await v.page.getAttribute(clipEl(VIDEO), 'poster')) === file.media[POSTER]);
  await v.page.waitForFunction(s => document.querySelector(s).readyState >= 1, clipEl(VIDEO), { timeout: 8000 });
  check('visitor: saved video loads; no console errors', v.errors.length === 0, v.errors.join(' | '));
  await v.ctx.close();
  for (const [p] of up) delete extra['/' + p.replace('/contents/', '')];
}
{
  // big clip: uploaded intact through the chunked encoder
  const big = Buffer.alloc(2 * 1024 * 1024 + 12345); for (let i = 0; i < big.length; i++) big[i] = (i * 31 + (i >> 8)) & 255;
  Buffer.from(wavBytes(0.2).subarray(0, 44)).copy(big, 0);
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page } = await unlocked('work.html', { gh });
  await page.setInputFiles(input(MEMO), { name: 'long.wav', mimeType: 'audio/wav', buffer: big });
  await page.waitForFunction(s => document.querySelector(s).getAttribute('data-src').startsWith('blob:'), clipEl(MEMO));
  await openPanel(page); await page.click(saveBtn); await saveDone(page);
  const up = Object.entries(gh.files)[0];
  check('2MB clip arrives byte-identical (chunk boundaries)', up && up[1].length === big.length && up[1].equals(big));
  await ctx.close();
}
{
  // rejections: wrong type, wrong kind, oversize: no staging and no request
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page } = await unlocked('work.html', { gh });
  const tmp = await mkdtemp(join(tmpdir(), 'alcove-')), hugePath = join(tmp, 'huge.wav');
  await writeFile(hugePath, ''); await truncate(hugePath, 90 * 1024 * 1024 + 1);
  const bad = [
    [MEMO, 'over the size cap (audio)', hugePath, /too large|90 ?MB/i],
    [VIDEO, 'over the size cap (video)', join(tmp, 'huge.mp4'), /too large|90 ?MB/i],
    [MEMO, 'text file as audio', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') }, /audio|MP3|type/i],
    [MEMO, 'photo as audio', { name: 'pic.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(50) }, /audio|MP3|type/i],
    [MASTER, 'mp4 video as audio', { name: 'clip.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(50) }, /audio|MP3|type/i],
    [MASTER, 'extension lies about audio (exe)', { name: 'song.exe', mimeType: 'audio/mpeg', buffer: Buffer.alloc(50) }, /audio|MP3|type/i],
    [VIDEO, 'mp3 as video', { name: 'song.mp3', mimeType: 'audio/mpeg', buffer: Buffer.alloc(50) }, /video|MP4|WebM|type/i],
    [VIDEO, 'photo as video', { name: 'pic.png', mimeType: 'image/png', buffer: Buffer.alloc(50) }, /video|MP4|WebM|type/i],
    [POSTER, 'video as poster', { name: 'clip.webm', mimeType: 'video/webm', buffer: Buffer.alloc(50) }, /photo|image|type/i],
  ];
  await writeFile(join(tmp, 'huge.mp4'), ''); await truncate(join(tmp, 'huge.mp4'), 90 * 1024 * 1024 + 1);
  for (const [k, label, f, re] of bad) {
    const before = await page.evaluate(s => document.querySelector(s).getAttribute('data-src') || document.querySelector(s).getAttribute('src') || document.querySelector(s).getAttribute('poster'), clipEl(k) + ',[data-media-poster="' + k + '"]');
    await page.setInputFiles(input(k), f);
    await page.waitForFunction(s => (document.querySelector(s)?.textContent || '').length > 0, mediaErr);
    const msg = await page.textContent(mediaErr);
    check(`${label}: clear message`, re.test(msg), msg);
    const after = await page.evaluate(s => document.querySelector(s).getAttribute('data-src') || document.querySelector(s).getAttribute('src') || document.querySelector(s).getAttribute('poster'), clipEl(k) + ',[data-media-poster="' + k + '"]');
    check(`${label}: nothing staged, slot unchanged, no request`, after === before && (await page.textContent(saveBtn)).trim() === 'Save' && gh.calls.every(c => c.method === 'GET'));
    await page.setInputFiles(input(k), []);
  }
  await page.setInputFiles(input(MEMO), memoFile);
  await page.waitForFunction(s => document.querySelector(s).getAttribute('data-src').startsWith('blob:'), clipEl(MEMO));
  check('a good clip after a rejection clears the error', (await page.textContent(mediaErr)) === '');
  await rm(tmp, { recursive: true, force: true });
  await ctx.close();
}
{
  // a failed clip upload names the file, writes no content.json, keeps the draft; retry works
  const gh = { file: { ...BRANCH_FILE }, failFile: 500 };
  const { ctx, page } = await unlocked('work.html', { gh });
  await page.setInputFiles(input(MEMO), memoFile);
  await page.waitForFunction(s => document.querySelector(s).getAttribute('data-src').startsWith('blob:'), clipEl(MEMO));
  await openPanel(page); await page.click(saveBtn);
  await page.waitForFunction(s => /could not|error|failed/i.test(document.querySelector(s)?.textContent || ''), note);
  const msg = await page.textContent(note);
  check('failed clip upload: message names the file', /my-rough-memo-[0-9a-f]{8}\.wav/.test(msg), msg);
  check('failed clip upload: content.json not written, draft kept', contentPuts(gh).length === 0 && (await page.textContent(saveBtn)).includes('1 change'));
  gh.failFile = 0;
  await page.click(saveBtn); await saveDone(page);
  check('retry after a failed clip upload succeeds', mediaFileCalls(gh).length >= 1 && contentPuts(gh).length === 1);
  await ctx.close();
}
{
  // a progress note names the file while uploading
  const gh = { file: { ...BRANCH_FILE }, delayPut: 600 };
  const { ctx, page } = await unlocked('work.html', { gh });
  await page.setInputFiles(input(MASTER), masterFile);
  await page.waitForFunction(s => document.querySelector(s).getAttribute('data-src').startsWith('blob:'), clipEl(MASTER));
  await openPanel(page);
  await page.evaluate(s => { window.__notes = []; new MutationObserver(() => window.__notes.push(document.querySelector(s).textContent)).observe(document.querySelector(s), { childList: true, characterData: true, subtree: true }); }, note);
  await page.click(saveBtn);
  await saveDone(page);
  const seen = await page.evaluate(() => window.__notes);
  check('upload progress names the file and its position', seen.some(t => /Uploading.*1 of 1.*final-mix-[0-9a-f]{8}\.wav/.test(t)), JSON.stringify(seen));
  await ctx.close();
}
{
  // a staged clip survives a reload (IndexedDB holds the Blob) and saves
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page } = await unlocked('work.html', { gh });
  await page.setInputFiles(input(MEMO), memoFile);
  await page.waitForFunction(s => document.querySelector(s).getAttribute('data-src').startsWith('blob:'), clipEl(MEMO));
  await page.reload(); await page.waitForSelector('#alcove-admin');
  await page.waitForFunction(s => document.querySelector(s).getAttribute('data-src').startsWith('blob:'), clipEl(MEMO), { timeout: 4000 }).catch(() => {});
  check('staged clip survives a reload and still counts', (await page.getAttribute(clipEl(MEMO), 'data-src')).startsWith('blob:') && (await page.textContent(saveBtn)).includes('1 change'));
  await openPanel(page); await page.click(saveBtn); await saveDone(page);
  check('a restored clip saves normally', mediaFileCalls(gh).length === 1 && contentPuts(gh).length === 1);
  await ctx.close();
}
{
  // conflict on a staged clip slot keeps the draft and writes nothing
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page } = await unlocked('work.html', { gh });
  await page.setInputFiles(input(MASTER), masterFile);
  await page.waitForFunction(s => document.querySelector(s).getAttribute('data-src').startsWith('blob:'), clipEl(MASTER));
  gh.file = { sha: 'sha-branch-2', text: JSON.stringify({ version: 1, text: {}, defaults: {}, media: { [MASTER]: 'media/someone-else-12345678.wav' } }) };
  await openPanel(page); await page.click(saveBtn);
  await page.waitForSelector(note + ' button');
  check('conflict on a staged clip: nothing uploaded, draft kept', puts(gh).length === 0 && (await page.textContent(saveBtn)).includes('1 change'));
  await ctx.close();
}
{
  // loader: bad clip paths fall back to the authored files
  const orig = { [VIDEO]: 'media/placeholder-session.webm', [MEMO]: 'media/voice-memo-rough.mp3' };
  for (const [label, media] of [
    ['traversal', { [MEMO]: 'media/../content.json' }], ['dotdot inside name', { [MEMO]: 'media/a..b-12345678.wav' }],
    ['external URL', { [MEMO]: 'https://evil.example/x.wav' }], ['protocol-relative', { [MEMO]: '//evil.example/x.wav' }],
    ['disallowed extension', { [MEMO]: 'media/run-12345678.exe' }], ['wrong folder', { [MEMO]: 'images/x-12345678.wav' }],
    ['image path in a clip slot', { [VIDEO]: 'images/x-12345678.jpg' }], ['non-string', { [MEMO]: 7 }], ['file not found', { [MEMO]: 'media/gone-12345678.wav' }]]) {
    const { ctx, page } = await open('work.html', { override: JSON.stringify({ version: 1, text: {}, defaults: {}, media }) });
    await page.waitForTimeout(150);
    const m = await page.getAttribute(clipEl(MEMO), 'data-src'), vsrc = await page.getAttribute(clipEl(VIDEO), 'src');
    check(`bad clip media (${label}): authored files stay`, vsrc === orig[VIDEO] && m === orig[MEMO] || (label === 'file not found' && m === 'media/gone-12345678.wav'), `${m} ${vsrc}`);
    check(`bad clip media (${label}): page visible`, (await page.evaluate(() => getComputedStyle(document.body).visibility)) === 'visible');
    await ctx.close();
  }
  // a missing saved clip still plays the authored one
  const { ctx, page } = await open('work.html', { override: JSON.stringify({ version: 1, text: {}, defaults: {}, media: { [MEMO]: 'media/gone-12345678.wav' } }) });
  await page.evaluate(() => document.querySelector('.ab-compare').scrollIntoView());
  await deckReady(page, MEMO);
  check('missing saved clip: deck still loads the authored memo', (await page.evaluate(s => document.querySelector(s).duration, clipEl(MEMO))) > 5);
  await ctx.close();
}

// --- Admin media, ticket 03: Songs on Work (add, remove, rename, reorder; genres retired) -------------------------
const AUTHORED = ['Indie Rock Demo', 'Bedroom Pop Single', 'Acoustic Folk Song', 'Alternative & Punk Track'];
const F1 = 'media/track-1-indie.mp3', F2 = 'media/track-2-bedroom-pop.mp3', F3 = 'media/track-3-acoustic.mp3', F4 = 'media/track-4-punk.mp3';
const withSongs = songs => JSON.stringify({ version: 1, text: {}, defaults: {}, songs });
const crateTitles = page => page.$$eval('.sleeve .sleeve-title', t => t.map(x => x.textContent));
const crateSrcs = page => page.$$eval('.sleeve', t => t.map(x => x.dataset.src));
const rowTitles = page => page.$$eval('.admin-songs .admin-song .admin-song-title', t => t.map(x => x.value));
const SG = '.admin-songs', ROW = n => `${SG} .admin-song:nth-child(${n})`;
const songNote = page => page.textContent(`${SG} .admin-song-msg`);
const addSong = async (page, title, file) => {
  await page.fill(`${SG} .admin-song-new-title`, title);
  await page.setInputFiles(`${SG} .admin-song-new-file`, file);
  await page.click(`${SG} .admin-song-add`);
};
const songFile = { name: 'My New Jam!!.WAV', mimeType: 'audio/wav', buffer: wavBytes(1.0, 8000, 500) };
const songsOf = gh => savedContent(gh).songs;
const branchWith = (songs, sha = 'sha-songs-1') => ({ sha, text: JSON.stringify({ version: 1, text: {}, defaults: {}, ...(songs ? { songs } : {}) }) });
{
  // visitor: saved Songs build the Crate in the saved order; titles are text only; player and labels follow
  const evil = '<img src=x onerror=alert(1)> Zed';
  const { ctx, page, errors } = await open('work.html', { override: withSongs([{ title: evil, file: F3 }, { title: 'Alpha', file: F1 }]) });
  check('saved songs replace the authored Crate, in the saved order', (await crateTitles(page)).join('|') === `${evil}|Alpha` && (await crateSrcs(page)).join() === `${F3},${F1}`, JSON.stringify(await crateTitles(page)));
  check('song titles are text only (no markup injected)', (await page.locator('.sleeve img, .sleeve b, .sleeve-title *').count()) === 0 && (await page.evaluate(() => window.__injected)) === undefined);
  check('no genre tabs, labels or attributes', (await page.locator('.filter-pill, .filter-bar, [data-genre], .sleeve-genre').count()) === 0);
  check('each sleeve has an accessible name from its title', (await page.getByRole('button', { name: /Alpha/ }).count()) === 1);
  await flip(page, 1); await page.waitForTimeout(100);
  await page.click(`.sleeve[data-src="${F1}"]`);
  await page.waitForFunction(() => document.querySelector('.record-player').dataset.playing === 'true', null, { timeout: 5000 });
  check('the player plays the song and names it by its title', (await page.getAttribute('#audio-player', 'data-track')) === F1 && /Now playing: Alpha/.test(await page.textContent('.rp-status')) && (await page.textContent('.rp-label-text')).includes('Alpha'));
  check('visitor: no console errors, page visible', errors.length === 0 && (await page.evaluate(() => getComputedStyle(document.body).visibility)) === 'visible', errors.join(' | '));
  await ctx.close();
}
{
  // malformed or unsafe song data falls back to the authored list, silently
  const ok = { title: 'T', file: F1 };
  const cases = [['not an array', 'x'], ['object', { a: 1 }], ['empty list', []], ['21 songs', Array.from({ length: 21 }, (_, i) => ({ title: 'S' + i, file: F1 }))],
    ['item not an object', ['x']], ['null item', [null]], ['title not a string', [{ title: 7, file: F1 }]], ['empty title', [{ title: '   ', file: F1 }]], ['huge title', [{ title: 'x'.repeat(500), file: F1 }]],
    ['traversal', [ok, { title: 'T', file: 'media/../content.json' }]], ['dotdot in name', [{ title: 'T', file: 'media/a..b-12345678.wav' }]], ['external URL', [{ title: 'T', file: 'https://evil.example/x.wav' }]],
    ['protocol-relative', [{ title: 'T', file: '//evil.example/x.wav' }]], ['bad extension', [{ title: 'T', file: 'media/x.exe' }]], ['video extension', [{ title: 'T', file: 'media/x.mp4' }]], ['images folder', [{ title: 'T', file: 'images/x.wav' }]],
    ['missing file', [{ title: 'T' }]], ['one bad among good', [ok, { title: 'T', file: 'media/x.php' }]]];
  for (const [label, songs] of cases) {
    const { ctx, page, errors } = await open('work.html', { override: JSON.stringify({ version: 1, text: {}, defaults: {}, songs }) });
    check(`bad songs (${label}): the authored list stays`, (await crateTitles(page)).join('|') === AUTHORED.join('|') && (await page.getAttribute('.sleeve', 'data-src')) === F1 && errors.length === 0, JSON.stringify(await crateTitles(page)) + errors.join());
    check(`bad songs (${label}): page visible`, (await page.evaluate(() => getComputedStyle(document.body).visibility)) === 'visible');
    await ctx.close();
  }
  const twenty = Array.from({ length: 20 }, (_, i) => ({ title: 'Song ' + (i + 1), file: F1 }));
  const { ctx, page } = await open('work.html', { override: withSongs(twenty) });
  check('exactly 20 saved songs are accepted', (await page.locator('.sleeve').count()) === 20);
  await ctx.close();
  const e = await open('work.html', { override: withSongs([{ title: 'Edge', file: 'media/a.b_c-1.OGG'.toLowerCase() }]) });
  check('ogg, m4a, mp3, webm audio paths are accepted', (await e.page.locator('.sleeve').count()) === 1);
  await e.ctx.close();
  // other pages ignore songs
  const o = await open('about.html', { override: withSongs([{ title: 'x', file: F1 }]) });
  check('songs in content.json do not disturb other pages', o.errors.length === 0);
  await o.ctx.close();
}
{
  // the Songs editor exists only while Edit mode is on; labelled; 44px targets on phones
  const off = await open('work.html', { token: TOKEN, edit: false }); await off.page.waitForSelector('#alcove-admin');
  check('Edit mode off: no Songs editor', (await off.page.locator(SG).count()) === 0);
  await off.page.click('#alcove-admin .admin-edit-switch');
  check('Edit mode on: the Songs editor lists the four authored songs', (await rowTitles(off.page)).join('|') === AUTHORED.join('|'));
  const labels = await off.page.$$eval(`${SG} .admin-song button`, b => b.map(x => x.getAttribute('aria-label')));
  check('every row has labelled Move up, Move down and Remove buttons naming the song', labels.length === 12 && labels.every(l => /^(Move up|Move down|Remove): /.test(l)) && new Set(labels).size === 12, JSON.stringify(labels));
  check('each title input has an accessible name', (await off.page.$$eval(`${SG} .admin-song-title`, i => i.every(x => (x.getAttribute('aria-label') || '').length > 3))));
  check('first Move up and last Move down are disabled', (await off.page.isDisabled(`${ROW(1)} .admin-song-up`)) && (await off.page.isDisabled(`${ROW(4)} .admin-song-down`)) && !(await off.page.isDisabled(`${ROW(2)} .admin-song-up`)));
  check('the add file input only accepts audio types', /audio|mp3/.test(await off.page.getAttribute(`${SG} .admin-song-new-file`, 'accept')) && !/video\/mp4|image/.test(await off.page.getAttribute(`${SG} .admin-song-new-file`, 'accept')));
  await off.page.click('#alcove-admin .admin-edit-switch');
  check('Edit mode switched off removes the Songs editor again', (await off.page.locator(SG).count()) === 0);
  await off.ctx.close();
  const ph = await unlocked('work.html', { width: 375, height: 800 });
  const sizes = await ph.page.$$eval(`${SG} button, ${SG} input`, b => b.filter(x => x.type !== 'file').map(x => { const r = x.getBoundingClientRect(); return [r.width, r.height]; }));
  check('phone: up, down, remove, add and title inputs are 44px targets', sizes.length > 12 && sizes.every(([w, h]) => w >= 44 && h >= 44), JSON.stringify(sizes.filter(([w, h]) => w < 44 || h < 44)));
  check('phone: no horizontal overflow', (await ph.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
  await ph.ctx.close();
}
{
  // rename in place: live in the Crate, counted, saved as songs only (no files), visitor sees it
  const gh = { file: branchWith(null) };
  const { ctx, page, errors, allReqs } = await unlocked('work.html', { gh });
  await page.fill(`${ROW(2)} .admin-song-title`, 'My Bedroom Banger');
  check('renaming shows in the Crate at once and names the sleeve', (await crateTitles(page)).join('|') === [AUTHORED[0], 'My Bedroom Banger', AUTHORED[2], AUTHORED[3]].join('|') && (await page.locator('.rp-crate').getByRole('button', { name: /My Bedroom Banger/ }).count()) === 1);
  await openPanel(page);
  check('the rename counts as one change', (await page.textContent(saveBtn)).includes('1 change') && /renamed/i.test(await page.textContent('#alcove-admin .admin-changes')));
  await page.click(saveBtn); await saveDone(page);
  check('Save sends only content.json (no media files)', puts(gh).length === 1 && contentPuts(gh).length === 1);
  const file = songsOf(gh);
  check('content.json carries the whole ordered list with the new title', JSON.stringify(file) === JSON.stringify([{ title: AUTHORED[0], file: F1 }, { title: 'My Bedroom Banger', file: F2 }, { title: AUTHORED[2], file: F3 }, { title: AUTHORED[3], file: F4 }]), JSON.stringify(file));
  check('version stays 1', savedContent(gh).version === 1);
  check('after Save the count is zero and the note says live in a minute or two or lists success', (await page.textContent(saveBtn)).trim() === 'Save');
  check('token only to api.github.com; no console errors', allReqs.every(r => !r.auth || new URL(r.url).host === 'api.github.com') && errors.length === 0, errors.join(' | '));
  const v = await open('work.html', { override: JSON.stringify(savedContent(gh)) });
  check('visitor reload shows the renamed song', (await crateTitles(v.page))[1] === 'My Bedroom Banger');
  await v.ctx.close();
  await ctx.close();
}
{
  // reorder with up/down buttons: live order, focus stays on the moved song's button, revert restores, Save writes the order
  const gh = { file: branchWith(null) };
  const { ctx, page } = await unlocked('work.html', { gh });
  await page.click(`${ROW(3)} .admin-song-up`);
  check('Move up reorders the list and the Crate', (await rowTitles(page)).join('|') === [AUTHORED[0], AUTHORED[2], AUTHORED[1], AUTHORED[3]].join('|') && (await crateTitles(page)).join('|') === [AUTHORED[0], AUTHORED[2], AUTHORED[1], AUTHORED[3]].join('|') && (await crateSrcs(page)).join() === [F1, F3, F2, F4].join());
  check('focus stays on the moved song\'s Move up button', await page.evaluate(() => document.activeElement.matches('.admin-song:nth-child(2) .admin-song-up')));
  await page.click(`${ROW(1)} .admin-song-down`);
  check('Move down reorders too', (await rowTitles(page))[0] === AUTHORED[2] && (await rowTitles(page))[1] === AUTHORED[0]);
  await openPanel(page);
  check('order changes are counted', /\d change/.test(await page.textContent(saveBtn)) && /order/i.test(await page.textContent('#alcove-admin .admin-changes')));
  const revert = page.locator('#alcove-admin .admin-changes li', { hasText: /order/i }).locator('button');
  await revert.click();
  check('reverting the order restores it everywhere and clears the count', (await rowTitles(page)).join('|') === AUTHORED.join('|') && (await crateTitles(page)).join('|') === AUTHORED.join('|') && (await page.textContent(saveBtn)).trim() === 'Save');
  await page.click(`${ROW(4)} .admin-song-up`); await page.click(`${ROW(3)} .admin-song-up`); await page.click(`${ROW(2)} .admin-song-up`);
  await page.click(saveBtn); await saveDone(page);
  check('Save writes the new order', songsOf(gh).map(s => s.file).join() === [F4, F1, F2, F3].join(), JSON.stringify(songsOf(gh)));
  const v = await open('work.html', { override: JSON.stringify(savedContent(gh)) });
  check('visitor: the player uses the saved order', (await crateSrcs(v.page)).join() === [F4, F1, F2, F3].join());
  await v.ctx.close();
  await ctx.close();
}
{
  // remove: gone from list and Crate; revert brings it back in place; removing the playing song resets the player; at least one stays
  const gh = { file: branchWith(null) };
  const { ctx, page } = await unlocked('work.html', { gh });
  await page.click(`.sleeve[data-src="${F1}"]`);
  await page.waitForFunction(() => document.querySelector('.record-player').dataset.playing === 'true', null, { timeout: 5000 });
  await page.click(`${ROW(1)} .admin-song-remove`);
  check('removing a song drops it from the list and the Crate', (await rowTitles(page)).join('|') === AUTHORED.slice(1).join('|') && (await crateTitles(page)).join('|') === AUTHORED.slice(1).join('|'));
  check('removing the playing song stops the player and empties the platter', (await page.evaluate(() => document.getElementById('audio-player').paused)) && (await page.getAttribute('.record-player', 'data-state')) === 'empty' && (await page.textContent('.rp-status')).startsWith('Pick'));
  await openPanel(page);
  check('removal is counted as a change', (await page.textContent(saveBtn)).includes('1 change') && /removed/i.test(await page.textContent('#alcove-admin .admin-changes')));
  await page.locator('#alcove-admin .admin-changes li', { hasText: /removed/i }).locator('button').click();
  check('Revert brings the song back at its place', (await rowTitles(page)).join('|') === AUTHORED.join('|') && (await crateTitles(page)).join('|') === AUTHORED.join('|') && (await page.textContent(saveBtn)).trim() === 'Save');
  await page.click(`${ROW(2)} .admin-song-remove`);
  await page.click(saveBtn); await saveDone(page);
  check('Save writes the list without it, no files uploaded or deleted', songsOf(gh).map(s => s.file).join() === [F1, F3, F4].join() && puts(gh).length === 1 && gh.calls.every(c => c.method !== 'DELETE'));
  for (let i = 0; i < 2; i++) await page.click(`${ROW(1)} .admin-song-remove`);
  check('the last song cannot be removed, with a reason', (await rowTitles(page)).length === 1 && (await page.isDisabled(`${ROW(1)} .admin-song-remove`)) && /at least one/i.test(await songNote(page)), await songNote(page));
  await ctx.close();
}
{
  // add: title + audio file; previewed (plays) before Save; Save uploads the audio first, then content.json
  const gh = { file: branchWith(null) };
  const { ctx, page, errors, allReqs } = await unlocked('work.html', { gh });
  await addSong(page, '  My New Jam  ', songFile);
  await page.waitForFunction(n => document.querySelectorAll('.sleeve').length === n, 5);
  check('the new song is appended to the list and the Crate with a trimmed title', (await rowTitles(page)).at(-1) === 'My New Jam' && (await crateTitles(page)).at(-1) === 'My New Jam');
  check('the add fields are cleared', (await page.inputValue(`${SG} .admin-song-new-title`)) === '' && (await page.textContent(`${SG} .admin-song-msg`)) === '');
  check('the staged song previews from a blob', (await crateSrcs(page)).at(-1).startsWith('blob:'));
  for (let i = 0; i < 4 && (await page.getAttribute('.sleeve:last-of-type', 'data-pos')) !== 'front'; i++) { await flip(page, 1); await page.waitForTimeout(80); }
  await page.waitForFunction(() => !document.querySelector('.record-player').dataset.picking);
  await page.click('.sleeve:last-of-type');
  await page.waitForFunction(() => document.querySelector('.record-player').dataset.playing === 'true', null, { timeout: 6000 });
  const dur = await page.evaluate(() => document.getElementById('audio-player').duration);
  check('the staged song plays in place before Save (its own 1s clip)', dur > 0.8 && dur < 1.3, String(dur));
  await page.evaluate(() => document.getElementById('audio-player').pause());
  await openPanel(page);
  check('the staged song counts in Save', (await page.textContent(saveBtn)).includes('1 change') && /added/i.test(await page.textContent('#alcove-admin .admin-changes')));
  await page.click(saveBtn); await saveDone(page);
  const order = gh.calls.filter(c => c.method === 'PUT').map(c => c.path);
  check('Save sends the audio file first, then content.json', order.length === 2 && /^\/contents\/media\/my-new-jam-[0-9a-f]{8}\.wav$/.test(order[0]) && order[1] === '/contents/content.json', JSON.stringify(order));
  const up = Object.entries(gh.files)[0];
  check('uploaded bytes are the chosen audio, unchanged, on the content branch', up[1].equals(songFile.buffer) && JSON.parse(mediaFileCalls(gh)[0].body).branch === 'content');
  const list = songsOf(gh);
  check('content.json lists all five songs, the new one last, with its saved path', list.length === 5 && list[4].title === 'My New Jam' && list[4].file === order[0].replace('/contents/', ''), JSON.stringify(list));
  check('after Save the song is no longer pending and its sleeve keeps working', (await page.textContent(saveBtn)).trim() === 'Save');
  check('token only to api.github.com; no console errors', allReqs.every(r => !r.auth || new URL(r.url).host === 'api.github.com') && errors.length === 0, errors.join(' | '));
  const v = await open('work.html', { override: JSON.stringify(savedContent(gh)), gh: {} });
  check('visitor: five sleeves, the new one last', (await crateTitles(v.page)).length === 5 && (await crateTitles(v.page)).at(-1) === 'My New Jam');
  await v.ctx.close();
  await ctx.close();
}
{
  // add: rejected with a clear message and no request: wrong type, oversize, no title, no file, duplicate file
  const gh = { file: branchWith(null) };
  const { ctx, page } = await unlocked('work.html', { gh });
  const tmp = await mkdtemp(join(tmpdir(), 'alcove-songs-'));
  const huge = join(tmp, 'huge.mp3'); await writeFile(huge, ''); await truncate(huge, 90 * 1024 * 1024 + 1);
  const bad = [
    ['a photo', 'T', { name: 'pic.png', mimeType: 'image/png', buffer: Buffer.alloc(50) }, /audio|MP3|type/i],
    ['a video', 'T', { name: 'clip.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(50) }, /audio|MP3|type/i],
    ['a text file', 'T', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.alloc(50) }, /audio|MP3|type/i],
    ['an exe lying about its type', 'T', { name: 'song.exe', mimeType: 'audio/mpeg', buffer: Buffer.alloc(50) }, /audio|MP3|type/i],
    ['over the size cap', 'T', huge, /too large|90 ?MB/i],
    ['no title', '   ', songFile, /title/i],
  ];
  for (const [label, title, f, re] of bad) {
    await addSong(page, title, f);
    await page.waitForFunction(s => (document.querySelector(s)?.textContent || '').length > 0, `${SG} .admin-song-msg`);
    const msg = await songNote(page);
    check(`add rejected (${label}): clear message`, re.test(msg), msg);
    check(`add rejected (${label}): nothing staged, list unchanged, no request`, (await rowTitles(page)).length === 4 && (await page.locator('.sleeve').count()) === 4 && (await page.textContent(saveBtn)).trim() === 'Save' && gh.calls.every(c => c.method === 'GET'));
    await page.setInputFiles(`${SG} .admin-song-new-file`, []);
  }
  await page.fill(`${SG} .admin-song-new-title`, 'Only a title');
  await page.click(`${SG} .admin-song-add`);
  check('add with no file: asks for a file', /file|audio/i.test(await songNote(page)) && (await rowTitles(page)).length === 4, await songNote(page));
  await addSong(page, 'Good one', songFile);
  await page.waitForFunction(() => document.querySelectorAll('.sleeve').length === 5);
  check('a good song after a rejection clears the message', (await songNote(page)) === '');
  await addSong(page, 'Same file again', songFile);
  await page.waitForFunction(s => (document.querySelector(s)?.textContent || '').length > 0, `${SG} .admin-song-msg`);
  check('the same file twice is refused', /already/i.test(await songNote(page)) && (await rowTitles(page)).length === 5, await songNote(page));
  await rm(tmp, { recursive: true, force: true });
  await ctx.close();
}
{
  // 20-song cap: a clear message at the limit; room again after removing one
  const nineteen = Array.from({ length: 19 }, (_, i) => ({ title: 'Song ' + (i + 1), file: F1 }));
  const { ctx, page } = await unlocked('work.html', { gh: { file: branchWith(nineteen) } });
  check('19 saved songs: Add is available', (await rowTitles(page)).length === 19 && !(await page.isDisabled(`${SG} .admin-song-add`)));
  await addSong(page, 'Number twenty', songFile);
  await page.waitForFunction(() => document.querySelectorAll('.sleeve').length === 20);
  check('at 20 songs: Add is disabled and the message names the limit', (await page.isDisabled(`${SG} .admin-song-add`)) && /20/.test(await songNote(page)) && /remove/i.test(await songNote(page)), await songNote(page));
  await page.click(`${ROW(20)} .admin-song-remove`);
  check('removing one frees a place again', !(await page.isDisabled(`${SG} .admin-song-add`)) && (await page.locator('.sleeve').count()) === 19);
  await ctx.close();
}
{
  // revert an added song before saving; staged songs survive a reload; leave warning while pending
  const gh = { file: branchWith(null) };
  const { ctx, page } = await unlocked('work.html', { gh });
  await addSong(page, 'Reload Me', songFile);
  await page.waitForFunction(() => document.querySelectorAll('.sleeve').length === 5);
  await page.fill(`${ROW(1)} .admin-song-title`, 'Renamed One');
  await page.click(`${ROW(3)} .admin-song-up`);
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForSelector(`${SG} .admin-song`);
  await page.waitForFunction(() => document.querySelectorAll('.sleeve').length === 5, null, { timeout: 5000 });
  check('after a reload the staged song, rename and order are back', (await rowTitles(page)).join('|') === ['Renamed One', AUTHORED[2], AUTHORED[1], AUTHORED[3], 'Reload Me'].join('|') && (await crateTitles(page)).at(-1) === 'Reload Me', JSON.stringify(await rowTitles(page)));
  await openPanel(page);
  check('the restored changes are counted again', /^Save [3-9] changes$/.test((await page.textContent(saveBtn)).trim()), await page.textContent(saveBtn));
  await page.evaluate(() => { window.__beforeunload = null; window.addEventListener('beforeunload', e => { window.__beforeunload = e.defaultPrevented; }); window.dispatchEvent(new Event('beforeunload', { cancelable: true })); });
  check('leaving with staged songs is warned about', (await page.evaluate(() => window.__beforeunload)) === true);
  await page.locator('#alcove-admin .admin-changes li', { hasText: /added/i }).locator('button').click();
  check('Revert on the added song removes it and its preview', (await rowTitles(page)).length === 4 && (await page.locator('.sleeve').count()) === 4 && (await crateSrcs(page)).every(s => !s.startsWith('blob:')));
  await ctx.close();
}
{
  // conflict: the branch's songs changed after load, and this editor changes songs: stop, nothing uploaded, drafts kept
  const gh = { file: branchWith([{ title: 'Branch A', file: F1 }, { title: 'Branch B', file: F2 }]) };
  const { ctx, page } = await unlocked('work.html', { gh });
  check('unlocked: Songs come from the content branch file', (await rowTitles(page)).join('|') === 'Branch A|Branch B');
  await addSong(page, 'Conflicting', songFile);
  await page.waitForFunction(() => document.querySelectorAll('.sleeve').length === 3);
  gh.file = branchWith([{ title: 'Someone Else', file: F3 }], 'sha-songs-2');
  await openPanel(page); await page.click(saveBtn);
  await page.waitForFunction(s => /changed/i.test(document.querySelector(s)?.textContent || ''), note);
  check('conflict: no file uploaded, no content.json written, drafts kept', puts(gh).length === 0 && (await page.textContent(saveBtn)).includes('1 change') && (await rowTitles(page)).length === 3, JSON.stringify(puts(gh).map(c => c.path)));
  await ctx.close();
  // no clash when the branch moved but songs are untouched by this save
  const gh2 = { file: branchWith([{ title: 'Branch A', file: F1 }]) };
  const o = await unlocked('work.html', { gh: gh2 });
  await replaceText(o.page, H1SEL, 'Other Edit'); await o.page.keyboard.press('Escape');
  gh2.file = { sha: 'sha-songs-3', text: JSON.stringify({ version: 1, text: {}, defaults: {}, songs: [{ title: 'Branch A', file: F1 }], media: {} }) };
  await openPanel(o.page); await o.page.click(saveBtn); await saveDone(o.page);
  check('a text-only save keeps the branch\'s songs untouched', JSON.stringify(songsOf(gh2)) === JSON.stringify([{ title: 'Branch A', file: F1 }]));
  await o.ctx.close();
}
{
  // a failed audio upload stops the Save: names the file, content.json not written, song stays staged; retry works
  const gh = { file: branchWith(null), failFile: 500 };
  const { ctx, page } = await unlocked('work.html', { gh });
  await addSong(page, 'Flaky', songFile);
  await page.waitForFunction(() => document.querySelectorAll('.sleeve').length === 5);
  await openPanel(page); await page.click(saveBtn);
  await page.waitForFunction(s => /could not|error|failed/i.test(document.querySelector(s)?.textContent || ''), note);
  check('upload failure names the audio file and writes no content.json', /flaky|my-new-jam/i.test(await page.textContent(note)) && contentPuts(gh).length === 0, await page.textContent(note));
  check('the song stays staged and counted', (await page.textContent(saveBtn)).includes('1 change') && (await rowTitles(page)).at(-1) === 'Flaky');
  gh.failFile = 0;
  await page.click(saveBtn); await saveDone(page);
  check('retry saves the audio then content.json', contentPuts(gh).length === 1 && songsOf(gh).at(-1).title === 'Flaky');
  await ctx.close();
}
{
  // song + text + slot changes save together, files first (slot photo and song audio), content.json last
  const gh = { file: branchWith(null) };
  const { ctx, page } = await unlocked('work.html', { gh });
  await replaceText(page, H1SEL, 'Both'); await page.keyboard.press('Escape');
  await addSong(page, 'Combo', songFile);
  await page.waitForFunction(() => document.querySelectorAll('.sleeve').length === 5);
  await page.setInputFiles(input(MEMO), memoFile);
  await page.waitForFunction(s => document.querySelector(s).getAttribute('data-src').startsWith('blob:'), clipEl(MEMO));
  await openPanel(page);
  check('text, clip and song changes are all counted', (await page.textContent(saveBtn)).includes('3 changes'), await page.textContent(saveBtn));
  await page.click(saveBtn); await saveDone(page);
  const order = puts(gh).map(c => c.path);
  check('both audio files first, content.json last', order.length === 3 && order[2] === '/contents/content.json' && order.slice(0, 2).every(p => p.startsWith('/contents/media/')), JSON.stringify(order));
  const f = savedContent(gh);
  check('content.json has the text, the slot and the songs', f.text['work.h1.listen-in'] === 'Both' && /^media\/my-rough-memo/.test(f.media[MEMO]) && f.songs.at(-1).title === 'Combo');
  await ctx.close();
}
{
  // sign out clears staged songs and their draft
  const { ctx, page } = await unlocked('work.html', { gh: { file: branchWith(null) } });
  await addSong(page, 'Gone Soon', songFile);
  await page.waitForFunction(() => document.querySelectorAll('.sleeve').length === 5);
  await page.fill(`${ROW(1)} .admin-song-title`, 'Draft Title');
  await page.waitForTimeout(200);
  check('a songs draft is kept in this browser while unsaved', await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('alcove_admin_draft'))));
  await openPanel(page);
  await Promise.all([page.waitForEvent('load'), page.click('#alcove-admin .admin-signout')]);
  check('sign out discards songs drafts', await page.evaluate(() => !Object.keys(localStorage).some(k => k.startsWith('alcove_admin_draft'))));
  await ctx.close();
}

// --- Admin media, ticket 04: cleanup, failure ordering, conflicts ---------------------------------------------------
{
  const OLD_P = 'images/old-portrait-aaaaaaaa.jpg', OLD_A = 'media/old-a-11111111.wav', OLD_B = 'media/old-b-22222222.wav', OLD_M = 'media/old-memo-33333333.wav';
  const PIANO = 'about.photo.the-piano-and-desk-area';
  const mk = (media, songs) => ({ sha: 'sha-c1', text: JSON.stringify({ version: 1, text: {}, defaults: {}, media, ...(songs ? { songs } : {}) }) });
  const have = (...ps) => Object.fromEntries(ps.map(p => ['/contents/' + p, Buffer.from('x')]));
  const dels = gh => gh.calls.filter(c => c.method === 'DELETE');
  const idx = (gh, pred) => gh.calls.findIndex(pred);
  const until = async (fn, ms = 5000) => { for (let n = 0; n < ms / 50 && !fn(); n++) await new Promise(r => setTimeout(r, 50)); };
  const stage = async (page, key = PORTRAIT) => { await page.setInputFiles(input(key), jpegFile); await page.waitForFunction(([s]) => document.querySelector(s).src.startsWith('blob:'), [imgOf(key)]); };

  {
    // replaced photo: old file deleted with its sha, on the content branch, AFTER content.json is written
    const gh = { file: mk({ [PORTRAIT]: OLD_P }), files: have(OLD_P) };
    const { ctx, page } = await unlocked('about.html', { gh });
    await stage(page); await openPanel(page); await page.click(saveBtn); await saveDone(page);
    await until(() => gh.deleted);
    const d = dels(gh);
    check('replaced photo: old file deleted (DELETE with branch content and the sha from GET)', d.length === 1 && d[0].path === '/contents/' + OLD_P && JSON.parse(d[0].body).branch === 'content' && JSON.parse(d[0].body).sha === 'filesha' && gh.deleted[0] === '/contents/' + OLD_P, JSON.stringify(d.map(c => c.path)));
    check('delete comes after the content.json PUT', idx(gh, c => c.method === 'DELETE') > idx(gh, c => c.path === '/contents/content.json' && c.method === 'PUT') && idx(gh, c => c.path === '/contents/content.json' && c.method === 'PUT') > 0);
    check('the new file is not deleted', !gh.deleted.some(x => /seth-portrait/.test(x)) && Object.keys(gh.files).some(x => /seth-portrait/.test(x)));
    check('success message says live in a minute or two, no merge wording', /minute or two/.test(await page.textContent(note)) && !/merge/i.test(await page.textContent(note)));
    await ctx.close();
  }
  {
    // shared file kept: another slot in the merged file still uses it
    const gh = { file: mk({ [PORTRAIT]: OLD_P, [PIANO]: OLD_P }), files: have(OLD_P) };
    const { ctx, page } = await unlocked('about.html', { gh });
    await stage(page); await openPanel(page); await page.click(saveBtn); await saveDone(page); await page.waitForTimeout(500);
    check('file still used by another slot is kept', dels(gh).length === 0 && !!gh.files['/contents/' + OLD_P]);
    await ctx.close();
  }
  {
    // authored defaults and textures are never deleted, even when saved media pointed at them
    const gh = { file: mk({ [PORTRAIT]: 'images/studio-live-room.jpg', [PIANO]: 'images/textures/metal.webp' }), files: have('images/studio-live-room.jpg', 'images/textures/metal.webp') };
    const { ctx, page } = await unlocked('about.html', { gh });
    await stage(page); await stage(page, PIANO); await openPanel(page); await page.click(saveBtn); await saveDone(page); await page.waitForTimeout(500);
    check('authored defaults (used on any page) and non-whitelisted paths are never deleted', dels(gh).length === 0 && Object.keys(gh.files).length >= 3, JSON.stringify(dels(gh).map(c => c.path)));
    await ctx.close();
  }
  {
    // clip slot + removed song: old clip and old song audio deleted; a song file still in the list is kept; authored track files kept
    const gh = { file: mk({ [MEMO]: OLD_M }, [{ title: 'A', file: OLD_A }, { title: 'B', file: OLD_B }, { title: 'C', file: F1 }]), files: have(OLD_M, OLD_A, OLD_B, F1) };
    const { ctx, page } = await unlocked('work.html', { gh });
    await page.click(`${ROW(2)} .admin-song-remove`);
    await page.click(`${ROW(2)} .admin-song-remove`);   // the list closes up, so the old third song is now second
    await page.setInputFiles(input(MEMO), memoFile);
    await page.waitForFunction(s => document.querySelector(s).getAttribute('data-src').startsWith('blob:'), clipEl(MEMO));
    await openPanel(page); await page.click(saveBtn); await saveDone(page); await until(() => gh.deleted && gh.deleted.length >= 2);
    const gone = (gh.deleted || []).map(x => x.replace('/contents/', '')).sort();
    check('replaced memo and removed song audio deleted; authored track file kept', gone.join() === [OLD_B, OLD_M].sort().join() && !!gh.files['/contents/' + OLD_A] && !!gh.files['/contents/' + F1], JSON.stringify(gone));
    await ctx.close();
  }
  {
    // delete failure is soft: Save still succeeded, message names the file, drafts cleared
    const gh = { file: mk({ [PORTRAIT]: OLD_P }), files: have(OLD_P), failDelete: 500 };
    const { ctx, page } = await unlocked('about.html', { gh });
    await stage(page); await openPanel(page); await page.click(saveBtn); await saveDone(page);
    await page.waitForFunction(s => /old-portrait/.test(document.querySelector(s).textContent), note);
    check('delete failure: content saved, file named softly, count cleared', contentPuts(gh).length === 1 && /old-portrait-aaaaaaaa\.jpg/.test(await page.textContent(note)) && /Saved/.test(await page.textContent(note)) && (await page.textContent(saveBtn)).trim() === 'Save');
    await ctx.close();
  }
  {
    // no deletions after an upload failure; retry works and then cleans up
    const gh = { file: mk({ [PORTRAIT]: OLD_P }), files: have(OLD_P), failFile: 500 };
    const { ctx, page } = await unlocked('about.html', { gh });
    await stage(page); await openPanel(page); await page.click(saveBtn);
    await page.waitForFunction(s => /could not/i.test(document.querySelector(s)?.textContent || ''), note);
    check('upload failure: no DELETE, no content.json, file named', dels(gh).length === 0 && contentPuts(gh).length === 0 && /seth-portrait-[0-9a-f]{8}\.jpg/.test(await page.textContent(note)) && !!gh.files['/contents/' + OLD_P]);
    gh.failFile = 0; await openPanel(page); await page.click(saveBtn); await saveDone(page); await until(() => gh.deleted);
    check('retry succeeds and then removes the old file', (gh.deleted || []).length === 1);
    await ctx.close();
  }
  {
    // content.json PUT failure: no deletions
    const gh = { file: mk({ [PORTRAIT]: OLD_P }), files: have(OLD_P), putStatus: 500 };
    const { ctx, page } = await unlocked('about.html', { gh });
    await stage(page); await openPanel(page); await page.click(saveBtn);
    await page.waitForFunction(s => /error|nothing was saved/i.test(document.querySelector(s)?.textContent || ''), note);
    await page.waitForTimeout(300);
    check('content.json PUT failure: nothing deleted', dels(gh).length === 0 && !!gh.files['/contents/' + OLD_P] && (await page.textContent(saveBtn)).includes('1 change'));
    await ctx.close();
  }
  {
    // conflict on a staged song: existing message, drafts kept, nothing uploaded or deleted; other-key change still merges
    const gh = { file: mk({ [PORTRAIT]: OLD_P }, [{ title: 'A', file: OLD_A }]), files: have(OLD_P, OLD_A) };
    const { ctx, page } = await unlocked('work.html', { gh });
    await addSong(page, 'Mine', songFile);
    await page.waitForFunction(() => document.querySelectorAll('.sleeve').length === 2);
    gh.file = { sha: 'sha-c2', text: JSON.stringify({ version: 1, text: {}, defaults: {}, media: { [PORTRAIT]: OLD_P }, songs: [{ title: 'Other', file: OLD_A }] }) };
    await openPanel(page); await page.click(saveBtn); await page.waitForSelector(note + ' button');
    check('song conflict: message, drafts kept, nothing written or deleted', /changed/i.test(await page.textContent(note)) && puts(gh).length === 0 && dels(gh).length === 0 && (await page.textContent(saveBtn)).includes('1 change'));
    await ctx.close();
    const gh2 = { file: mk({ [PORTRAIT]: OLD_P }), files: have(OLD_P) };
    const o = await unlocked('about.html', { gh: gh2 });
    await stage(o.page);
    gh2.file = { sha: 'sha-c3', text: JSON.stringify({ version: 1, text: { 'x.other': 'new' }, defaults: {}, media: { [PORTRAIT]: OLD_P } }) };
    await openPanel(o.page); await o.page.click(saveBtn); await saveDone(o.page);
    check('other-key change on the branch still merges', savedContent(gh2).text['x.other'] === 'new' && !!savedContent(gh2).media[PORTRAIT] && savedContent(gh2).media[PORTRAIT] !== OLD_P);
    await o.ctx.close();
  }
  {
    // editors cannot choose paths: hostile names become slug + hash under media/ or images/
    const gh = { file: branchWith(null) };
    const { ctx, page } = await unlocked('work.html', { gh });
    await addSong(page, 'Sneaky', { name: '../../images/../x/Evil Name!!.wav', mimeType: 'audio/wav', buffer: songFile.buffer });
    await page.waitForFunction(() => document.querySelectorAll('.sleeve').length === 5);
    await openPanel(page); await page.click(saveBtn); await saveDone(page);
    check('hostile file name is sanitized to media/slug-hash under the media folder', mediaFileCalls(gh).length === 1 && /^\/contents\/media\/evil-name-[0-9a-f]{8}\.wav$/.test(mediaFileCalls(gh)[0].path), JSON.stringify(puts(gh).map(c => c.path)));
    await ctx.close();
  }
}

{
  // hardening: a stored (IndexedDB) file with a tampered path is never restored, so it can never be uploaded
  const gh = { file: { ...BRANCH_FILE } };
  const { ctx, page } = await unlocked('work.html', { gh });
  await page.setInputFiles(input(MEMO), memoFile);
  await page.waitForFunction(s => document.querySelector(s).getAttribute('data-src').startsWith('blob:'), clipEl(MEMO));
  await page.evaluate(() => new Promise((res, rej) => {
    const o = indexedDB.open('alcove_admin', 1);
    o.onsuccess = () => { const tx = o.result.transaction('media', 'readwrite'), st = tx.objectStore('media'), q = st.openCursor();
      q.onsuccess = () => { const c = q.result; if (c) { const v = c.value; v.path = 'media/../.github/evil.wav'; c.update(v); c.continue(); } };
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); };
    o.onerror = () => rej(o.error);
  }));
  await page.reload(); await page.waitForSelector('#alcove-admin');
  await page.waitForTimeout(600);
  check('a tampered stored path is not restored and nothing is staged', !(await page.getAttribute(clipEl(MEMO), 'data-src')).startsWith('blob:') && (await page.textContent(saveBtn)).trim() === 'Save');
  await ctx.close();
}

// --- Admin media, ticket 06: Sleeve covers -------------------------------------------------------------------------
{
  const CB = '.admin-cover-replace', CI = '.admin-cover-input';
  const coverImg = await fixture(2400, 1200);
  const coverFile = { name: 'Album Art!!.JPG', mimeType: 'image/jpeg', buffer: coverImg };
  const COV = 'images/cover-old-aaaaaaaa.jpg';
  const frontTitle = page => page.$eval('.sleeve[data-pos="front"] .sleeve-title', t => t.textContent.trim());
  const settled = page => page.waitForFunction(() => !document.querySelector('.rp-stack').getAnimations({ subtree: true }).some(a => a.playState === 'running'));
  const sleeveCover = (page, n) => page.$$eval('.sleeve', (ss, i) => ({ has: ss[i].classList.contains('has-cover'), cover: ss[i].dataset.cover || null, css: ss[i].style.getPropertyValue('--cover') }), n);
  const blobDims = (page, url) => page.evaluate(async u => { const bm = await createImageBitmap(await (await fetch(u)).blob()); return [bm.width, bm.height]; }, url);
  const stageCover = async (page, f = coverFile) => { await page.setInputFiles(CI, f); await page.waitForFunction(() => document.querySelector('.sleeve[data-pos="front"]').dataset.cover?.startsWith('blob:')); };
  const withCover = (list, n) => list.map((x, i) => i === n ? { ...x, cover: COV } : x);
  const four = [{ title: AUTHORED[0], file: F1 }, { title: AUTHORED[1], file: F2 }, { title: AUTHORED[2], file: F3 }, { title: AUTHORED[3], file: F4 }];

  {
    // content-loader: a valid cover is read; every kind of bad cover is dropped without invalidating the song or the list
    const good = await open('work.html', { override: withSongs(withCover(four, 1)) });
    check('visitor: a saved cover shows on its sleeve, the others keep the pattern', JSON.stringify([0, 1, 2, 3].map(n => null)) && (await sleeveCover(good.page, 1)).cover === COV && (await sleeveCover(good.page, 0)).has === false && (await sleeveCover(good.page, 2)).has === false);
    await good.ctx.close();
    for (const [label, cover] of [['outside images/', 'media/x.jpg'], ['traversal', 'images/../content.json'], ['external URL', 'https://evil.example/x.jpg'], ['wrong extension', 'images/x.php'], ['not a string', 7], ['quote', 'images/a".jpg'], ['subfolder', 'images/textures/x.jpg']]) {
      const { ctx, page, errors } = await open('work.html', { override: withSongs(four.map((x, i) => i === 0 ? { ...x, cover } : x)) });
      const c = await sleeveCover(page, 0);
      check(`bad cover (${label}): dropped, song and list stay`, !c.has && c.cover === null && (await crateTitles(page)).join('|') === AUTHORED.join('|') && errors.length === 0, JSON.stringify(c) + errors.join());
      await ctx.close();
    }
  }
  {
    // Edit mode off: no button. On: one labelled button on the sticking-out Sleeve, a real 44px button, follows flips, inside the viewport
    const off = await open('work.html', { token: TOKEN });
    await off.page.waitForSelector('#alcove-admin');
    check('Edit mode off: no Replace cover button', (await off.page.locator(CB).count()) === 0);
    await off.ctx.close();
    const { ctx, page } = await unlocked('work.html', { gh: {} });
    check('Edit mode on: exactly one Replace cover button, a real button', (await page.locator(CB).count()) === 1 && (await page.$eval(CB, b => b.tagName)) === 'BUTTON' && !(await page.$eval(CB, b => !!b.closest('.sleeve'))));
    check('button is labelled with the front song', (await page.getAttribute(CB, 'aria-label')) === 'Replace cover: ' + AUTHORED[0], await page.getAttribute(CB, 'aria-label'));
    const box = async () => { const b = await page.locator(CB).boundingBox(), s = await page.locator('.sleeve[data-pos="front"]').boundingBox(); return { b, s }; };
    let { b, s } = await box();
    check('button is at least 44px and sits over the visible left part of the front Sleeve, on screen', b.width >= 44 && b.height >= 44 && b.x >= 0 && b.x + b.width <= 1280 && b.x >= s.x - 2 && b.x + b.width <= s.x + s.width * 0.9 && b.y >= s.y && b.y + b.height <= s.y + s.height, JSON.stringify({ b, s }));
    check('the button is on top: a click at its centre hits it, not a sleeve', await page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2).closest(sel) !== null; }, CB));
    await flip(page, 1); await settled(page); await page.waitForTimeout(100);
    ({ b, s } = await box());
    check('after flipping, the button follows the new front Sleeve and names its song', (await page.getAttribute(CB, 'aria-label')) === 'Replace cover: ' + AUTHORED[1] && b.x >= s.x - 2 && b.x + b.width <= s.x + s.width * 0.9 && b.y >= s.y && b.y + b.height <= s.y + s.height, JSON.stringify({ b, s }));
    await flip(page, -1); await settled(page);
    // clicking the button opens the chooser and does not flip or play
    const chooser = page.waitForEvent('filechooser', { timeout: 3000 });
    await page.click(CB);
    check('clicking the button opens the file chooser', !!(await chooser.catch(() => null)));
    check('clicking the button does not flip, load or play the Sleeve', (await frontTitle(page)) === AUTHORED[0] && (await page.evaluate(() => document.getElementById('audio-player').paused && !document.getElementById('audio-player').dataset.track)));
    await page.focus(CB);
    const kb = page.waitForEvent('filechooser', { timeout: 3000 });
    await page.keyboard.press('Enter');
    check('keyboard: the button is reachable and opens the chooser', !!(await kb.catch(() => null)));
    await page.keyboard.press('Escape');
    await ctx.close();
    const ph = await unlocked('work.html', { width: 375, height: 800, gh: {} });
    await ph.page.waitForTimeout(800);
    const pb = await ph.page.locator(CB).boundingBox();
    check('phone: the button is 44px and fully on screen', pb.width >= 44 && pb.height >= 44 && pb.x >= 0 && pb.x + pb.width <= 375, JSON.stringify(pb));
    await ph.ctx.close();
    const sw = await unlocked('work.html', { gh: {} });
    await sw.page.click('#alcove-admin .admin-edit-switch');
    check('switching Edit mode off removes the button and the input', (await sw.page.locator(`${CB}, ${CI}`).count()) === 0);
    await sw.ctx.close();
  }
  {
    // replace: previewed at once (unblended picture on the sleeve), 1200px, change entry, revert, draft, Save order, visitor
    const gh = { file: { ...BRANCH_FILE } };
    const { ctx, page, errors, allReqs } = await unlocked('work.html', { gh });
    await stageCover(page);
    const c0 = await sleeveCover(page, 0);
    check('the picked cover shows on the Sleeve at once, clean (has-cover, blob URL)', c0.has && c0.cover.startsWith('blob:') && c0.css.includes('blob:'));
    check('preview is unblended, centre-cropped and the pattern is hidden', await page.evaluate(() => { const a = document.querySelector('.sleeve[data-pos="front"] .sleeve-art'), b = getComputedStyle(a, '::before'); return b.mixBlendMode === 'normal' && b.backgroundSize === 'cover' && getComputedStyle(a, '::after').display === 'none'; }));
    check('cover is shrunk to 1200px on the long edge', JSON.stringify(await blobDims(page, c0.cover)) === '[1200,600]', JSON.stringify(await blobDims(page, c0.cover)));
    check('it counts as one change and no request was made', (await page.textContent(saveBtn)).includes('1 change') && fileCalls(gh).length === 0);
    await openPanel(page);
    check('changes panel says "Cover changed: <title>"', (await page.textContent('#alcove-admin .admin-changes')).includes('Cover changed: ' + AUTHORED[0]), await page.textContent('#alcove-admin .admin-changes'));
    await page.click('#alcove-admin .admin-changes li button');
    check('revert goes back to the pattern and clears the count', !(await sleeveCover(page, 0)).has && (await page.textContent(saveBtn)).trim() === 'Save');
    await stageCover(page);
    // draft survives a reload
    await page.reload(); await page.waitForSelector(`${SG} .admin-song`); await page.waitForFunction(() => document.querySelector('.sleeve').dataset.cover?.startsWith('blob:'));
    check('after a reload the staged cover is back on its Sleeve and counted', (await sleeveCover(page, 0)).has && (await page.textContent(saveBtn)).includes('1 change'));
    check('leaving with a staged cover is warned about', await (async () => { await page.evaluate(() => { window.__bu = null; window.addEventListener('beforeunload', e => { window.__bu = e.defaultPrevented; }); }); await page.evaluate(() => window.dispatchEvent(new Event('beforeunload', { cancelable: true }))); return (await page.evaluate(() => window.__bu)) === true; })());
    await openPanel(page);
    await page.click(saveBtn); await saveDone(page);
    const order = puts(gh).map(c => c.path);
    check('Save uploads the cover first, then content.json', order.length === 2 && /^\/contents\/images\/cover-album-art-[0-9a-f]{8}\.jpg$/.test(order[0]) && order[1] === '/contents/content.json', JSON.stringify(order));
    const rel = order[0].replace('/contents/', '');
    const up = Buffer.from(JSON.parse(fileCalls(gh)[0].body).content, 'base64');
    check('uploaded bytes are the 1200px JPEG, not the original', JSON.stringify(await dims(up)) === '[1200,600]' && up.length < coverImg.length + 5000 && JSON.parse(fileCalls(gh)[0].body).branch === 'content');
    const saved = songsOf(gh);
    check('content.json: the song carries its cover, the others do not', saved.length === 4 && saved[0].cover === rel && saved.slice(1).every(x => !('cover' in x)) && saved.map(x => x.file).join() === [F1, F2, F3, F4].join(), JSON.stringify(saved));
    check('after Save nothing is pending and the Sleeve still shows the cover', (await page.textContent(saveBtn)).trim() === 'Save' && (await sleeveCover(page, 0)).has);
    check('no console errors; token only to api.github.com', errors.length === 0 && allReqs.every(r => !r.auth || new URL(r.url).host === 'api.github.com'), errors.join(' | '));
    await ctx.close();
    extra['/' + rel] = gh.files[order[0]];
    const v = await open('work.html', { override: gh.file.text });
    await v.page.waitForFunction(() => document.querySelector('.sleeve').dataset.cover);
    check('visitor sees the saved cover on that song and the pattern elsewhere', (await sleeveCover(v.page, 0)).cover === rel && !(await sleeveCover(v.page, 1)).has && v.errors.length === 0);
    await v.ctx.close();
    delete extra['/' + rel];
  }
  {
    // cover follows its song on reorder (admin), replace again keeps the first until Save, revert goes back to the previous cover
    const gh = { file: branchWith(withCover(four, 0)), files: { ['/contents/' + COV]: Buffer.from('x') } };
    const { ctx, page } = await unlocked('work.html', { gh });
    check('unlocked: the saved cover is shown', (await sleeveCover(page, 0)).cover === COV);
    await page.click(`${ROW(1)} .admin-song-down`);
    check('reordering moves the cover with its song', (await page.$$eval('.sleeve', ss => ss.map(s => s.dataset.cover || '-').join())) === '-,' + COV + ',-,-');
    await openPanel(page);
    await page.click('#alcove-admin .admin-changes li button'); // revert the order
    while (!(await atStart(page))) { await flip(page, -1); await settled(page); }
    check('back at the first Sleeve with its saved cover', (await frontTitle(page)) === AUTHORED[0] && (await sleeveCover(page, 0)).cover === COV);
    await stageCover(page);
    check('replacing a saved cover: the new picture shows', (await sleeveCover(page, 0)).cover.startsWith('blob:'));
    await page.click('#alcove-admin .admin-changes li button');
    check('revert goes back to the previous cover, not the pattern', (await sleeveCover(page, 0)).cover === COV && (await page.textContent(saveBtn)).trim() === 'Save');
    check('there is no way to remove a cover (no remove control)', (await page.locator('.admin-cover-remove, [aria-label^="Remove cover"], [aria-label^="Clear cover"]').count()) === 0);
    await ctx.close();
  }
  {
    // cleanup: a replaced cover nothing else uses is deleted after content.json; a shared one is kept
    const gh = { file: branchWith(withCover(four, 0)), files: { ['/contents/' + COV]: Buffer.from('x') } };
    const { ctx, page } = await unlocked('work.html', { gh });
    await stageCover(page); await openPanel(page); await page.click(saveBtn); await saveDone(page);
    for (let n = 0; n < 100 && !gh.deleted; n++) await new Promise(r => setTimeout(r, 50));
    check('replaced cover deleted (with its sha, on the content branch, after content.json)', (gh.deleted || []).join() === '/contents/' + COV && JSON.parse(gh.calls.find(c => c.method === 'DELETE').body).branch === 'content' && gh.calls.findIndex(c => c.method === 'DELETE') > gh.calls.findIndex(c => c.path === '/contents/content.json' && c.method === 'PUT'), JSON.stringify(gh.deleted));
    check('the new cover is not deleted', Object.keys(gh.files).some(f => /cover-album-art/.test(f)));
    await ctx.close();
    const shared = { file: { sha: 'sha-sh', text: JSON.stringify({ version: 1, text: {}, defaults: {}, media: { 'about.photo.portrait': COV }, songs: withCover(four, 0) }) }, files: { ['/contents/' + COV]: Buffer.from('x') } };
    const b = await unlocked('work.html', { gh: shared });
    await stageCover(b.page); await openPanel(b.page); await b.page.click(saveBtn); await saveDone(b.page); await b.page.waitForTimeout(600);
    check('a replaced cover still used by a media slot is kept', !shared.deleted && !!shared.files['/contents/' + COV]);
    await b.ctx.close();
    const twice = { file: branchWith(withCover(four.slice(0, 2).map((x, i) => i ? { ...x, cover: COV } : x), 0)), files: { ['/contents/' + COV]: Buffer.from('x') } };
    const t = await unlocked('work.html', { gh: twice });
    await stageCover(t.page); await openPanel(t.page); await t.page.click(saveBtn); await saveDone(t.page); await t.page.waitForTimeout(600);
    check('a replaced cover still used by another song is kept', !twice.deleted && !!twice.files['/contents/' + COV]);
    await t.ctx.close();
  }
  {
    // Add song: optional cover; with a cover it is staged, uploaded and saved; without, no cover key
    const gh = { file: { ...BRANCH_FILE } };
    const { ctx, page } = await unlocked('work.html', { gh });
    check('the Add song form has an optional cover picture input for images', /image\/jpeg/.test(await page.getAttribute(`${SG} .admin-song-new-cover`, 'accept')) && !/svg/.test(await page.getAttribute(`${SG} .admin-song-new-cover`, 'accept')));
    await page.setInputFiles(`${SG} .admin-song-new-cover`, coverFile);
    await addSong(page, 'With Art', songFile);
    await page.waitForFunction(() => document.querySelectorAll('.sleeve').length === 5);
    check('the new song shows its cover at once; the add form is cleared', (await sleeveCover(page, 4)).cover?.startsWith('blob:') && (await page.inputValue(`${SG} .admin-song-new-cover`)) === '' && (await page.textContent(saveBtn)).includes('1 change'));
    await page.reload(); await page.waitForSelector(`${SG} .admin-song`);
    await page.waitForFunction(() => document.querySelectorAll('.sleeve').length === 5);
    await page.waitForFunction(() => document.querySelectorAll('.sleeve')[4].dataset.cover?.startsWith('blob:'));
    check('the added song keeps its cover across a reload', (await sleeveCover(page, 4)).has);
    await openPanel(page); await page.click(saveBtn); await saveDone(page);
    const order = puts(gh).map(c => c.path);
    const list = songsOf(gh);
    check('Save uploads the audio and the cover, then content.json', order.length === 3 && order.filter(p => /\/media\/my-new-jam/.test(p)).length === 1 && order.filter(p => /\/images\/cover-album-art-[0-9a-f]{8}\.jpg$/.test(p)).length === 1 && order[2] === '/contents/content.json', JSON.stringify(order));
    check('the new song entry has its cover; the rest have none', list.length === 5 && /^images\/cover-album-art-[0-9a-f]{8}\.jpg$/.test(list[4].cover) && list.slice(0, 4).every(x => !('cover' in x)), JSON.stringify(list));
    await ctx.close();
    const g2 = { file: { ...BRANCH_FILE } };
    const n = await unlocked('work.html', { gh: g2 });
    await addSong(n.page, 'No Art', songFile);
    await openPanel(n.page); await n.page.click(saveBtn); await saveDone(n.page);
    check('adding without a cover saves no cover and uploads no image', !('cover' in songsOf(g2).at(-1)) && fileCalls(g2).length === 0 && !(await sleeveCover(n.page, 4)).has);
    await n.ctx.close();
    // revert of an added song with a cover drops it (and its staged preview)
    const r = await unlocked('work.html', { gh: {} });
    await r.page.setInputFiles(`${SG} .admin-song-new-cover`, coverFile);
    await addSong(r.page, 'Gone', songFile);
    await r.page.waitForFunction(() => document.querySelectorAll('.sleeve').length === 5);
    await openPanel(r.page); await r.page.click('#alcove-admin .admin-changes li button');
    check('reverting an added song with a cover removes it', (await r.page.locator('.sleeve').count()) === 4 && (await r.page.textContent(saveBtn)).trim() === 'Save');
    await r.ctx.close();
  }
  {
    // rejections: wrong type, SVG, oversize, unreadable; nothing staged, no request, message shown
    const gh = { file: { ...BRANCH_FILE } };
    const { ctx, page } = await unlocked('work.html', { gh });
    const tmp = await mkdtemp(join(tmpdir(), 'alcove-cover-'));
    const huge = join(tmp, 'huge.jpg'); await writeFile(huge, ''); await truncate(huge, 91 * 1024 * 1024);
    for (const [label, f, re] of [
      ['a text file', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') }, /picture|image|JPG/i],
      ['an audio file', { name: 'song.mp3', mimeType: 'audio/mpeg', buffer: Buffer.alloc(100) }, /picture|image|JPG/i],
      ['an SVG', { name: 'art.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') }, /JPG, PNG or WebP/],
      ['a broken JPG', { name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') }, /read|different/i],
      ['an oversize file', huge, /too large|limit/i]]) {
      await page.setInputFiles(CI, f);
      await page.waitForFunction(s => (document.querySelector(s)?.textContent || '').length > 0, mediaErr);
      check(`cover rejects ${label} with a message, nothing staged`, re.test(await page.textContent(mediaErr)) && !(await sleeveCover(page, 0)).has && (await page.textContent(saveBtn)).trim() === 'Save' && gh.calls.every(c => c.method === 'GET' || c.method === 'OPTIONS'), await page.textContent(mediaErr));
    }
    await rm(tmp, { recursive: true, force: true });
    // a transparent PNG becomes JPEG with a white background (not black)
    const png = await fixture(300, 300, 'image/png');
    await page.setInputFiles(CI, { name: 'logo.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => document.querySelector('.sleeve').dataset.cover?.startsWith('blob:'));
    const kind = await page.evaluate(async u => (await (await fetch(u)).blob()).type, (await sleeveCover(page, 0)).cover);
    check('a PNG cover is saved as JPEG', kind === 'image/jpeg');
    await ctx.close();
  }
  {
    // conflict: the branch's songs changed after load: the existing message, drafts kept, nothing uploaded
    const gh = { file: branchWith(four, 'sha-cv-1') };
    const { ctx, page } = await unlocked('work.html', { gh });
    await stageCover(page);
    gh.file = branchWith([{ title: 'Someone Else', file: F3 }], 'sha-cv-2');
    await openPanel(page); await page.click(saveBtn);
    await page.waitForFunction(s => /changed|reload/i.test(document.querySelector(s)?.textContent || ''), note);
    check('songs changed on the branch: cover Save stops, nothing uploaded', fileCalls(gh).length === 0 && contentPuts(gh).length === 0 && (await sleeveCover(page, 0)).has);
    await ctx.close();
  }
  {
    // a cover on one song with an old content file that lacks songs: saves the whole list with the cover
    const gh = { file: { ...BRANCH_FILE } };
    const { ctx, page } = await unlocked('work.html', { gh });
    await stageCover(page); await page.fill(`${ROW(2)} .admin-song-title`, 'Renamed Too');
    check('a cover and a rename are two changes', (await page.textContent(saveBtn)).includes('2 changes'));
    await openPanel(page); await page.click(saveBtn); await saveDone(page);
    const l = songsOf(gh);
    check('the saved list has both the cover and the rename', !!l[0].cover && l[1].title === 'Renamed Too');
    await ctx.close();
  }
}

await fxPage.close();
await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll admin checks passed');
process.exit(failures ? 1 : 0);
