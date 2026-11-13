// Contact page booking form: validation, Demo upload flow (Apps Script + Drive URLs mocked), status states. No Google calls.
// Run: node tests/booking-check.mjs   (needs `npx playwright install chromium` once)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    const body = await readFile(join(root, path === '/' ? 'index.html' : decodeURIComponent(path)));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const FAKE = 'https://booking.test/exec';
const DRIVE = 'https://drive.test/**';
const cors = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
const MB = 1024 * 1024;

const browser = await chromium.launch();
let failures = 0;
const errors = [];
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
};

// Opens a fresh contact page; `live` swaps the placeholder action for a mockable URL.
// Default handler plays Apps Script (startUpload / submitInquiry); drive() plays the Drive resumable session.
// `events` is the ordered log of everything that left the browser.
async function open({ live = true, handler, drive, viewport = { width: 1280, height: 900 } } = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  // The browser logs deliberate mocked 500/abort responses as "Failed to load resource"; those are expected.
  page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  page.on('pageerror', e => errors.push(e.message));
  await ctx.addInitScript(() => { window.__bookingRetryDelays = [20, 20, 20]; }); // keep backoff short in tests
  const requests = [], events = [], puts = [], bodies = [], acked = {};
  await page.route(FAKE, async route => {
    const req = route.request();
    requests.push(req);
    const body = JSON.parse(req.postData() || '{}');
    bodies.push(body);
    events.push(body.action);
    if (handler) return handler(route, body);
    if (body.action === 'startUpload') {
      const uploads = body.files.map((f, i) => ({ name: f.name, uploadUrl: `https://drive.test/up/${i}` }));
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ ok: true, inquiryId: 'inq-1', uploads }) });
    }
    await route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ ok: true }) });
  });
  await page.route(DRIVE, async route => {
    const req = route.request();
    const dh = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'PUT, OPTIONS', 'access-control-expose-headers': 'Range' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: dh });
    const idx = Number(new URL(req.url()).pathname.split('/').pop());
    const q = /bytes \*\/(\d+)/.exec(req.headers()['content-range'] || '');
    if (q) { // offset query: Drive reports how much it has
      events.push(`QUERY ${idx}`);
      if (drive) { const r = await drive(route, { idx, query: true, total: +q[1] }, dh); if (r !== 'default') return r; }
      return route.fulfill({ status: 308, headers: acked[idx] ? { ...dh, Range: `bytes=0-${acked[idx] - 1}` } : dh });
    }
    const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(req.headers()['content-range'] || '');
    const rec = { idx, start: +m[1], end: +m[2], total: +m[3], len: (req.postDataBuffer() || Buffer.alloc(0)).length };
    puts.push(rec);
    events.push(`PUT ${idx} ${m[0]}`);
    if (drive) { const r = await drive(route, rec, dh); if (r !== 'default') return r; }
    if (rec.end + 1 < rec.total) { acked[idx] = rec.end + 1; return route.fulfill({ status: 308, headers: { ...dh, Range: `bytes=0-${rec.end}` } }); }
    await route.fulfill({ status: 200, headers: { ...dh, 'content-type': 'application/json' }, body: JSON.stringify({ id: `file${idx}` }) });
  });
  await page.goto(`${base}/contact.html`);
  // Never let a test reach the real deployment: the action is always the mock URL or the not-connected placeholder.
  await page.evaluate(u => { document.getElementById('booking-form').action = u; }, live ? FAKE : 'https://script.google.com/macros/s/REPLACE_WITH_DEPLOYMENT_ID/exec');
  return { ctx, page, requests, events, puts, bodies, acked };
}
// Adds files the way the file picker does; `fake` overrides the reported size (for the 250MB cap) without allocating it.
const attach = (page, specs) => page.evaluate(list => {
  const dt = new DataTransfer();
  for (const { name, type, size, fake } of list) {
    const f = new File([new Uint8Array(size)], name, { type });
    if (fake) Object.defineProperty(f, 'size', { value: fake });
    dt.items.add(f);
  }
  const input = document.getElementById('demo-input');
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}, specs);
const memo = (name = 'voice-memo.m4a', size = 3000) => ({ name, type: 'audio/mp4', size });
const demoErr = page => page.locator('#demo-error').textContent();
const fill = async page => {
  await page.fill('#contact-name', 'Sam Rivera');
  await page.fill('#artist-name', 'The Test Band');
  await page.fill('#artist-email', 'band@example.com');
  await page.selectOption('#exp-level', 'first-time');
  await page.fill('#artist-phone', '+1 (555) 123-4567');
  await page.selectOption('#session-type', 'Songwriting');
  await page.fill('#anything-else', 'Two songs, acoustic.');
};
const statusText = page => page.locator('#booking-status').textContent();
const btn = page => page.locator('#booking-form button[type="submit"]');

