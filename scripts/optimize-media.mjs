// One-off media optimizer (run via `make optimize-media`, which runs it in Docker with sharp).
//
// For every raster image under public/media it:
//   1. writes a "<file>.webp" sibling when it is smaller than the optimized fallback — the
//      modern-format payload served on-page via
//      <picture> (src/components/Picture.astro + the rehype plugin for body images), and
//   2. re-encodes the original IN PLACE as an optimized JPEG/PNG — the og:image / legacy
//      fallback (social scrapers render JPEG/PNG reliably; WebP support is patchy).
//
// Both outputs are capped at CAP px on the longest side (never upscaled) and EXIF-rotated.
// Idempotent for useful WebPs: skips files with a fresh, smaller .webp sibling
// (set FORCE=1 to re-process).
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

let optimized = 0, skipped = 0, failed = 0, webpKept = 0, webpOmitted = 0;
let beforeTotal = 0, afterTotal = 0, webpTotal = 0;

for await (const file of walk(ROOT)) {
  const webpPath = `${file}.webp`;
  if (!FORCE && await hasFreshSmallerWebp(file, webpPath)) { skipped++; continue; }

  const fallbackTmp = `${file}.tmp`;
  const webpTmp = `${webpPath}.tmp`;
  try {
    const before = (await stat(file)).size;
    // Shared decode: respect EXIF orientation, cap longest side (never enlarge).
    const base = () => sharp(file, { failOn: 'none' })
      .rotate()
      .resize({ width: CAP, height: CAP, fit: 'inside', withoutEnlargement: true });

    // 1) webp candidate — renamed into place only if it is smaller than the final fallback.
    await base().webp({ quality: WEBP_Q, effort: 5 }).toFile(webpTmp);
    const webpSize = (await stat(webpTmp)).size;

    // 2) optimized same-format fallback, written to a temp file then swapped in place
    //    (sharp can't read and write the same path).
    const ext = path.extname(file).toLowerCase();
    const pipe = ext === '.png'
      ? base().png({ palette: true, quality: 80, effort: 8, compressionLevel: 9 })
      : base().jpeg({ quality: JPEG_Q, mozjpeg: true, progressive: true });
    await pipe.toFile(fallbackTmp);
    const fallbackTmpSize = (await stat(fallbackTmp)).size;
    const finalFallbackSize = fallbackTmpSize < before ? fallbackTmpSize : before;

    if (fallbackTmpSize < before) await rename(fallbackTmp, file);
    else await unlink(fallbackTmp);

    if (webpSize < finalFallbackSize) {
      await rename(webpTmp, webpPath);
      webpKept++;
      webpTotal += webpSize;
    } else {
      await unlink(webpTmp);
      if (existsSync(webpPath)) await unlink(webpPath);
      webpOmitted++;
    }

    const after = (await stat(file)).size;

    optimized++; beforeTotal += before; afterTotal += after;
    const webpLabel = webpSize < after ? `webp ${kb(webpSize)}` : 'webp omitted';
    console.log(`${path.relative(ROOT, file)}  ${kb(before)} → fb ${kb(after)} · ${webpLabel}`);
  } catch (err) {
    failed++;
    console.warn(`! skip ${path.relative(ROOT, file)}: ${err.message}`);
    await cleanup(fallbackTmp);
    await cleanup(webpTmp);
  }
}

console.log(`\nDone. ${optimized} optimized, ${skipped} already fresh, ${webpKept} webp kept, ${webpOmitted} webp omitted, ${failed} failed.`);
if (optimized) {
  console.log(`Fallbacks: ${kb(beforeTotal)} → ${kb(afterTotal)} · on-page webp total: ${kb(webpTotal)}`);
}

async function hasFreshSmallerWebp(file, webpPath) {
  if (!existsSync(webpPath)) return false;
  try {
    const [fallback, webp] = await Promise.all([stat(file), stat(webpPath)]);
    return webp.mtimeMs >= fallback.mtimeMs && webp.size < fallback.size;
  } catch {
    return false;
  }
}

async function cleanup(file) {
  try {
    if (existsSync(file)) await unlink(file);
  } catch {
    // Best-effort cleanup only.
  }
}
