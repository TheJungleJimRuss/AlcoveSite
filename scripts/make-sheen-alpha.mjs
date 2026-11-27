// Turns the greyscale vinyl sheen masks into alpha masks (white, alpha = brightness).
// Safari ignores `mask-mode: luminance` and masks by alpha, so an opaque greyscale mask showed as a solid square.
// Usage: node scripts/make-sheen-alpha.mjs   (reads/writes images/record-player/)
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = join(fileURLToPath(import.meta.url), '..', '..', 'images', 'record-player');
const browser = await chromium.launch(); const page = await browser.newPage();
for (const s of ['1x', '2x']) {
  const src = `data:image/webp;base64,${(await readFile(join(dir, `vinyl-sheen-mask-${s}.webp`))).toString('base64')}`;
  const out = await page.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d');
    g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) { p[i + 3] = Math.min(255, Math.round((0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 4) * 4); p[i] = p[i + 1] = p[i + 2] = 255; }
    g.putImageData(d, 0, 0);
    const b = await c.convertToBlob({ type: 'image/webp', quality: 0.8 });
    return { b64: btoa(String.fromCharCode(...new Uint8Array(await b.arrayBuffer()))), type: b.type, w: c.width, h: c.height };
  }, src);
  if (out.type !== 'image/webp') throw new Error(`encoder gave ${out.type}`);
  const file = join(dir, `vinyl-sheen-alpha-${s}.webp`);
  await writeFile(file, Buffer.from(out.b64, 'base64'));
  console.log(`${file} ${out.w}x${out.h} ${Buffer.from(out.b64, 'base64').length} bytes`);
}
await browser.close();
