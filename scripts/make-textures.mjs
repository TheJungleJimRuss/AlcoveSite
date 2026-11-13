#!/usr/bin/env node
// Builds the texture files in images/textures/.
// paper.webp and tape.webp are REAL SCANS kept as photos (grayscale): CSS multiplies them onto a
// palette colour with background-blend-mode, and tape*.webp's alpha is the strip's outline.
// print-wear.webp and film-grain.webp are ALPHA-ONLY tiles (white RGB, alpha = intensity) that
// CSS paints in palette colours: background-color: <token> + mask-image: url(tile).
// Usage: node scripts/make-textures.mjs <source-dir> [--preview <dir>]
//   <source-dir> holds the unzipped ambientCG folders (Paper001_1K-JPG/, Tape005_1K-JPG/,
//   SurfaceImperfections017_1K-JPG/), each with a *_Color.jpg (Tape005 also *_Opacity.jpg).
//   --preview <dir> also writes 2x2 tiled PNG previews there.
// Processing runs in headless Chromium (Playwright canvas); film-grain.webp is generated.
// film-grain alpha = the DARK half of the grain; print-wear alpha = the specks.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const srcDir = args[0];
const pi = args.indexOf("--preview");
const previewDir = pi >= 0 ? args[pi + 1] : null;
if (!srcDir) { console.error("usage: node scripts/make-textures.mjs <source-dir> [--preview <dir>]"); process.exit(1); }
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "images", "textures");
mkdirSync(outDir, { recursive: true });
if (previewDir) mkdirSync(previewDir, { recursive: true });

// A source folder that is not there is skipped: its tile in images/textures/ is left as it is.
const map = (name, kind) => { const f = join(resolve(srcDir), name, `${name}_${kind}.jpg`);
  if (!existsSync(f)) { console.log(`skip: no ${name}`); return null; } return readFileSync(f).toString("base64"); };
