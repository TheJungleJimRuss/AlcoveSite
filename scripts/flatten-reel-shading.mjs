// The reel render has a one-sided shadow baked into its cream flange; because the reel rotates, that shadow spun with it.
// Replaces the flange colour (outside the hub) with its average around each ring, so the image is rotation-symmetric.
// The hub teeth stay as rendered. Reads originals from assets-src/cassette-player/orig-exports/. Run: node scripts/flatten-reel-shading.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const R0 = Number(process.env.R0 || 0.42), R1 = Number(process.env.R1 || 0.5);
const browser = await chromium.launch();
const page = await browser.newPage();
for (const tag of ['1x', '2x']) {
  const src = 'data:image/webp;base64,' + readFileSync(join(root, 'assets-src/cassette-player/orig-exports', `reel-${tag}.webp`)).toString('base64');
  const b64 = await page.evaluate(async ({ src, R0, R1 }) => {
    const i = new Image(); i.src = src; await i.decode();
    const w = i.naturalWidth, h = i.naturalHeight, c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(i, 0, 0);
    const d = x.getImageData(0, 0, w, h), cx = (w - 1) / 2, cy = (h - 1) / 2, half = w / 2, NB = 128;
    const sum = new Float64Array(NB * 4), cnt = new Float64Array(NB);
    const bin = (px, py) => Math.min(NB - 1, Math.floor(Math.hypot(px - cx, py - cy) / half * NB));
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const o = (y * w + xx) * 4, a = d.data[o + 3]; if (a < 250) continue;
      const b = bin(xx, y); for (let k = 0; k < 3; k++) sum[b * 4 + k] += d.data[o + k]; cnt[b]++;
    }
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const o = (y * w + xx) * 4, r = Math.hypot(xx - cx, y - cy) / half;
      if (r <= R0) continue; const b = bin(xx, y); if (!cnt[b]) continue;
      const t = Math.min(1, (r - R0) / (R1 - R0)), s = t * t * (3 - 2 * t);
      for (let k = 0; k < 3; k++) d.data[o + k] = d.data[o + k] * (1 - s) + (sum[b * 4 + k] / cnt[b]) * s;
    }
    // Hub: the six teeth repeat every 60 degrees, so averaging six turns of the original removes the one-sided shading and keeps the teeth.
    const avg = document.createElement('canvas'); avg.width = w; avg.height = h; const ax = avg.getContext('2d');
    for (let k = 0; k < 6; k++) { ax.save(); ax.globalAlpha = 1 / (k + 1); ax.translate(w / 2, h / 2); ax.rotate(k * Math.PI / 3); ax.drawImage(i, -w / 2, -h / 2); ax.restore(); }
    const ad = ax.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const o = (y * w + xx) * 4, r = Math.hypot(xx - cx, y - cy) / half; if (r > R0) continue;
      const t = Math.min(1, Math.max(0, (R0 - r) / 0.05)), s = t * t * (3 - 2 * t);
      for (let k = 0; k < 3; k++) d.data[o + k] = d.data[o + k] * (1 - s) + ad[o + k] * s;
    }
    x.putImageData(d, 0, 0);
    return c.toDataURL('image/webp', 0.92).split(',')[1];
  }, { src, R0, R1 });
  writeFileSync(join(root, 'images/cassette', `reel-${tag}.webp`), Buffer.from(b64, 'base64'));
}
await browser.close();