// 1. empty submit
{
  const { ctx, page, requests } = await open();
  await btn(page).click();
  await page.waitForTimeout(200);
  const vis = await Promise.all(['contact-name', 'email', 'phone', 'exp', 'session'].map(k => page.locator(`#${k}-error`).isVisible()));
  const linked = (await page.locator('#contact-name').getAttribute('aria-describedby')).includes('contact-name-error')
    && (await page.locator('#contact-name').getAttribute('aria-invalid')) === 'true';
  check('empty submit shows required-field errors', vis.every(Boolean), JSON.stringify(vis));
  check('artist/band name is optional', !(await page.locator('#artist-name').evaluate(el => el.required)));
  check('invalid field links its error via aria-describedby/aria-invalid', linked);
  check('empty submit sends nothing', requests.length === 0);
  check('no Demo shows a worded, visible error', (await demoErr(page)).includes('Add at least one Demo') && await page.locator('#demo-error').isVisible());
  await ctx.close();
}

// 1b. phone validation
{
  const { ctx, page, requests } = await open();
  await fill(page);
  await page.fill('#artist-phone', '555-1234');
  await btn(page).click();
  await page.waitForTimeout(200);
  check('short phone is flagged with worded message', !(await page.locator('#artist-phone').evaluate(el => el.validity.valid))
    && (await page.locator('#artist-phone').evaluate(el => el.validationMessage)).includes('10 digits')
    && await page.locator('#phone-error').isVisible());
  check('short phone sends nothing', requests.length === 0);
  await page.fill('#artist-phone', '+1 (555) 123-4567');
  check('"+1 (555) 123-4567" is a valid phone', await page.locator('#artist-phone').evaluate(el => el.validity.valid));
  const phoneOk = async v => { await page.fill('#artist-phone', v); return page.locator('#artist-phone').evaluate(el => el.validity.valid); };
  const good = ['555-123-4567', '(555) 123 4567', '5551234567', '1 555 123 4567', '+15551234567'];
  const bad = ['+44 20 7946 0958', '+45 12 34 56 78', '+61 412 345 678', '055 123 4567', '155 123 4567', '555 123 45678', '2 555 123 4567', '+555 123 4567'];
  const goodRes = [], badRes = [];
  for (const v of good) goodRes.push(await phoneOk(v));
  for (const v of bad) badRes.push(await phoneOk(v));
  check('US phone formats are accepted', goodRes.every(Boolean), JSON.stringify(goodRes));
  check('non-US and malformed phones are refused', badRes.every(r => !r), JSON.stringify(badRes));
  await page.fill('#artist-phone', '+44 20 7946 0958');
  await btn(page).click();
  await page.waitForTimeout(200);
  check('non-US phone sends nothing and says US', requests.length === 0 && (await page.locator('#artist-phone').evaluate(el => el.validationMessage)).includes('US phone number'));
  await page.fill('#artist-phone', '+1 (555) 123-4567');
  // auto-format while typing
  const typed = async keys => { await page.fill('#artist-phone', ''); await page.locator('#artist-phone').pressSequentially(keys); return page.inputValue('#artist-phone'); };
  const f1 = await typed('5551234567'), f2 = await typed('15551234567'), f3 = await typed('555'), f4 = await typed('55512'), f5 = await typed('+44 20 7946 0958');
  check('phone formats as typed', f1 === '(555) 123-4567' && f2 === '+1 (555) 123-4567' && f3 === '(555' && f4 === '(555) 12' && f5 === '+44 20 7946 0958', JSON.stringify([f1, f2, f3, f4, f5]));
  check('formatted phone is valid', (await typed('5551234567')) && await page.locator('#artist-phone').evaluate(el => el.validity.valid));
  for (let i = 0; i < 14; i++) await page.keyboard.press('Backspace');
  check('backspace clears a formatted phone without getting stuck', (await page.inputValue('#artist-phone')) === '');
  await typed('5551234567');
  await page.locator('#artist-phone').evaluate(el => el.setSelectionRange(4, 4)); // after "(555"
  await page.keyboard.press('Backspace');
  await page.keyboard.type('9');
  const mid = await page.locator('#artist-phone').evaluate(el => [el.value, el.selectionStart]);
  check('editing in the middle keeps the caret in place', mid[0] === '(559) 123-4567' && mid[1] === 4, JSON.stringify(mid));
  await page.fill('#artist-phone', '555.123.4567');
  check('a pasted number is formatted', (await page.inputValue('#artist-phone')) === '(555) 123-4567');
  const attrs = await page.locator('#artist-phone').evaluate(el => [el.type, el.autocomplete, el.inputMode]);
  check('phone is tel/autocomplete/inputmode', attrs.join() === 'tel,tel,tel', attrs.join());
  await ctx.close();
}

