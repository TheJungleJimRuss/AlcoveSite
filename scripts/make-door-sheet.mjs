// Stitches the Blender door frames (assets-src/cassette-player/renders/door_NN.png, made by render_layers.py with ONLY=door)
// into one vertical strip, frame 0 (shut) on top: images/cassette/door-sheet-{1x,2x}.webp.
// Run: node scripts/make-door-sheet.mjs   (uses Playwright's Chromium to encode, like make-photos.mjs)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'assets-src', 'cassette-player', 'renders');
const QUALITY = Number(process.env.Q || 0.7), STEP = Number(process.env.STEP || 24), S2 = Number(process.env.S2 || 1);
const NAME = process.env.SHEET || 'door';   // SHEET=flip stitches flip_NN.png into flip-sheet-*.webp
const frames = readdirSync(src).filter(f => new RegExp(`^${NAME}_\\d+\\.png$`).test(f)).sort()
  .map(f => 'data:image/png;base64,' + readFileSync(join(src, f)).toString('base64'));
const browser = await chromium.launch();
const page = await browser.newPage();
const out = await page.evaluate(async ({ frames, QUALITY, STEP, S2, NAME }) => {
  const imgs = await Promise.all(frames.map(async u => { const i = new Image(); i.src = u; await i.decode(); return i; }));
  const w = imgs[0].naturalWidth, h = imgs[0].naturalHeight, res = [];
  for (const [tag, s] of [['2x', S2], ['1x', 0.5]]) {
    const fw = Math.round(w * s), fh = Math.round(h * s);
    const c = new OffscreenCanvas(fw, fh * imgs.length), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    imgs.forEach((im, i) => g.drawImage(im, 0, i * fh, fw, fh));
    // The glass is faint white at low alpha with render noise in it; that noise is most of the file.
    // Snap glass pixels (light, mostly transparent) to a few flat alpha steps.
    const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let k = 0; k < p.length; k += 4) {
      const a = p[k + 3];
      if (NAME === 'flip' && a > 0 && a < 255 && p[k] < 24 && p[k + 1] < 24 && p[k + 2] < 24) {   // cast shadow: none at rest (the deck has it baked in), soft while lifted
        const fi = Math.floor(k / 4 / c.width / fh), t = fi / (imgs.length - 1);
        p[k + 3] = Math.round(a * 0.55 * Math.sin(Math.PI * t) ** 0.8); continue;
      }
      if (a > 0 && a < 140 && p[k] > 200 && p[k + 1] > 200 && p[k + 2] > 200) {
        p[k] = p[k + 1] = p[k + 2] = 255; p[k + 3] = Math.round(a / STEP) * STEP;
      }
    }
    g.putImageData(d, 0, 0);
    const b = await c.convertToBlob({ type: 'image/webp', quality: QUALITY });
    res.push([tag, Array.from(new Uint8Array(await b.arrayBuffer()))]);
  }
  return res;
}, { frames, QUALITY, STEP, S2, NAME });
for (const [tag, bytes] of out) {
  writeFileSync(join(root, 'images', 'cassette', `${NAME}-sheet-${tag}.webp`), Buffer.from(bytes));
  console.log(`${NAME}-sheet-${tag}.webp`, bytes.length, 'bytes,', frames.length, 'frames');
}
await browser.close();
