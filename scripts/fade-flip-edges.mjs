// The flip sheet's frames (15 stacked, 1500% tall) have the lifted cassette's shadow cut off by each frame's right and bottom edge.
// Fades pure-black shadow pixels to alpha 0 toward every frame edge. Reads the originals in assets-src/cassette-player/orig-exports/.
// Run: node scripts/fade-flip-edges.mjs   (FRAC = fade width as a share of the frame height, default 0.2)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRAC = Number(process.env.FRAC || 0.2), N = 15;
const browser = await chromium.launch();
const page = await browser.newPage();
for (const tag of ['1x', '2x']) {
  const src = 'data:image/webp;base64,' + readFileSync(join(root, 'assets-src/cassette-player/orig-exports', `flip-sheet-${tag}.webp`)).toString('base64');
  const b64 = await page.evaluate(async ({ src, FRAC, N }) => {
    const i = new Image(); i.src = src; await i.decode();
    const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(i, 0, 0);
    const w = c.width, fh = c.height / N, m = FRAC * fh;
    const d = x.getImageData(0, 0, w, c.height);
    for (let f = 0; f < N; f++) for (let y = 0; y < fh; y++) for (let xx = 0; xx < w; xx++) {
      const o = ((f * fh + y) * w + xx) * 4, a = d.data[o + 3];
      if (a >= 250 || Math.max(d.data[o], d.data[o + 1], d.data[o + 2]) > 30) continue;
      const t = Math.min(1, Math.min(xx, w - 1 - xx, y, fh - 1 - y) / m), s = t * t * (3 - 2 * t);
      d.data[o + 3] = Math.round(a * s);
    }
    x.putImageData(d, 0, 0);
    return c.toDataURL('image/webp', 0.8).split(',')[1];
  }, { src, FRAC, N });
  writeFileSync(join(root, 'images/cassette', `flip-sheet-${tag}.webp`), Buffer.from(b64, 'base64'));
}
await browser.close();