// 2. valid submit: request order, chunk headers, payload, progress, disabled button, reset
{
  const SIZE = 17 * MB + 5; // 3 chunks: 8MB, 8MB, remainder
  let atSubmit;
  const { ctx, page, requests, events, puts, bodies } = await open({
    handler: async (route, body) => {
      if (body.action === 'startUpload') {
        const uploads = body.files.map((f, i) => ({ name: f.name, uploadUrl: `https://drive.test/up/${i}` }));
        return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ ok: true, inquiryId: 'inq-1', uploads }) });
      }
      atSubmit = {
        disabled: await btn(page).isDisabled(),
        progress: await page.locator('#demo-progress').evaluate(p => p.value),
        status: await page.locator('#booking-status').textContent(),
      };
      await route.fulfill({ status: 200, headers: cors, body: '{"ok":true}' });
    },
  });
  await fill(page);
  await attach(page, [{ name: 'live-take.mov', type: 'video/quicktime', size: SIZE }, memo()]);
  const listed = await page.locator('#demo-list li').allTextContents();
  check('file list shows name and size', listed.length === 2 && listed[0].includes('live-take.mov') && listed[0].includes('17.0 MB') && listed[1].includes('voice-memo.m4a') && listed[1].includes('3 KB'), listed.join('|'));
  await btn(page).click();
  await page.locator('#booking-status[data-state="success"]').waitFor();
  const [start, submit] = [bodies[0], bodies[bodies.length - 1]];
  check('request order: startUpload, PUTs, submitInquiry', events[0] === 'startUpload' && events.at(-1) === 'submitInquiry' && events.slice(1, -1).every(e => e.startsWith('PUT')) && requests.length === 2, events.join(' | '));
  check('startUpload carries honeypot and file metadata', start.website === '' && JSON.stringify(start.files) === JSON.stringify([{ name: 'live-take.mov', type: 'video/quicktime', size: SIZE }, { name: 'voice-memo.m4a', type: 'audio/mp4', size: 3000 }]), JSON.stringify(start));
  check('startUpload is text/plain', /^text\/plain/.test(requests[0].headers()['content-type'] || ''));
  const want = [[0, 8 * MB - 1], [8 * MB, 16 * MB - 1], [16 * MB, SIZE - 1]].map(([a, b]) => `bytes ${a}-${b}/${SIZE}`);
  const got = events.filter(e => e.startsWith('PUT 0')).map(e => e.slice(6));
  check('chunk Content-Range headers (8MB chunks) for file 0', JSON.stringify(got) === JSON.stringify(want), got.join(' | '));
  check('chunk sizes are multiples of 256KB except the last', puts.filter(p => p.idx === 0).slice(0, -1).every(p => p.len % (256 * 1024) === 0) && puts.filter(p => p.idx === 0).reduce((n, p) => n + p.len, 0) === SIZE);
  check('file 1 goes up in one PUT after file 0', events.at(-2) === 'PUT 1 bytes 0-2999/3000');
  check('submitInquiry payload: inquiryId, fields, Drive file ids', submit.action === 'submitInquiry' && submit.inquiryId === 'inq-1' && JSON.stringify(submit.fileIds) === '["file0","file1"]'
    && submit.contactName === 'Sam Rivera' && submit.artistName === 'The Test Band' && submit.artistEmail === 'band@example.com' && submit.artistPhone === '+1 (555) 123-4567'
    && submit.experienceLevel === 'first-time' && submit.sessionType === 'Songwriting' && submit.anythingElse.startsWith('Two songs') && submit.website === '', JSON.stringify(submit));
  check('button disabled, progress 100 and "Sending" when the Inquiry is posted', atSubmit && atSubmit.disabled && atSubmit.progress === 100 && atSubmit.status.includes('Sending'), JSON.stringify(atSubmit));
  check('success message shown', (await statusText(page)).includes('24–48 hours'));
  check('form reset after success incl. file list and progress', (await page.inputValue('#artist-name')) === '' && (await page.locator('#demo-list li').count()) === 0 && !(await page.locator('#demo-progress').isVisible()));
  check('button re-enabled after success', await btn(page).isEnabled());
  await ctx.close();
}

