// Converts the white-on-black logo photo into a cropped, transparent white-on-alpha PNG (used as a CSS mask).
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
const src = (await readFile(process.argv[2])).toString('base64');
const b = await chromium.launch(); const p = await b.newPage();
const out = await p.evaluate(async (src) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height); let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let i = 0; i < d.data.length; i += 4) {
    const a = d.data[i]; d.data[i] = d.data[i+1] = d.data[i+2] = 255; d.data[i+3] = a;
    if (a > 40) { const px = (i/4) % c.width, py = Math.floor(i/4 / c.width); x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
  }
  x.putImageData(d, 0, 0);
  const pad = 8, w = x1 - x0 + 1 + pad*2, h = y1 - y0 + 1 + pad*2, s = 1400 / w;
  const o = document.createElement('canvas'); o.width = 1400; o.height = Math.round(h * s);
  const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high';
  ox.drawImage(c, x0 - pad, y0 - pad, w, h, 0, 0, o.width, o.height);
  return o.toDataURL('image/png').split(',')[1];
}, src);
await writeFile(process.argv[3], Buffer.from(out, 'base64')); await b.close();
