import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

// Maps a local /media raster URL to its generated `.webp` sibling when that sibling exists
// and is smaller than the optimized fallback. This keeps modern browsers from receiving a
// larger asset for tiny PNGs/icons where WebP is not a win.
const RASTER = /\.(?:png|jpe?g)$/i;
const PUBLIC_MEDIA_ROOT = path.resolve('public/media');
const cache = new Map();

export function webpPathFor(src) {
  if (typeof src !== 'string') return null;
  if (!src.startsWith('/media/')) return null;
  if (!RASTER.test(src)) return null;
  return `${src}.webp`;
}

export function shouldUseWebp(fallbackSize, webpSize) {
  return Number.isFinite(fallbackSize) && Number.isFinite(webpSize) && webpSize < fallbackSize;
}

export function webpFor(src, mediaRoot = PUBLIC_MEDIA_ROOT) {
  const webp = webpPathFor(src);
  if (!webp) return null;

  const key = `${mediaRoot}\0${src}\0${webp}`;
  if (cache.has(key)) return cache.get(key);

  const fallbackPath = mediaFilePath(src, mediaRoot);
  const webpPath = mediaFilePath(webp, mediaRoot);
  let result = null;

  try {
    if (fallbackPath && webpPath && existsSync(fallbackPath) && existsSync(webpPath)) {
      const fallbackSize = statSync(fallbackPath).size;
      const webpSize = statSync(webpPath).size;
      if (shouldUseWebp(fallbackSize, webpSize)) result = webp;
    }
  } catch {
    result = null;
  }

  cache.set(key, result);
  return result;
}

function mediaFilePath(src, mediaRoot = PUBLIC_MEDIA_ROOT) {
  try {
    const mediaPath = decodeURIComponent(src).replace(/^\/media\//, '');
    const filePath = path.resolve(mediaRoot, mediaPath);
    return filePath.startsWith(`${mediaRoot}${path.sep}`) ? filePath : null;
  } catch {
    return null;
  }
}