// 2b. button stays disabled and progress is announced while uploading
{
  let release;
  const gate = new Promise(r => { release = r; });
  const { ctx, page } = await open({ drive: async (route, rec) => { await gate; return 'default'; } });
  await fill(page);
  await attach(page, [memo()]);
  await btn(page).click();
  await page.locator('#booking-status[data-state="pending"]').waitFor();
  await page.waitForFunction(() => document.getElementById('booking-status').textContent.includes('Uploading'));
  check('button disabled, says Sending, progress visible while uploading', (await btn(page).isDisabled()) && (await btn(page).textContent()).includes('Sending') && await page.locator('#demo-progress').isVisible());
  check('status line is a live region', (await page.locator('#booking-status').getAttribute('role')) === 'status');
  check('remove and Browse are disabled while uploading', await page.locator('#demo-browse').isDisabled() && await page.locator('.demo-remove').first().isDisabled());
  release();
  await page.locator('#booking-status[data-state="success"]').waitFor();
  check('status focused after send', await page.evaluate(() => document.activeElement.id === 'booking-status'));
  await ctx.close();
}

// 3. Demo validation: type, size, 4th file, remove, drag-and-drop
{
  const { ctx, page, requests } = await open();
  await fill(page);
  await attach(page, [{ name: 'notes.pdf', type: 'application/pdf', size: 500 }]);
  check('wrong type is refused with a message', (await demoErr(page)).includes('notes.pdf') && (await demoErr(page)).includes('supported') && (await page.locator('#demo-list li').count()) === 0);
  await attach(page, [{ name: 'huge.mp4', type: 'video/mp4', size: 10, fake: 251 * MB }]);
  check('file over 250MB is refused with a message', (await demoErr(page)).includes('over 250MB') && (await page.locator('#demo-list li').count()) === 0);
  await attach(page, [{ name: 'exactly.mp4', type: 'video/mp4', size: 10, fake: 250 * MB }]);
  check('exactly 250MB is accepted', (await page.locator('#demo-list li').count()) === 1 && !(await page.locator('#demo-error').isVisible()));
  await attach(page, [memo('a.mp3'), memo('b.wav'), memo('c.ogg')]);
  check('a 4th file is refused with a message', (await page.locator('#demo-list li').count()) === 3 && (await demoErr(page)).includes('up to 3'));
  const rm = page.locator('.demo-remove').nth(1);
  check('remove buttons are keyboard-reachable named buttons', (await rm.getAttribute('aria-label')) === 'Remove a.mp3');
  await rm.focus();
  await page.keyboard.press('Enter');
  check('removing a file works and clears the error', (await page.locator('#demo-list li').count()) === 2 && !(await page.locator('#demo-error').isVisible()));
  check('after remove, focus returns to Browse Files', await page.evaluate(() => document.activeElement.id === 'demo-browse'));
  while (await page.locator('.demo-remove').count()) await page.locator('.demo-remove').first().click();
  await btn(page).click();
  check('removing all Demos blocks sending', (await demoErr(page)).includes('Add at least one Demo') && requests.length === 0);
  // drag and drop adds files and shows the drag-over state
  await page.evaluate(() => {
    const drop = document.getElementById('demo-drop');
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(900)], 'dropped.wav', { type: 'audio/wav' }));
    drop.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    window.__over = drop.classList.contains('is-dragover');
    drop.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  check('drag-over state shown, drop adds the file', (await page.evaluate(() => window.__over)) && (await page.locator('#demo-list li').allTextContents()).join().includes('dropped.wav') && !(await page.locator('#demo-drop').evaluate(el => el.classList.contains('is-dragover'))));
  check('Browse Files and file input accept audio and video', (await page.locator('#demo-input').getAttribute('accept')).includes('.mov') && (await page.locator('#demo-browse').textContent()).includes('Browse Files'));
  check('Demo note is visible', (await page.locator('#demo-hint').textContent()).includes('250MB each. A phone voice memo is perfect.'));
  await ctx.close();
}

