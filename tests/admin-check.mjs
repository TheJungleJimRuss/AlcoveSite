// Admin mode tickets 01-05 (loader, unlock + editing, Save to the content branch, Site Defaults panel; api.github.com always mocked). Saved Site Content / Site Defaults apply before first paint, bad files fall back
// silently, the public theme toolbar is hidden, and booking-form copy is not editable. Page-level only; no network beyond localhost.
// Run: node tests/admin-check.mjs   (needs `npx playwright install chromium` once)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
// `content` overrides /content.json: undefined = serve the committed file, null = 404, string = body as-is.
let content;
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    if (path === '/content.json' && content !== undefined) {
      if (content === null) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(content);
    }
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
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type,accept,x-github-api-version', 'access-control-allow-methods': 'GET,PUT,POST,OPTIONS' };
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
async function open(path, { override, probe, reducedMotion, token, width = 1280, height = 900, gh = {} } = {}) {
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
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', e => errors.push(e.message));
  if (probe) await page.addInitScript(probe);
  await page.goto(`${base}/${path}`);
  return { ctx, page, errors, requests, allReqs, gh };
}
const pages = ['index.html', 'work.html', 'about.html', 'contact.html'];

// --- Slice 1: text keys on every page; booking form copy has none -------------------------------------------
for (const p of pages) {
  const { ctx, page } = await open(p);
  const keyed = await page.$$eval('[data-edit-key]', els => els.map(e => ({ tag: e.tagName, key: e.dataset.editKey, kids: e.children.length })));
  const tags = new Set(keyed.map(k => k.tag));
  check(`${p}: headings, paragraphs have text keys`, tags.has('H2') && tags.has('P'), JSON.stringify([...tags]));
  // admin.js tracks one element per key (one draft per key), so a repeated key would edit and revert inconsistently.
  check(`${p}: keys are unique`, new Set(keyed.map(k => k.key)).size === keyed.length, JSON.stringify(keyed.map(k => k.key).filter((k, i, a) => a.indexOf(k) !== i)));
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
const saved = JSON.stringify({ version: 1, text: { 'work.h1.listen-in': H1_NEW, 'work.h2.recent-recordings': '<b>Fresh</b> takes' }, defaults: { palette: 'seth-sage-coral-dark', gradient: 'flat', texture: 'off', surface: 'metal-subtle' } });
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
  const d = await page.evaluate(() => ({ g: document.documentElement.dataset.gradient, t: document.documentElement.dataset.texture, s: document.documentElement.dataset.surface, sc: document.documentElement.dataset.scheme }));
  check('saved defaults set theme data-attributes', d.g === 'flat' && d.t === 'off' && d.s === 'metal-subtle' && d.sc === 'dark', JSON.stringify(d));
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
  await page.reload();
  await page.waitForTimeout(300);
  check('after sign-out the page is a visitor page again', (await page.locator('#alcove-admin').count()) === 0 && (await page.locator('#theme-dock').count()) === 0);
  await ctx.close();
}

// --- Ticket 02: edit text in place ---------------------------------------------------------------------------
const H1SEL = 'h1[data-edit-key="work.h1.listen-in"]';
const unlocked = async (path, opts = {}) => {
  const o = await open(path, { token: TOKEN, ...opts });
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
  check('success message says changes go live after the developer merges', (await page.textContent(note)).includes('Saved to the content branch. Changes go live after the developer merges to main.'));
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
const optNames = ['palette', 'font', 'texture', 'surface', 'gradient', 'heroGrain'];
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
  check('panel lists exactly the six existing toolbar options (palette, font, texture, surface, gradient, hero grain)', optNames.every(n => lists[n]) && Object.keys(lists).length === 6, JSON.stringify(Object.keys(lists)));
  check('each option offers the toolbar\'s choices (shared definitions)', optNames.every(n => JSON.stringify(lists[n].got) === JSON.stringify(lists[n].want)));
  check('no Tape or Cards option', (await page.locator('#alcove-admin select[name="tape"], #alcove-admin select[name="cards"]').count()) === 0);
  check('current saved default is selected (palette from the branch file, others built-in)', lists.palette.value === 'seth-sage-coral' && lists.gradient.value === 'full' && lists.texture.value === 'quiet' && lists.surface.value === 'metal' && lists.font.value === 'retro-display' && lists.heroGrain.value === 'off', JSON.stringify(lists));
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
  await page.selectOption(sel('texture'), 'bold');
  check('count adds text and defaults changes', (await page.textContent(saveBtn)).includes('3 changes'), await page.textContent(saveBtn));
  await page.click(saveBtn);
  await page.waitForFunction(s => /Saved/.test(document.querySelector(s)?.textContent || ''), note);
  const put = puts(gh);
  const body = JSON.parse(put[0].body);
  const file = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
  check('one PUT to the content branch with the sha just read', put.length === 1 && body.branch === 'content' && body.sha === 'sha-branch-1');
  check('PUT carries defaults under "defaults", changed options only, over the existing ones', JSON.stringify(file.defaults) === JSON.stringify({ palette: 'seth-olive-orange-dark', texture: 'bold' }), JSON.stringify(file.defaults));
  check('PUT carries the text edit too', file.text['work.h1.listen-in'] === 'Hello There' && file.text['work.h2.recent-recordings'] === 'Kept from branch');
  check('after save: count 0, defaults draft cleared, preview kept', (await page.textContent('#alcove-admin .admin-toggle')).includes('0') && (await defaultsDraft(page)) === null && (await scheme(page)) === 'dark' && await page.locator('#alcove-admin .admin-defaults-revert').isDisabled());
  await page.selectOption(sel('palette'), 'seth-sage-coral');
  await page.click('#alcove-admin .admin-defaults-revert');
  check('after save, Revert to saved goes to the newly saved palette', (await page.inputValue(sel('palette'))) === 'seth-olive-orange-dark' && (await scheme(page)) === 'dark');
  await page.reload();
  await page.waitForSelector('#alcove-admin');
  await openPanel(page);
  check('editor reload applies the saved defaults and shows them selected', (await scheme(page)) === 'dark' && (await page.inputValue(sel('texture'))) === 'bold' && (await page.evaluate(() => document.documentElement.dataset.texture)) === 'bold');
  await ctx.close();
  // A visitor loading the committed file gets the same defaults, applied before first paint, with no toolbar or admin UI.
  const v = await open('work.html', { override: gh.file.text, probe: () => { window.__dark = []; const t = () => { const h = document.documentElement; if (document.body && h.dataset.scheme && h.dataset.scheme !== 'dark') window.__dark.push(h.dataset.scheme); requestAnimationFrame(t); }; requestAnimationFrame(t); } });
  await v.page.waitForTimeout(300);
  check('visitor: saved defaults applied, never shown the old palette', (await scheme(v.page)) === 'dark' && (await v.page.evaluate(() => document.documentElement.dataset.texture)) === 'bold' && (await v.page.evaluate(() => window.__dark)).length === 0);
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
  check('phone: six selects, each a 44px tap target', g.n === 6 && g.minSel >= 44, JSON.stringify(g));
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
  check('panel is a labelled region, two status messages, defaults in a fieldset, every select labelled', s.tag === 'ASIDE' && !!s.label && s.status === 2 && s.legend && s.unlabelled === 0, JSON.stringify(s));
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

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll admin checks passed');
process.exit(failures ? 1 : 0);
