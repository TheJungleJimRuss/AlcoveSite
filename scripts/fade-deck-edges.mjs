// The deck render's soft shadow runs into the edge of its canvas, which showed as a hard vertical/horizontal cut on the page.
// Fades the alpha of pure-black shadow pixels to 0 at the image edge (like fade_edges in assets-src/record-player/render_crate_top.py).
// Run: node scripts/fade-deck-edges.mjs   (originals are kept in assets-src/cassette-player/orig-exports/; always reads those)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRAC = Number(process.env.FRAC || 0.09);
const browser = await chromium.launch();
const page = await browser.newPage();
for (const tag of ['1x', '2x']) {
  const src = 'data:image/webp;base64,' + readFileSync(join(root, 'assets-src/cassette-player/orig-exports', `deck-${tag}.webp`)).toString('base64');
  const b64 = await page.evaluate(async ({ src, FRAC }) => {
    const i = new Image(); i.src = src; await i.decode();
    const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(i, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), w = c.width, h = c.height, m = FRAC * Math.max(w, h);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const o = (y * w + xx) * 4, a = d.data[o + 3];
      if (a >= 250 || Math.max(d.data[o], d.data[o + 1], d.data[o + 2]) > 12) continue;
      const t = Math.min(1, Math.min(xx, w - 1 - xx, y, h - 1 - y) / m), s = t * t * (3 - 2 * t);
      d.data[o + 3] = Math.round(a * s);
    }
    x.putImageData(d, 0, 0);
    return c.toDataURL('image/webp', 0.9).split(',')[1];
  }, { src, FRAC });
  writeFileSync(join(root, 'images/cassette', `deck-${tag}.webp`), Buffer.from(b64, 'base64'));
}
await browser.close();