// 5. failures: startUpload bad, Drive failing, submitInquiry failing; fields kept, button back
const apps = (fn) => async (route, body) => body.action === 'startUpload'
  ? route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ ok: true, inquiryId: 'inq-1', uploads: body.files.map((f, i) => ({ name: f.name, uploadUrl: `https://drive.test/up/${i}` })) }) })
  : fn(route);
const failCases = {
  '{ok:false} on startUpload': { handler: route => route.fulfill({ status: 200, headers: cors, body: '{"ok":false,"error":"x"}' }), upload: true, fresh: true },
  'HTTP 500 on startUpload': { handler: route => route.fulfill({ status: 500, headers: cors, body: 'boom' }), upload: true, fresh: true },
  'Drive PUT failing': { drive: route => route.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*' }, body: 'no' }), upload: true },
  '{ok:false} on submitInquiry': { handler: apps(route => route.fulfill({ status: 200, headers: cors, body: '{"ok":false,"error":"x"}' })) },
  'HTTP 500 on submitInquiry': { handler: apps(route => route.fulfill({ status: 500, headers: cors, body: 'boom' })) },
  'network abort on submitInquiry': { handler: apps(route => route.abort()) },
};
for (const [label, c] of Object.entries(failCases)) {
  const { ctx, page } = await open({ handler: c.handler, drive: c.drive });
  await fill(page);
  await attach(page, [memo()]);
  await btn(page).click();
  await page.locator('#booking-status[data-state="error"]').waitFor();
  check(`${label} shows error and re-enables button`, (await statusText(page)).includes(c.upload ? "didn't finish uploading" : 'Something went wrong') && (await btn(page).isEnabled()) && (await btn(page).textContent()).includes(c.fresh ? 'Send Message' : 'Try again'));
  check(`${label} keeps entered values and Demo`, (await page.inputValue('#artist-name')) === 'The Test Band' && (await page.locator('#demo-list li').count()) === 1);
  await ctx.close();
}

// 5b. resilient uploads: resume after a mid-upload abort, retries running out then Try again, failed submit then Try again
{
  const SIZE = 17 * MB + 5; // chunks: 0-8MB, 8-16MB, remainder
  // abort the second chunk once; the page must ask Drive for the offset and continue from 8MB without resending chunk one
  let aborted = false;
  const { ctx, page, events, bodies } = await open({
    drive: async (route, rec) => {
      if (!rec.query && rec.start === 8 * MB && !aborted) { aborted = true; return route.abort(); }
      return 'default';
    },
  });
  await fill(page);
  await attach(page, [{ name: 'live-take.mov', type: 'video/quicktime', size: SIZE }]);
  await btn(page).click();
  await page.locator('#booking-status[data-state="success"]').waitFor();
  const chunk0 = events.filter(e => e === `PUT 0 bytes 0-${8 * MB - 1}/${SIZE}`).length;
  const mid = events.indexOf('QUERY 0');
  check('mid-upload abort: offset query then resume from the reported byte', mid > 0 && events[mid + 1] === `PUT 0 bytes ${8 * MB}-${16 * MB - 1}/${SIZE}`, events.join(' | '));
  check('mid-upload abort: earlier chunk is not re-sent', chunk0 === 1);
  check('mid-upload abort: only one startUpload and one submitInquiry', bodies.filter(b => b.action === 'startUpload').length === 1 && bodies.filter(b => b.action === 'submitInquiry').length === 1);
  await ctx.close();
}
{
  // Drive down for a while: retries run out, Try again resumes on the same sessions and finishes
  let down = true;
  const { ctx, page, events, bodies } = await open({
    drive: async (route) => (down ? route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: 'down' }) : 'default'),
  });
  await fill(page);
  await attach(page, [memo()]);
  await btn(page).click();
  await page.locator('#booking-status[data-state="error"]').waitFor();
  check('retries run out: error, fields and file list intact, button says Try again', (await statusText(page)).includes('Try again') && (await btn(page).textContent()).includes('Try again')
    && (await btn(page).isEnabled()) && (await page.inputValue('#artist-name')) === 'The Test Band' && (await page.locator('#demo-list li').count()) === 1);
  check('retries run out: file list is locked while waiting on Try again', await page.locator('.demo-remove').first().isDisabled() && await page.locator('#demo-browse').isDisabled());
  const putsBefore = events.filter(e => e.startsWith('PUT')).length;
  check('retries: first PUT, then 3 backoff retries (each an offset query) before giving up', putsBefore === 1 && events.filter(e => e === 'QUERY 0').length === 3, events.join(' | '));
  down = false;
  await btn(page).click();
  await page.locator('#booking-status[data-state="success"]').waitFor();
  check('Try again reuses the same sessions (no second startUpload) and completes', bodies.filter(b => b.action === 'startUpload').length === 1 && bodies.at(-1).action === 'submitInquiry' && bodies.at(-1).fileIds[0] === 'file0');
  check('after Try again succeeds the button is back to Send Message', (await btn(page).textContent()).includes('Send Message') && (await page.locator('#demo-list li').count()) === 0);
  await ctx.close();
}
{
  // submitInquiry fails once: Try again only re-sends the Inquiry, nothing is re-uploaded
  let fail = true;
  const { ctx, page, events, bodies } = await open({
    handler: apps(async route => {
      if (fail) { fail = false; return route.fulfill({ status: 500, headers: cors, body: 'boom' }); }
      return route.fulfill({ status: 200, headers: cors, body: '{"ok":true}' });
    }),
  });
  await fill(page);
  await attach(page, [memo()]);
  await btn(page).click();
  await page.locator('#booking-status[data-state="error"]').waitFor();
  const puts1 = events.filter(e => e.startsWith('PUT')).length;
  await page.fill('#anything-else', 'Edited after the error.');
  await btn(page).click();
  await page.locator('#booking-status[data-state="success"]').waitFor();
  check('failed submit: Try again re-sends the Inquiry only', events.filter(e => e.startsWith('PUT')).length === puts1 && bodies.filter(b => b.action === 'startUpload').length === 1 && bodies.filter(b => b.action === 'submitInquiry').length === 2);
  check('failed submit: edits made before Try again are sent', bodies.at(-1).anythingElse === 'Edited after the error.' && bodies.at(-1).fileIds[0] === 'file0');
  await ctx.close();
}
{
  // beforeunload warns only while uploading or sending
  let release;
  const gate = new Promise(r => { release = r; });
  const { ctx, page } = await open({ drive: async () => { await gate; return 'default'; } });
  const probe = () => page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  await fill(page);
  await attach(page, [memo()]);
  check('no unload warning while idle', !(await probe()));
  await btn(page).click();
  await page.waitForFunction(() => document.getElementById('booking-status').textContent.includes('Uploading'));
  check('unload warning while uploading', await probe());
  release();
  await page.locator('#booking-status[data-state="success"]').waitFor();
  check('no unload warning after sending', !(await probe()));
  await ctx.close();
}

