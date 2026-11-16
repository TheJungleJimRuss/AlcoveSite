#!/usr/bin/env node
// Builds images/textures/metal.webp: a procedural, seamless, ALPHA-ONLY brushed-metal tile (white
// RGB, alpha = streak darkness). Brushing leaves long horizontal scratches: each row gets its own
// value, varied slowly along x, plus a few sharper fine scratches. Rows stay nearly constant along
// x, so lossless WebP packs the tile very small. Usage: node scripts/make-metal.mjs [--preview <png>]
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const pi = args.indexOf("--preview");
const preview = pi >= 0 ? args[pi + 1] : null;
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "images", "textures", "metal.webp");

const browser = await chromium.launch();
const page = await browser.newPage();
const res = await page.evaluate(async () => {
  const W = 512, H = 256;
  let s = 29;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // per-row base value, lightly smoothed vertically (wrapping) so streaks have soft width
  const row = Float32Array.from({ length: H }, rnd);
  const rowS = row.map((_, y) => (row[(y - 1 + H) % H] * 0.25 + row[y] * 0.5 + row[(y + 1) % H] * 0.25));
  // per-row slow variation along x: a sum of 2 periodic sines with random phase
  const ph = Array.from({ length: H }, () => [rnd() * 6.283, rnd() * 6.283, 1 + Math.floor(rnd() * 3)]);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"); const id = g.createImageData(W, H);
  const scratch = new Float32Array(W * H);
  // fine scratches: thin, long, fading in and out, wrap-around in x
  for (let i = 0; i < 90; i++) {
    const y = Math.floor(rnd() * H), x0 = rnd() * W, len = 60 + rnd() * 300, a = 0.3 + rnd() * 0.5;
    for (let k = 0; k < len; k++) { const x = Math.floor(x0 + k) % W; scratch[y * W + x] = Math.max(scratch[y * W + x], a * Math.sin(Math.PI * k / len)); }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [p1, p2, f] = ph[y];
    const along = 0.5 + 0.25 * Math.sin(2 * Math.PI * f * x / W + p1) + 0.15 * Math.sin(2 * Math.PI * (f + 2) * x / W + p2);
    const a = (rowS[y] - 0.5) * 1.3 * along + 0.35 + scratch[y * W + x] * 0.6;
    const v = Math.round(Math.max(0, Math.min(1, a)) * 15) * 17;
    const i = (y * W + x) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = v;
  }
  g.putImageData(id, 0, 0);
  const b64 = async (cv, type) => { const b = await new Promise((r) => cv.toBlob(r, type, 1)); const u = new Uint8Array(await b.arrayBuffer()); let str = ""; for (let i = 0; i < u.length; i += 0x8000) str += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(str); };
  const p = document.createElement("canvas"); p.width = W * 2; p.height = H * 2; const pg = p.getContext("2d");
  pg.fillStyle = "#fff"; pg.fillRect(0, 0, p.width, p.height);
  const d = document.createElement("canvas"); d.width = W; d.height = H; const dg = d.getContext("2d"); const di = dg.createImageData(W, H);
  for (let i = 0; i < W * H; i++) di.data[i * 4 + 3] = id.data[i * 4 + 3];
  dg.putImageData(di, 0, 0);
  for (const ox of [0, W]) for (const oy of [0, H]) pg.drawImage(d, ox, oy);
  return { webp: await b64(c, "image/webp"), preview: await b64(p, "image/png") };
});
await browser.close();
writeFileSync(out, Buffer.from(res.webp, "base64"));
if (preview) writeFileSync(preview, Buffer.from(res.preview, "base64"));
console.log(`metal.webp ${(Buffer.from(res.webp, "base64").length / 1024).toFixed(1)} KB`);
