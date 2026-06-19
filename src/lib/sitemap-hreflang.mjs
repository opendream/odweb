import { PRODUCTION_ORIGIN } from './site.mjs';

const NOINDEX_PATHS = new Set(['/404', '/styleguide']);

// `site` is only a parse base here (origin is discarded; we return the pathname).
export function normalizeSitemapPath(pathOrUrl, site = PRODUCTION_ORIGIN) {
  const url = new URL(pathOrUrl, site);
  let path = url.pathname || '/';
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path || '/';
}

function absoluteSitemapUrl(site, pathOrUrl) {
  const path = normalizeSitemapPath(pathOrUrl, site);
  return new URL(path, site).href;
}

function langForPath(path) {
  return path === '/en' || path.startsWith('/en/') ? 'en' : 'th';
}

function addPair(map, left, right) {
  if (!left || !right) return;
  const a = normalizeSitemapPath(left);
  const b = normalizeSitemapPath(right);
  if (a === b) return;
  map.set(a, b);
  map.set(b, a);
}

export function buildAlternatePathMap(translations = {}, serviceLandings = {}) {
  const map = new Map();

  for (const [path, altPath] of Object.entries(translations)) {
    addPair(map, path, altPath);
  }

  for (const item of serviceLandings.th ?? []) {
    addPair(map, `/projects/${item.slug}`, item.altPath);
  }

  for (const item of serviceLandings.en ?? []) {
    addPair(map, `/en/projects_en/${item.slug}`, item.altPath);
  }

  return map;
}

export function sitemapAlternateLinks(site, pathOrUrl, translations = {}, serviceLandings = {}) {
  const currentPath = normalizeSitemapPath(pathOrUrl, site);
  const alternatePath = buildAlternatePathMap(translations, serviceLandings).get(currentPath);
  if (!alternatePath) return [];

  const currentLang = langForPath(currentPath);
  const alternateLang = langForPath(alternatePath);
  if (currentLang === alternateLang) return [];

  const thPath = currentLang === 'th' ? currentPath : alternatePath;
  const enPath = currentLang === 'en' ? currentPath : alternatePath;

  return [
    { lang: 'th', url: absoluteSitemapUrl(site, thPath) },
    { lang: 'en', url: absoluteSitemapUrl(site, enPath) },
    { lang: 'x-default', url: absoluteSitemapUrl(site, thPath) },
  ];
}

export function withSitemapHreflang(item, { site, translations, serviceLandings }) {
  const url = absoluteSitemapUrl(site, item.url);
  const links = sitemapAlternateLinks(site, item.url, translations, serviceLandings);
  return {
    ...item,
    url,
    ...(links.length ? { links } : { links: undefined }),
  };
}

export function createSitemapSerializer(options) {
  const seen = new Set();
  return (item) => {
    const next = withSitemapHreflang(item, options);
    if (seen.has(next.url)) return undefined;
    seen.add(next.url);
    return next;
  };
}

export function isSitemapIndexable(pathOrUrl) {
  return !NOINDEX_PATHS.has(normalizeSitemapPath(pathOrUrl));
}
