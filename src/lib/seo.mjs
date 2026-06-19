import org from '../data/org.json';

export const DEFAULT_OG_IMAGE = '/media/og-default.png';

const ORG_ID = (site) => absUrl(site, '/#organization');

export function absUrl(site, pathOrUrl) {
  if (!pathOrUrl) return site.replace(/\/$/, '');
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  const base = site.replace(/\/$/, '');
  return base + (pathOrUrl.startsWith('/') ? pathOrUrl : '/' + pathOrUrl);
}

export function resolveOgImage(site, { image, cover } = {}) {
  return absUrl(site, image || cover || DEFAULT_OG_IMAGE);
}

export function organizationRef(site) {
  return {
    '@type': 'Organization',
    '@id': ORG_ID(site),
    name: org.name,
    logo: absUrl(site, org.logo),
  };
}

export function stripMarkdown(md = '') {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function clampDescription(text = '', max = 155) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 3);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + '...';
}

export function metaDescription({ description, excerpt, body } = {}, max = 155) {
  const source = description || excerpt || stripMarkdown(body || '');
  return source ? clampDescription(source, max) : undefined;
}

export function organizationLd(site) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID(site),
    name: org.name,
    alternateName: org.alternateName,
    url: absUrl(site, '/'),
    logo: absUrl(site, org.logo),
    slogan: org.slogan,
    foundingDate: org.foundingDate,
    email: org.email,
    telephone: org.telephone,
    sameAs: org.sameAs,
    address: {
      '@type': 'PostalAddress',
      streetAddress: org.address.streetAddress,
      addressLocality: org.address.addressLocality,
      addressRegion: org.address.addressRegion,
      postalCode: org.address.postalCode,
      addressCountry: org.address.addressCountry,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: org.geo.latitude,
      longitude: org.geo.longitude,
    },
  };
}

export function websiteLd(site, lang) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': absUrl(site, '/#website'),
    name: org.name,
    url: absUrl(site, '/'),
    inLanguage: lang === 'en' ? 'en' : 'th',
    publisher: organizationRef(site),
  };
}

export function blogPostingLd(site, { path, title, description, image, datePublished, dateModified, lang, section }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    inLanguage: lang === 'en' ? 'en' : 'th',
    datePublished,
    mainEntityOfPage: absUrl(site, path),
    author: organizationRef(site),
    publisher: organizationRef(site),
  };
  if (description) ld.description = description;
  if (image) ld.image = absUrl(site, image);
  if (dateModified) ld.dateModified = dateModified;
  if (section) ld.articleSection = section;
  return ld;
}

function arrayOf(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

export function creativeWorkLd(site, { path, title, image, issues = [], type, lang }) {
  const about = [...arrayOf(issues), ...arrayOf(type)];
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: title,
    inLanguage: lang === 'en' ? 'en' : 'th',
    url: absUrl(site, path),
    creator: organizationRef(site),
  };
  if (image) ld.image = absUrl(site, image);
  if (about.length) ld.about = about;
  return ld;
}

export function breadcrumbLd(site, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absUrl(site, item.path),
    })),
  };
}
