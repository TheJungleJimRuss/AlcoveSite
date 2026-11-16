// MANUAL live check (not in `npm run check`): sends ONE real Inquiry with a 9MB test Demo through the deployed Apps Script.
// It emails the notify address, adds a Sheet row and puts a file in Drive. Run: node tests/live-inquiry.mjs
// Options: MB=120 sets the Demo size. --orphan uploads a tiny Demo and never sends the Inquiry, to check cleanStaging.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE_MB = Number(process.env.MB || 9);
const root = join(fileURLToPath(import.meta.url), '..', '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(await readFile(join(root, decodeURIComponent(path))));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
if (process.argv.includes('--orphan')) {
  const html = await readFile(join(root, 'contact.html'), 'utf8');
  const endpoint = /action="(https:\/\/script\.google\.com[^"]+)"/.exec(html)[1];
  const bytes = new TextEncoder().encode('orphan test');
  const name = `orphan-test-${new Date().toISOString().slice(0, 16).replace(':', '')}.m4a`;
  const start = await (await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'startUpload', website: '', origin: 'http://localhost', files: [{ name, type: 'audio/mp4', size: bytes.length }] }) })).json();
  const put = await fetch(start.uploads[0].uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes 0-${bytes.length - 1}/${bytes.length}` }, body: bytes });
  console.log('ORPHAN', name, 'startUpload ok:', start.ok, 'PUT', put.status, (await put.json()).id);
  server.close();
  process.exit(put.ok ? 0 : 1);
}
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => console.log(`[page ${m.type()}] ${m.text()}`));
page.on('response', r => /script\.google|googleusercontent|googleapis/.test(r.url()) && console.log(r.status(), r.request().method(), r.url().slice(0, 70)));
await page.goto(`http://localhost:${server.address().port}/contact.html`);
await page.fill('#contact-name', 'Live Test');
await page.fill('#artist-name', 'Live Test Band');
await page.fill('#artist-email', 'test@example.com');
await page.fill('#artist-phone', '+1 (555) 123-4567');
await page.selectOption('#exp-level', { index: 1 });
await page.selectOption('#session-type', { index: 1 });
await page.fill('#anything-else', 'Live check from tests/live-inquiry.mjs. Safe to delete.');
await page.evaluate((mb) => {
  const dt = new DataTransfer();
  dt.items.add(new File([new Uint8Array(mb * 1024 * 1024)], 'live-test-demo.mp4', { type: 'video/mp4' }));
  const input = document.getElementById('demo-input');
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}, SIZE_MB);
await page.click('#booking-form button[type="submit"]');
await page.locator('#booking-status[data-state="success"], #booking-status[data-state="error"]').waitFor({ timeout: 900000 });
const state = await page.locator('#booking-status').getAttribute('data-state');
console.log('RESULT', state, '|', await page.locator('#booking-status').textContent());
await browser.close(); server.close();
process.exit(state === 'success' ? 0 : 1);
