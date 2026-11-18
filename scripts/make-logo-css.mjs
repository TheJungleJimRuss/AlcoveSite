// Writes logo.css from the logo mask PNG (output of make-logo.mjs): one WebP data URI in --logo-mask, used by both
// the prefixed and standard mask-image. A data URI so the mask also works from file:// (url() masks are blocked there).
// WebP keeps the alpha lossless (only the constant white RGB is lossy), at a fraction of the PNG size.
// Run: node scripts/make-logo-css.mjs <mask.png>
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
const src = (await readFile(process.argv[2])).toString('base64');
const b = await chromium.launch(); const p = await b.newPage();
const webp = await p.evaluate(async (src) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
  const c = new OffscreenCanvas(img.width, img.height); c.getContext('2d').drawImage(img, 0, 0);
  const blob = await c.convertToBlob({ type: 'image/webp', quality: 0.9 });
  const bytes = new Uint8Array(await blob.arrayBuffer()); let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}, src);
await b.close();
await writeFile(new URL('../logo.css', import.meta.url), `/* Logo mask as one WebP data URI (works from file://, where url() masks are blocked). Regenerate: scripts/make-logo.mjs, then scripts/make-logo-css.mjs. */
:root { --logo-mask: url("data:image/webp;base64,${webp}"); }
.logo-mark {
  -webkit-mask-image: var(--logo-mask);
  mask-image: var(--logo-mask);
}
`);
console.log('logo.css', Math.round(webp.length / 1024) + ' KB of base64');