// 5c. on-the-spot recordings: small Demos are copied into memory when added (stale size, unreadable temp file)
{
  const { ctx, page, bodies, puts } = await open();
  await fill(page);
  await attach(page, [{ name: 'recording.m4a', type: 'audio/mp4', size: 3000, fake: 5000 }]); // the picker reports a stale size
  await btn(page).click();
  await page.locator('#booking-status[data-state="success"]').waitFor();
  check('stale reported size: the real byte count is declared and sent', bodies[0].files[0].size === 3000 && puts.length === 1 && puts[0].len === 3000 && puts[0].total === 3000, JSON.stringify([bodies[0].files, puts]));
  await ctx.close();
}
{
  const { ctx, page, requests } = await open();
  await fill(page);
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(3000)], 'gone.m4a', { type: 'audio/mp4' }));
    File.prototype.arrayBuffer = () => Promise.reject(new DOMException('gone', 'NotReadableError'));
    const input = document.getElementById('demo-input');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('#demo-error:not([hidden])').waitFor();
  check('unreadable recording is removed with a worded message', (await demoErr(page)).includes("gone.m4a couldn't be read") && (await page.locator('#demo-list li').count()) === 0);
  await btn(page).click();
  await page.waitForTimeout(200);
  check('unreadable recording sends nothing', requests.length === 0);
  await ctx.close();
}
{
  const { ctx, page } = await open({ drive: route => route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: 'no' }) });
  await page.goto(page.url() + '?debug');
  await page.evaluate(u => { document.getElementById('booking-form').action = u; }, FAKE);
  await fill(page);
  await attach(page, [memo()]);
  await btn(page).click();
  await page.locator('#booking-status[data-state="error"]').waitFor();
  check('?debug adds the technical reason to the error', (await statusText(page)).includes('[upload: Upload failed (404)]'), await statusText(page));
  await ctx.close();
}

