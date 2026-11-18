// Builds responsive WebP copies of the studio photos: images/<name>-<w>.webp for each width below.
// The original JPEGs stay as the <img src> fallback and the file admin media and the hero fall back to.
// Run: node scripts/make-photos.mjs   (uses Playwright's Chromium to encode, like make-textures.mjs)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WIDTHS = [640, 1280, 2000], QUALITY = 0.78;
const photos = readdirSync(join(root, 'images')).filter(f => /^studio-.*\.jpg$/.test(f));
const browser = await chromium.launch();
const page = await browser.newPage();
for (const f of photos) {
  const dataUrl = 'data:image/jpeg;base64,' + readFileSync(join(root, 'images', f)).toString('base64');
  const out = await page.evaluate(async ({ dataUrl, WIDTHS, QUALITY }) => {
    const img = new Image(); img.src = dataUrl; await img.decode();
    const res = [];
    for (const w of WIDTHS) {
      const h = Math.round(img.naturalHeight * w / img.naturalWidth);
      const c = new OffscreenCanvas(w, h), g = c.getContext('2d');
      g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h);
      const b = await c.convertToBlob({ type: 'image/webp', quality: QUALITY });
      res.push([w, Array.from(new Uint8Array(await b.arrayBuffer()))]);
    }
    return res;
  }, { dataUrl, WIDTHS, QUALITY });
  for (const [w, bytes] of out) {
    const name = f.replace(/\.jpg$/, `-${w}.webp`);
    writeFileSync(join(root, 'images', name), Buffer.from(bytes));
    console.log(name, Math.round(bytes.length / 1024) + ' KB');
  }
}
await browser.close();
