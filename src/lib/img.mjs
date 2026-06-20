// Maps a local /media raster URL to its generated `.webp` sibling.
// The optimize-media script writes "<file>.webp" next to every png/jpg in public/media, so
// callers can render a <picture> with a webp <source> and the original as the fallback.
// Returns null for anything we don't generate webp for (svg/gif, remote/non-media URLs), so
// callers degrade to a plain <img>. og:image keeps using the original (social-safe) — this
// only affects on-page rendering.
const RASTER = /\.(?:png|jpe?g)$/i;

export function webpFor(src) {
  if (typeof src !== 'string') return null;
  if (!src.startsWith('/media/')) return null;
  if (!RASTER.test(src)) return null;
  return `${src}.webp`;
}