// 5d. Android: the picker is asked for a generic type only, so Chrome offers Files without Camera / Recorder
{
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36' });
  const page = await ctx.newPage();
  await page.goto(`${base}/contact.html`);
  check('Android asks for a generic type only (Files picker, no capture options)', (await page.locator('#demo-input').getAttribute('accept')) === 'application/octet-stream');
  await attach(page, [memo(), { name: 'notes.pdf', type: 'application/pdf', size: 500 }]);
  check('Android still accepts audio and refuses other types in the page', (await page.locator('#demo-list li').count()) === 1 && (await demoErr(page)).includes('notes.pdf'));
  await ctx.close();
}

// 6. placeholder endpoint
{
  const { ctx, page, requests, events } = await open({ live: false });
  await fill(page);
  await attach(page, [memo()]);
  await btn(page).click();
  await page.locator('#booking-status[data-state="error"]').waitFor();
  check('placeholder action shows not-connected message', (await statusText(page)).includes("isn't connected"));
  check('placeholder action sends no request', requests.length === 0 && events.length === 0);
  await ctx.close();
}

// 6b. layout at phone / tablet / desktop: no overflow, no console errors, with long names, files and errors showing
for (const [name, [w, h]] of Object.entries({ phone: [375, 812], tablet: [768, 1024], desktop: [1280, 800] })) {
  const { ctx, page } = await open({ viewport: { width: w, height: h } });
  await btn(page).click(); // empty-submit errors
  await attach(page, [memo('a-very-long-voice-memo-file-name-from-my-phone-recording-number-twelve-final-v2.m4a'), memo('b.mp3'), memo('c.wav'), memo('d.ogg')]);
  await page.evaluate(() => { const p = document.getElementById('demo-progress'); p.hidden = false; p.value = 40; });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const box = await page.locator('#demo-drop').boundingBox();
  check(`Contact with Demo field has no horizontal overflow @ ${name}`, over <= 0 && box.x >= 0 && box.x + box.width <= w, `overflow=${over}`);
  await ctx.close();
}

// 7. no-JS: form hidden, noscript notice links to Direct Channels
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(`${base}/contact.html`);
  check('no-JS hides the form', !(await page.locator('#booking-form').isVisible()));
  check('no-JS shows notice linking to Direct Channels', await page.locator('a[href="#direct-channels"]').isVisible() && (await page.locator('#direct-channels').count()) === 1);
  await ctx.close();
}
{
  const { ctx, page } = await open({ live: false });
  check('JS on shows the form', await page.locator('#booking-form').isVisible());
  await ctx.close();
}

check('no console errors', errors.length === 0, errors.join('; '));
await browser.close(); server.close();
process.exit(failures ? 1 : 0);