const color = (name) => map(name, "Color");
const sources = {
  paper: color("Paper001_1K-JPG"),
  tape: color("Tape005_1K-JPG"),
  tapeMask: map("Tape005_1K-JPG", "Opacity"),
  wear: color("SurfaceImperfections017_1K-JPG"),
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<canvas></canvas>");

const result = await page.evaluate(async (sources) => {
  const loadImg = (b64) => new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = "data:image/jpeg;base64," + b64;
  });
  // Draw a source rect into a w*h canvas (high-quality downscale), return Float32 luminance.
  const gray = (img, sx, sy, sw, sh, w, h) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.imageSmoothingQuality = "high";
    // step down in halves for a cleaner downscale
    let cur = img, cw = sw, ch = sh, cx = sx, cy = sy;
    while (cw / 2 >= w && ch / 2 >= h) {
      const t = document.createElement("canvas"); t.width = cw >> 1; t.height = ch >> 1;
      const tg = t.getContext("2d"); tg.imageSmoothingQuality = "high";
      tg.drawImage(cur, cx, cy, cw, ch, 0, 0, t.width, t.height);
      cur = t; cx = 0; cy = 0; cw = t.width; ch = t.height;
    }
    g.drawImage(cur, cx, cy, cw, ch, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, out = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) out[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
    return out;
  };
  // Separable box blur; wrap=true tiles, else clamps.
  const blur = (a, w, h, r, wrap) => {
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
    const ix = (i, m) => wrap ? ((i % m) + m) % m : Math.min(m - 1, Math.max(0, i));
    for (let y = 0; y < h; y++) { let s = 0; for (let k = -r; k <= r; k++) s += a[y * w + ix(k, w)];
      for (let x = 0; x < w; x++) { tmp[y * w + x] = s / n; s += a[y * w + ix(x + r + 1, w)] - a[y * w + ix(x - r, w)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let k = -r; k <= r; k++) s += tmp[ix(k, h) * w + x];
      for (let y = 0; y < h; y++) { out[y * w + x] = s / n; s += tmp[ix(y + r + 1, h) * w + x] - tmp[ix(y - r, h) * w + x]; } }
    return out;
  };
  // Remove low-frequency tint/shading, then scale to a target std around mid-gray (128).
  const normalize = (a, w, h, radius, std) => {
    const lp = blur(blur(a, w, h, radius, false), w, h, radius, false);
    const hp = a.map((v, i) => v - lp[i]);
    let m = 0; for (const v of hp) m += v; m /= hp.length;
    let s = 0; for (const v of hp) s += (v - m) ** 2; s = Math.sqrt(s / hp.length) || 1;
    // clip outliers (dust, stray specks) to +-2.5 sigma so they don't show as repeated dots
    return hp.map((v) => 128 + Math.max(-2.5, Math.min(2.5, (v - m) / s)) * std);
  };
  // Mid-gray tile -> alpha: only the dark half of the texture, scaled so 2.5 std = fully opaque.
  const darkAlpha = (a, std) => a.map((v) => 255 * Math.max(0, Math.min(1, (128 - v) / (2.5 * std))));
  // Seamless: blend the tile with a half-offset copy using a raised-cosine weight that is 0 at
  // the edges (where the offset copy is continuous across the wrap) and 1 at the center.
  const seamless = (a, w, h) => {
    const wx = (x) => 0.5 - 0.5 * Math.cos((2 * Math.PI * (x + 0.5)) / w);
    const wy = (y) => 0.5 - 0.5 * Math.cos((2 * Math.PI * (y + 0.5)) / h);
    const out = new Float32Array(w * h), hw = w >> 1, hh = h >> 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const m = wx(x) * wy(y);
      const o = a[((y + hh) % h) * w + ((x + hw) % w)];
      // 128-centred mix keeps variance reasonable: use sqrt weights
      const mc = Math.sqrt(m), oc = Math.sqrt(1 - m);
      const k = Math.sqrt(mc * mc + oc * oc);
      out[y * w + x] = 128 + ((a[y * w + x] - 128) * mc + (o - 128) * oc) / k;
    }
    return out;
  };
  const toWebp = async (a, w, h, q, levels = 16) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"), id = g.createImageData(w, h);
    // Alpha is stored lossless: quantize to 8-16 levels so WebP packs it (4 bits/px) and tiles stay small.
    for (let i = 0; i < w * h; i++) { const v = Math.round(Math.max(0, Math.min(255, a[i])) * (levels - 1) / 255) * (255 / (levels - 1)); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = v; }
    g.putImageData(id, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, "image/webp", q)); // alpha channel is stored lossless
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  };
  // 2x2 tiled preview PNG (data URL base64)
  const tiled = (a, w, h) => {
    const c = document.createElement("canvas"); c.width = w * 2; c.height = h * 2;
    const g = c.getContext("2d"), id = g.createImageData(w * 2, h * 2);
    for (let y = 0; y < h * 2; y++) for (let x = 0; x < w * 2; x++) {
      const v = Math.max(0, Math.min(255, Math.round(a[(y % h) * w + (x % w)])));
      const i = (y * w * 2 + x) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    return c.toDataURL("image/png").split(",")[1];
  };

  const out = {};
  const add = async (name, a, w, h, q, levels) => { out[name] = { webp: await toWebp(a, w, h, q, levels), preview: tiled(a, w, h) }; };

  // Encode a canvas as lossy WebP (photo tiles), base64
  const canvasWebp = async (c, q) => {
    const blob = await new Promise((r) => c.toBlob(r, "image/webp", q));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  };

  // paper: the Paper001 scan itself (smooth white sheet with a fine tooth), grayscale, for paper
  // things (polaroid frames, Card Stock). A 600px square of the 1024x600 scan; only the slow
  // shading is removed, then a cross-fade makes it tile. It sits around near-white so CSS can
  // multiply it onto the frame or card colour. Opaque photo, lossy WebP.
  if (sources.paper) { const img = await loadImg(sources.paper), n = 512, mean = 236, std = 9;
    let a = gray(img, 212, 0, 600, 600, n, n);
    a = normalize(a, n, n, 20, 1); // 128 + clipped z-score
    a = seamless(a, n, n);
    const c = document.createElement("canvas"); c.width = c.height = n;
    const g = c.getContext("2d"), id = g.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const v = Math.round(Math.max(0, Math.min(255, mean + (a[i] - 128) * std)));
      id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    out.paper = { webp: await canvasWebp(c, 0.5) }; }

  // tape: one whole strip of Tape006 (crepe tape with torn ends), cut out with the scan's own
  // opacity map and turned to lie horizontally. Grayscale around light gray so CSS can multiply
  // it onto the palette's tape colour; alpha = the strip's real outline. Lossy RGB, lossless alpha.
  // cutStrip: one strip inside the search window (rx, ry, rw, rh) of a tape scan, rotated 90deg.
  const cutStrip = async (img, mask, rx, ry, rw, rh) => {
    const m = gray(mask, rx, ry, rw, rh, rw, rh);
    let x0 = rw, x1 = 0, y0 = rh, y1 = 0;
    for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) if (m[y * rw + x] > 110) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const pad = 3; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(rw - 1, x1 + pad); y1 = Math.min(rh - 1, y1 + pad);
    const sw = x1 - x0 + 1, sh = y1 - y0 + 1;
    const lum = gray(img, rx + x0, ry + y0, sw, sh, sw, sh), al = gray(mask, rx + x0, ry + y0, sw, sh, sw, sh);
    let sum = 0, cnt = 0; for (let i = 0; i < sw * sh; i++) if (al[i] > 200) { sum += lum[i]; cnt++; }
    const avg = sum / cnt;
    // rotate 90deg: output is sh wide, sw tall
    const c = document.createElement("canvas"); c.width = sh; c.height = sw;
    const g = c.getContext("2d"), id = g.createImageData(sh, sw);
    for (let y = 0; y < sw; y++) for (let x = 0; x < sh; x++) {
      const si = (sh - 1 - x) * sw + y, di = (y * sh + x) * 4;
      const v = Math.round(Math.max(0, Math.min(255, 226 + (lum[si] - avg) * 2.1)));
      const o = Math.max(0, Math.min(1, (al[si] - 70) / 110));
      id.data[di] = id.data[di + 1] = id.data[di + 2] = v; id.data[di + 3] = Math.round(o * 255);
    }
    g.putImageData(id, 0, 0);
    return { webp: await canvasWebp(c, 0.7), w: sh, h: sw };
  };
  // Three different strips of Tape005 (smooth beige masking tape), so no one mark gives away that
  // every card wears the same piece. Windows are (x, y, w, h) in the 1024px scan: the clean
  // bottom-middle strip whole, and the top / bottom 300px of two long strips (one straight cut end).
  if (sources.tape && sources.tapeMask) {
    const img = await loadImg(sources.tape), mask = await loadImg(sources.tapeMask);
    out.tape = await cutStrip(img, mask, 610, 678, 155, 305);
    out["tape-2"] = await cutStrip(img, mask, 570, 50, 160, 300);
    out["tape-3"] = await cutStrip(img, mask, 240, 345, 155, 305);
  }

  // print-wear: bright specks of SurfaceImperfections017 become the alpha of the wear overlay.
  // The source is already tileable, so only downscale + levels (cross-fading would smear the specks).
  if (sources.wear) { const img = await loadImg(sources.wear);
    const a = gray(img, 0, 0, 1024, 1024, 512, 512);
    const sorted = Float32Array.from(a).sort();
    const lo = sorted[Math.floor(sorted.length * 0.93)], hi = sorted[Math.floor(sorted.length * 0.985)];
    const m = a.map((v) => {
      const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
      const s = t * t * (3 - 2 * t);
      return s * 255; // alpha = wear speck strength
    });
    await add("print-wear", m, 512, 512, 0.5); }

  // film grain: generated, periodic by construction (iid noise, wrap-around 3-tap blur)
  { const n = 256; let s = 0x9e3779b9 >>> 0;
    const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    let a = new Float32Array(n * n);
    for (let i = 0; i < a.length; i++) a[i] = rnd() + rnd() + rnd() + rnd() - 2; // ~gaussian
    a = blur(a, n, n, 0, true); // no-op placeholder keeps API symmetrical
    const sm = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const g = (xx, yy) => a[((yy + n) % n) * n + ((xx + n) % n)];
      sm[y * n + x] = 0.6 * g(x, y) + 0.1 * (g(x - 1, y) + g(x + 1, y) + g(x, y - 1) + g(x, y + 1));
    }
    let m = 0, v = 0; for (const t of sm) m += t; m /= sm.length;
    for (const t of sm) v += (t - m) ** 2; v = Math.sqrt(v / sm.length);
    const g = sm.map((t) => 128 + ((t - m) / v) * 26);
    await add("film-grain", darkAlpha(g, 26), 256, 256, 0.45); }

  return out;
}, sources);

await browser.close();

let total = 0;
for (const [name, { webp, preview }] of Object.entries(result)) {
  const file = join(outDir, `${name}.webp`);
  writeFileSync(file, Buffer.from(webp, "base64"));
  const size = statSync(file).size; total += size;
  console.log(`${name}.webp  ${(size / 1024).toFixed(1)} KB${result[name].w ? `  ${result[name].w}x${result[name].h}` : ""}`);
  if (previewDir && preview) writeFileSync(join(previewDir, `${name}-2x2.png`), Buffer.from(preview, "base64"));
}
console.log(`total ${(total / 1024).toFixed(1)} KB (budget 150 KB)${total > 150 * 1024 ? "  OVER BUDGET" : ""}`);
