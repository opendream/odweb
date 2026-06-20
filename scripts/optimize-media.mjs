// One-off media optimizer (run via `make optimize-media`, which runs it in Docker with sharp).
//
// For every raster image under public/media it:
//   1. writes a "<file>.webp" sibling — the small, modern-format payload served on-page via
//      <picture> (src/components/Picture.astro + the rehype plugin for body images), and
//   2. re-encodes the original IN PLACE as an optimized JPEG/PNG — the og:image / legacy
//      fallback (social scrapers render JPEG/PNG reliably; WebP support is patchy).
//
// Both outputs are capped at CAP px on the longest side (never upscaled) and EXIF-rotated.
// Idempotent: skips files that already have a .webp sibling (set FORCE=1 to re-process).
import { readdir, stat, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve('public/media');
const CAP = Number(process.env.CAP || 1280);
const WEBP_Q = Number(process.env.WEBP_Q || 72);
const JPEG_Q = Number(process.env.JPEG_Q || 80);
const FORCE = !!process.env.FORCE;
const RASTER = /\.(png|jpe?g)$/i;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && RASTER.test(entry.name)) yield full;
  }
}

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

let optimized = 0, skipped = 0, failed = 0;
let beforeTotal = 0, afterTotal = 0, webpTotal = 0;

for await (const file of walk(ROOT)) {
  const webpPath = `${file}.webp`;
  if (!FORCE && existsSync(webpPath)) { skipped++; continue; }
  try {
    const before = (await stat(file)).size;
    // Shared decode: respect EXIF orientation, cap longest side (never enlarge).
    const base = () => sharp(file, { failOn: 'none' })
      .rotate()
      .resize({ width: CAP, height: CAP, fit: 'inside', withoutEnlargement: true });

    // 1) webp sibling — the on-page payload.
    await base().webp({ quality: WEBP_Q, effort: 5 }).toFile(webpPath);
    const webpSize = (await stat(webpPath)).size;

    // 2) optimized same-format fallback, written to a temp file then swapped in place
    //    (sharp can't read and write the same path).
    const ext = path.extname(file).toLowerCase();
    const tmp = `${file}.tmp`;
    const pipe = ext === '.png'
      ? base().png({ palette: true, quality: 80, effort: 8, compressionLevel: 9 })
      : base().jpeg({ quality: JPEG_Q, mozjpeg: true, progressive: true });
    await pipe.toFile(tmp);
    if ((await stat(tmp)).size < before) await rename(tmp, file);
    else await unlink(tmp);
    const after = (await stat(file)).size;

    optimized++; beforeTotal += before; afterTotal += after; webpTotal += webpSize;
    console.log(`${path.relative(ROOT, file)}  ${kb(before)} → fb ${kb(after)} · webp ${kb(webpSize)}`);
  } catch (err) {
    failed++;
    console.warn(`! skip ${path.relative(ROOT, file)}: ${err.message}`);
  }
}

console.log(`\nDone. ${optimized} optimized, ${skipped} already done, ${failed} failed.`);
if (optimized) {
  console.log(`Fallbacks: ${kb(beforeTotal)} → ${kb(afterTotal)} · on-page webp total: ${kb(webpTotal)}`);
}
