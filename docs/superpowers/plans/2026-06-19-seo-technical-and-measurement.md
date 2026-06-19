# SEO Technical + Measurement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rich, correct SEO metadata (per-page descriptions, real social-share images, Open Graph article tags, JSON-LD structured data, hreflang/sitemap polish, alt-text audit) plus privacy-first measurement (Cloudflare Web Analytics + Google Search Console) to the Astro rebuild of opendream.co.th.

**Architecture:** All head metadata moves into one `src/components/SEO.astro` driven by pure, unit-tested helpers in `src/lib/seo.mjs`. `BaseLayout` keeps its existing hreflang math and renders `<SEO/>`; layouts/pages pass new props (`description`, `cover`, `type`, `publishedTime`, `section`, `jsonLd`). Organization facts and measurement tokens live in JSON data files. Measurement is config-gated (empty token = no output) so nothing tracks until filled post-deploy.

**Tech Stack:** Astro 5, `@astrojs/sitemap`, Vitest (via Vite, in Docker), schema.org JSON-LD, macOS `sips` for the one-off image conversion.

**Scope note:** This plan covers spec Phases 1 (technical) + 3 (measurement). Phase 2 (the reusable `seo-audit` skill) is a separate skill-creator flow; Phase 4 (bilingual keyword strategy) is a separate deep-research activity whose output later refines the description/title copy added here.

**How to run things (no Node on host — everything is Docker):**
- Unit tests: `docker compose --profile tools run --rm test`
- Build `dist/` + serve: `make up` (first time) or `make rebuild` (after changes)
- Inspect built HTML: read/grep files under `dist/`

---

## File Structure

**Create:**
- `src/data/org.json` — Organization facts (name, logo, socials, address, contact).
- `src/data/site.json` — measurement config (`cfBeaconToken`, `googleSiteVerification`); empty by default.
- `src/lib/seo.mjs` — pure helpers: URL resolution, description handling, JSON-LD builders.
- `src/lib/seo.test.mjs` — Vitest unit tests for `seo.mjs`.
- `src/components/SEO.astro` — renders all `<head>` metadata, JSON-LD, analytics, verification.
- `scripts/lib/alt.mjs` + `scripts/lib/alt.test.mjs` — pure empty-alt detector.
- `scripts/audit-alt.mjs` — runner that reports empty-alt images across content.
- `public/media/og-default.png` — 1200×630 default share image (converted from supplied artwork).
- `docs/seo-setup.md` — post-deploy runbook for analytics + Search Console.

**Modify:**
- `src/layouts/BaseLayout.astro` — accept new props; render `<SEO/>`; keep hreflang math + font preloads.
- `src/layouts/PostLayout.astro` — article OG + BlogPosting/Breadcrumb JSON-LD.
- `src/layouts/ProjectLayout.astro` — cover OG + CreativeWork/Breadcrumb JSON-LD.
- `src/layouts/ComposedLayout.astro` — pass `noindex` through (dual-mode).
- `src/pages/[...path].astro` — pass `section` (first category) + `modified` to PostLayout.
- `src/pages/index.astro`, `src/pages/en/index.astro` — home description + Organization/WebSite JSON-LD.
- `src/pages/blog/index.astro`, `src/pages/en/blogs/index.astro`, `src/pages/projects/index.astro`, `src/pages/en/projects_en/index.astro` — listing descriptions.
- `src/pages/projects/[service].astro`, `src/pages/en/projects_en/[service].astro` — service descriptions.
- `src/pages/404.astro` — `noindex`.
- `src/pages/styleguide.mdx` — `noindex: true` frontmatter.
- `astro.config.mjs` — sitemap i18n + exclude `/styleguide`.
- `vitest.config.ts` — also include `src/**/*.test.mjs`.

---

## Task 1: Data files (Organization facts + measurement config)

**Files:**
- Create: `src/data/org.json`
- Create: `src/data/site.json`

- [ ] **Step 1: Create `src/data/org.json`**

```json
{
  "name": "Opendream Co., Ltd.",
  "logo": "/media/od_logo.svg",
  "slogan": "Open by Design. Build for Impact.",
  "foundingDate": "2007",
  "email": "info@opendream.co.th",
  "telephone": "+66905598288",
  "sameAs": [
    "https://www.facebook.com/opendream",
    "https://x.com/opendream",
    "https://github.com/opendream"
  ],
  "address": {
    "streetAddress": "349 SJ Infinite One Business Complex, Floor 10, Unit 1004-1005, Vibhavadi-Rangsit Road, Chompol, Chatuchak",
    "addressLocality": "Bangkok",
    "addressRegion": "Bangkok",
    "postalCode": "10900",
    "addressCountry": "TH"
  }
}
```

- [ ] **Step 2: Create `src/data/site.json`** (empty tokens = no analytics/verification output until filled post-deploy)

```json
{
  "cfBeaconToken": "",
  "googleSiteVerification": ""
}
```

- [ ] **Step 3: Commit**

```bash
git add src/data/org.json src/data/site.json
git commit -m "feat(seo): add org facts and measurement config data files"
```

---

## Task 2: Pure SEO helpers (`src/lib/seo.mjs`) — TDD

**Files:**
- Create: `src/lib/seo.mjs`
- Test: `src/lib/seo.test.mjs`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Make Vitest pick up `src` tests** — replace the contents of `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['scripts/**/*.test.mjs', 'src/**/*.test.mjs'] } });
```

- [ ] **Step 2: Write the failing test** — create `src/lib/seo.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import {
  absUrl, resolveOgImage, stripMarkdown, clampDescription, metaDescription,
  organizationLd, websiteLd, blogPostingLd, creativeWorkLd, breadcrumbLd,
  DEFAULT_OG_IMAGE,
} from './seo.mjs';

const SITE = 'https://opendream.co.th';

describe('absUrl', () => {
  it('passes through absolute URLs', () => {
    expect(absUrl(SITE, 'https://x.com/opendream')).toBe('https://x.com/opendream');
  });
  it('joins a site-relative path without doubling slashes', () => {
    expect(absUrl(SITE, '/media/a.png')).toBe('https://opendream.co.th/media/a.png');
    expect(absUrl(SITE + '/', '/media/a.png')).toBe('https://opendream.co.th/media/a.png');
  });
});

describe('resolveOgImage', () => {
  it('prefers explicit image, then cover, then the default', () => {
    expect(resolveOgImage(SITE, { image: '/a.png', cover: '/b.png' })).toBe('https://opendream.co.th/a.png');
    expect(resolveOgImage(SITE, { cover: '/b.png' })).toBe('https://opendream.co.th/b.png');
    expect(resolveOgImage(SITE, {})).toBe('https://opendream.co.th' + DEFAULT_OG_IMAGE);
  });
});

describe('stripMarkdown', () => {
  it('removes images, keeps link text, drops syntax', () => {
    const md = '# Title\n\nSome **bold** and a [link](https://x.com) plus ![alt](/i.png).';
    expect(stripMarkdown(md)).toBe('Title Some bold and a link plus .');
  });
});

describe('clampDescription', () => {
  it('returns short text unchanged', () => {
    expect(clampDescription('hello world', 160)).toBe('hello world');
  });
  it('truncates at a word boundary and adds an ellipsis', () => {
    const out = clampDescription('a'.repeat(50) + ' ' + 'b'.repeat(200), 60);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('metaDescription', () => {
  it('prefers description, then excerpt, then stripped body', () => {
    expect(metaDescription({ description: 'D', excerpt: 'E', body: 'B' })).toBe('D');
    expect(metaDescription({ excerpt: 'E', body: 'B' })).toBe('E');
    expect(metaDescription({ body: '# B body' })).toBe('B body');
    expect(metaDescription({})).toBeUndefined();
  });
});

describe('organizationLd', () => {
  it('builds an Organization with absolute logo + stable @id', () => {
    const ld = organizationLd(SITE);
    expect(ld['@type']).toBe('Organization');
    expect(ld['@id']).toBe('https://opendream.co.th/#organization');
    expect(ld.logo).toBe('https://opendream.co.th/media/od_logo.svg');
    expect(ld.sameAs).toContain('https://x.com/opendream');
    expect(ld.address['@type']).toBe('PostalAddress');
    expect(ld.address.addressCountry).toBe('TH');
  });
});

describe('websiteLd', () => {
  it('references the organization as publisher and sets inLanguage', () => {
    const ld = websiteLd(SITE, 'en');
    expect(ld['@type']).toBe('WebSite');
    expect(ld.inLanguage).toBe('en');
    expect(ld.publisher['@id']).toBe('https://opendream.co.th/#organization');
    expect(ld.potentialAction).toBeUndefined(); // no on-site search -> no SearchAction
  });
});

describe('blogPostingLd', () => {
  it('builds a BlogPosting with absolute image and org author/publisher', () => {
    const ld = blogPostingLd(SITE, {
      path: '/blog/x', title: 'X', description: 'D', image: '/c.png',
      datePublished: '2020-01-01T00:00:00.000Z', lang: 'th', section: 'News',
    });
    expect(ld['@type']).toBe('BlogPosting');
    expect(ld.headline).toBe('X');
    expect(ld.image).toBe('https://opendream.co.th/c.png');
    expect(ld.datePublished).toBe('2020-01-01T00:00:00.000Z');
    expect(ld.author['@id']).toBe('https://opendream.co.th/#organization');
    expect(ld.articleSection).toBe('News');
    expect(ld.inLanguage).toBe('th');
  });
  it('omits image when none provided', () => {
    const ld = blogPostingLd(SITE, { path: '/blog/x', title: 'X', datePublished: 'd', lang: 'th' });
    expect(ld.image).toBeUndefined();
  });
});

describe('creativeWorkLd', () => {
  it('builds a CreativeWork with creator ref and about[] from issues', () => {
    const ld = creativeWorkLd(SITE, { path: '/project/y', title: 'Y', image: '/d.png', issues: ['health'], lang: 'en' });
    expect(ld['@type']).toBe('CreativeWork');
    expect(ld.creator['@id']).toBe('https://opendream.co.th/#organization');
    expect(ld.about).toEqual(['health']);
    expect(ld.url).toBe('https://opendream.co.th/project/y');
  });
});

describe('breadcrumbLd', () => {
  it('numbers positions from 1 and builds absolute item URLs', () => {
    const ld = breadcrumbLd(SITE, [{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }]);
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement[0].position).toBe(1);
    expect(ld.itemListElement[1].item).toBe('https://opendream.co.th/blog');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `docker compose --profile tools run --rm test`
Expected: FAIL — `Failed to resolve import "./seo.mjs"` (module not created yet).

- [ ] **Step 4: Create `src/lib/seo.mjs`**

```js
// Pure SEO helpers: URL resolution, description handling, and schema.org JSON-LD builders.
// No Astro imports — unit-tested in seo.test.mjs. JSON imports work under Vite (Astro + Vitest).
import org from '../data/org.json';

export const DEFAULT_OG_IMAGE = '/media/og-default.png';
const ORG_ID = (site) => absUrl(site, '/#organization');

export function absUrl(site, pathOrUrl) {
  if (!pathOrUrl) return site;
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  const base = site.replace(/\/$/, '');
  return base + (pathOrUrl.startsWith('/') ? pathOrUrl : '/' + pathOrUrl);
}

export function resolveOgImage(site, { image, cover } = {}) {
  return absUrl(site, image || cover || DEFAULT_OG_IMAGE);
}

export function stripMarkdown(md = '') {
  return md
    .replace(/```[\s\S]*?```/g, ' ')        // fenced code blocks
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')   // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> link text
    .replace(/<[^>]+>/g, ' ')               // raw HTML tags
    .replace(/[#>*_`~]+/g, ' ')             // markdown punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

export function clampDescription(text = '', max = 160) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

export function metaDescription({ description, excerpt, body } = {}, max = 160) {
  const source = description || excerpt || stripMarkdown(body || '');
  return source ? clampDescription(source, max) : undefined;
}

export function organizationLd(site) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID(site),
    name: org.name,
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
    publisher: { '@id': ORG_ID(site) },
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
    author: { '@id': ORG_ID(site) },
    publisher: { '@id': ORG_ID(site) },
  };
  if (description) ld.description = description;
  if (image) ld.image = absUrl(site, image);
  if (dateModified) ld.dateModified = dateModified;
  if (section) ld.articleSection = section;
  return ld;
}

export function creativeWorkLd(site, { path, title, image, issues = [], lang }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: title,
    inLanguage: lang === 'en' ? 'en' : 'th',
    url: absUrl(site, path),
    creator: { '@id': ORG_ID(site) },
  };
  if (image) ld.image = absUrl(site, image);
  if (issues.length) ld.about = issues;
  return ld;
}

export function breadcrumbLd(site, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absUrl(site, it.path),
    })),
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `docker compose --profile tools run --rm test`
Expected: PASS — all `seo.test.mjs` cases green, plus the existing `scripts/**` tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/seo.mjs src/lib/seo.test.mjs vitest.config.ts
git commit -m "feat(seo): add pure SEO helpers (urls, descriptions, JSON-LD) with tests"
```

---

## Task 3: `SEO.astro` component

**Files:**
- Create: `src/components/SEO.astro`

- [ ] **Step 1: Create `src/components/SEO.astro`** (renders the full `<head>` contents except font preloads, which stay in BaseLayout)

```astro
---
import site from '../data/site.json';
import { resolveOgImage } from '../lib/seo.mjs';

interface Props {
  title: string;
  description?: string;
  lang: 'th' | 'en';
  path: string;
  image?: string;
  cover?: string;
  imageAlt?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  noindex?: boolean;
  hasAlt?: boolean;
  thHref: string;
  enHref: string;
  jsonLd?: object[];
}

const {
  title, description, lang, path, image, cover, imageAlt,
  type = 'website', publishedTime, modifiedTime, section,
  noindex = false, hasAlt = false, thHref, enHref, jsonLd = [],
} = Astro.props;

const origin = Astro.site?.origin ?? 'https://opendream.co.th';
const canonical = origin + path;
const ogImage = resolveOgImage(origin, { image, cover });
const ogImageAlt = imageAlt ?? title;
const isDefaultImage = ogImage.endsWith('/media/og-default.png');
---
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title}</title>
{description && <meta name="description" content={description} />}
{noindex && <meta name="robots" content="noindex,follow" />}
<link rel="canonical" href={canonical} />
{hasAlt && <link rel="alternate" hreflang="th" href={origin + thHref} />}
{hasAlt && <link rel="alternate" hreflang="en" href={origin + enHref} />}
{hasAlt && <link rel="alternate" hreflang="x-default" href={origin + thHref} />}
<link rel="icon" href="/media/2016/12/opendream-fav.png" />
<link rel="apple-touch-icon" href="/media/2016/12/opendream-fav.png" />

<meta property="og:type" content={type} />
<meta property="og:site_name" content="Opendream" />
<meta property="og:title" content={title} />
{description && <meta property="og:description" content={description} />}
<meta property="og:url" content={canonical} />
<meta property="og:image" content={ogImage} />
<meta property="og:image:alt" content={ogImageAlt} />
{isDefaultImage && <meta property="og:image:width" content="1200" />}
{isDefaultImage && <meta property="og:image:height" content="630" />}
<meta property="og:locale" content={lang === 'th' ? 'th_TH' : 'en_US'} />
{type === 'article' && publishedTime && <meta property="article:published_time" content={publishedTime} />}
{type === 'article' && modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
{type === 'article' && <meta property="article:author" content="Opendream" />}
{type === 'article' && section && <meta property="article:section" content={section} />}

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content={title} />
{description && <meta name="twitter:description" content={description} />}
<meta name="twitter:image" content={ogImage} />

{site.googleSiteVerification && <meta name="google-site-verification" content={site.googleSiteVerification} />}
{jsonLd.map((obj) => <script type="application/ld+json" set:html={JSON.stringify(obj)} />)}
{site.cfBeaconToken && (
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={`{"token": "${site.cfBeaconToken}"}`}></script>
)}
```

- [ ] **Step 2: Commit** (verified end-to-end in Task 4 when BaseLayout uses it)

```bash
git add src/components/SEO.astro
git commit -m "feat(seo): add SEO head component (meta, OG/Twitter, JSON-LD, analytics)"
```

---

## Task 4: Wire `BaseLayout` to render `<SEO/>`

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Replace the entire contents of `src/layouts/BaseLayout.astro`**

```astro
---
import '../styles/global.css';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import SEO from '../components/SEO.astro';
import translations from '../data/translations.json';

interface Props {
  title: string;
  description?: string;
  lang: 'th' | 'en';
  path: string;
  altPath?: string;
  image?: string;
  cover?: string;
  imageAlt?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  noindex?: boolean;
  jsonLd?: object[];
}
const {
  title, description, lang, path, altPath, image, cover, imageAlt,
  type, publishedTime, modifiedTime, section, noindex, jsonLd,
} = Astro.props;

// hreflang/canonical pairing — unchanged logic, now shared with the Header lang switch.
const alt = altPath ?? translations[path as keyof typeof translations];
const fallbackAlt = (() => {
  if (alt) return alt;
  if (lang === 'th') {
    if (path.startsWith('/projects/')) return '/en/projects_en';
    if (path.startsWith('/project/')) return '/en/projects_en';
    if (path.startsWith('/blog/')) return '/en/blogs';
    return '/en/';
  }
  if (path.startsWith('/en/projects_en/')) return '/projects';
  if (path.startsWith('/en/project/')) return '/projects';
  if (path.startsWith('/en/public/')) return '/blog';
  return '/';
})();
const enHref = lang === 'en' ? path : fallbackAlt;
const thHref = lang === 'th' ? path : fallbackAlt;
const hasAlt = Boolean(alt);
---
<!doctype html>
<html lang={lang}>
  <head>
    <SEO
      title={title}
      description={description}
      lang={lang}
      path={path}
      image={image}
      cover={cover}
      imageAlt={imageAlt}
      type={type}
      publishedTime={publishedTime}
      modifiedTime={modifiedTime}
      section={section}
      noindex={noindex}
      hasAlt={hasAlt}
      thHref={thHref}
      enHref={enHref}
      jsonLd={jsonLd}
    />
    <link rel="preload" href="/fonts/noto-sans-thai-looped-thai-400.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/fonts/noto-sans-thai-looped-latin-400.woff2" as="font" type="font/woff2" crossorigin />
  </head>
  <body>
    <div id="page-container">
      <Header lang={lang} thHref={thHref} enHref={enHref} />
      <main><slot /></main>
      <Footer lang={lang} />
    </div>
  </body>
</html>
```

- [ ] **Step 2: Build and verify the head still renders correctly**

Run: `make rebuild`
Then verify the home page head: read `dist/index.html` and confirm it contains exactly one `<title>`, a `<link rel="canonical" href="https://opendream.co.th/">`, `og:image` pointing to `/media/og-default.png` (NOT the favicon), and `twitter:card` = `summary_large_image`.

Run: `grep -c "stylesheet" dist/index.html` — expected: at least 1 (global.css still linked, proving CSS pipeline intact).

- [ ] **Step 3: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "feat(seo): render SEO component from BaseLayout"
```

---

## Task 5: Posts — article OG + BlogPosting/Breadcrumb JSON-LD

**Files:**
- Modify: `src/layouts/PostLayout.astro`
- Modify: `src/pages/[...path].astro`

- [ ] **Step 1: Replace the frontmatter + `<BaseLayout ...>` open tag in `src/layouts/PostLayout.astro`**

Replace the entire file with:

```astro
---
import BaseLayout from './BaseLayout.astro';
import { blogPostingLd, breadcrumbLd } from '../lib/seo.mjs';
interface Props {
  title: string; date: Date; lang: 'th' | 'en'; path: string;
  cover?: string; description?: string; section?: string; modified?: Date;
}
const { title, date, lang, path, cover, description, section, modified } = Astro.props;
const dateStr = date.toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
const origin = Astro.site?.origin ?? 'https://opendream.co.th';
const blogHref = lang === 'en' ? '/en/blogs' : '/blog';
const blogName = lang === 'en' ? 'News' : 'ข่าวสาร';
const homePath = lang === 'en' ? '/en/' : '/';
const jsonLd = [
  blogPostingLd(origin, {
    path, title, description, image: cover,
    datePublished: date.toISOString(),
    dateModified: modified ? modified.toISOString() : undefined,
    lang, section,
  }),
  breadcrumbLd(origin, [
    { name: 'Opendream', path: homePath },
    { name: blogName, path: blogHref },
    { name: title, path },
  ]),
];
---
<BaseLayout
  title={`${title} — Opendream`}
  description={description}
  lang={lang}
  path={path}
  cover={cover}
  type="article"
  publishedTime={date.toISOString()}
  modifiedTime={modified ? modified.toISOString() : undefined}
  section={section}
  jsonLd={jsonLd}
>
  <article class="od-article">
    <h1 class="od-article__title">{title}</h1>
    <p class="od-article__meta"><time datetime={date.toISOString()}>{dateStr}</time></p>
    {cover && <img class="od-article__cover" src={cover} alt={title} />}
    <div class="od-prose"><slot /></div>
  </article>
</BaseLayout>
```

- [ ] **Step 2: Pass `section` + `modified` from the router** — in `src/pages/[...path].astro`, replace the PostLayout branch (the final `: (` block) with:

```astro
) : (
  <PostLayout title={d.title} date={d.date} lang={d.lang} path={d.path} cover={d.cover} description={d.excerpt} section={d.categories?.[0]} modified={d.modified}>
    <Content />
  </PostLayout>
)}
```

- [ ] **Step 3: Build and verify a post**

Run: `make rebuild`
Pick any built post under `dist/blog/` (e.g. `ls dist/blog/*/index.html | head -1`), read it, and confirm: `og:type` is `article`; an `article:published_time` is present; one `<script type="application/ld+json">` contains `"@type":"BlogPosting"` and another contains `"@type":"BreadcrumbList"`; `og:image` is the post cover (or default if it has none), never the favicon.

- [ ] **Step 4: Commit**

```bash
git add src/layouts/PostLayout.astro src/pages/[...path].astro
git commit -m "feat(seo): article OG tags + BlogPosting/Breadcrumb JSON-LD for posts"
```

---

## Task 6: Projects — cover OG + CreativeWork/Breadcrumb JSON-LD

**Files:**
- Modify: `src/layouts/ProjectLayout.astro`

- [ ] **Step 1: Edit `src/layouts/ProjectLayout.astro`** — add imports + JSON-LD to the frontmatter and `cover`/`jsonLd` to the BaseLayout tag.

Add to the top of the frontmatter (after the existing `import BaseLayout` line):

```astro
import { creativeWorkLd, breadcrumbLd } from '../lib/seo.mjs';
```

Add just before the closing `---` of the frontmatter (after the `rows` constant is built):

```astro
const origin = Astro.site?.origin ?? 'https://opendream.co.th';
const projHref = lang === 'en' ? '/en/projects_en' : '/projects';
const projName = lang === 'en' ? 'Projects' : 'งานของเรา';
const homePath = lang === 'en' ? '/en/' : '/';
const jsonLd = [
  creativeWorkLd(origin, { path, title, image: cover, issues, lang }),
  breadcrumbLd(origin, [
    { name: 'Opendream', path: homePath },
    { name: projName, path: projHref },
    { name: title, path },
  ]),
];
```

Replace the existing opening tag:

```astro
<BaseLayout title={`${title} — Opendream`} description={description} lang={lang} path={path}>
```

with:

```astro
<BaseLayout title={`${title} — Opendream`} description={description} lang={lang} path={path} cover={cover} jsonLd={jsonLd}>
```

- [ ] **Step 2: Build and verify a project**

Run: `make rebuild`
Read a built project page (`ls dist/project/*/index.html | head -1`) and confirm a JSON-LD script contains `"@type":"CreativeWork"` and another `"@type":"BreadcrumbList"`, and `og:image` is the cover (or default), not the favicon.

- [ ] **Step 3: Commit**

```bash
git add src/layouts/ProjectLayout.astro
git commit -m "feat(seo): cover OG + CreativeWork/Breadcrumb JSON-LD for projects"
```

---

## Task 7: Home pages — descriptions + Organization/WebSite JSON-LD

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/pages/en/index.astro`

- [ ] **Step 1: Edit `src/pages/index.astro`** — add imports + constants to the frontmatter and `description`/`jsonLd` to the BaseLayout tag.

Add to the frontmatter (after the existing imports):

```astro
import { organizationLd, websiteLd } from '../lib/seo.mjs';
const origin = Astro.site?.origin ?? 'https://opendream.co.th';
const description = 'โอเพ่นดรีมคือสตูดิโอเทคโนโลยีเพื่อสังคมในกรุงเทพฯ ออกแบบและพัฒนาเว็บไซต์ แอปพลิเคชัน และนวัตกรรมดิจิทัลร่วมกับองค์กรที่สร้างผลกระทบเชิงบวก';
const jsonLd = [organizationLd(origin), websiteLd(origin, 'th')];
```

Replace:

```astro
<BaseLayout title="Opendream — Open by Design. Build for Impact." lang="th" path="/" altPath="/en/">
```

with:

```astro
<BaseLayout title="Opendream — Open by Design. Build for Impact." description={description} lang="th" path="/" altPath="/en/" jsonLd={jsonLd}>
```

- [ ] **Step 2: Edit `src/pages/en/index.astro`** — same pattern (note the `../../lib` depth).

Add to the frontmatter (after the existing imports):

```astro
import { organizationLd, websiteLd } from '../../lib/seo.mjs';
const origin = Astro.site?.origin ?? 'https://opendream.co.th';
const description = 'Opendream is a Bangkok-based social-impact technology studio. We design and build websites, apps, and digital innovation with organizations creating positive change.';
const jsonLd = [organizationLd(origin), websiteLd(origin, 'en')];
```

Replace:

```astro
<BaseLayout title="Opendream — Open by Design. Build for Impact." lang="en" path="/en/" altPath="/">
```

with:

```astro
<BaseLayout title="Opendream — Open by Design. Build for Impact." description={description} lang="en" path="/en/" altPath="/" jsonLd={jsonLd}>
```

- [ ] **Step 3: Build and verify both home pages**

Run: `make rebuild`
Read `dist/index.html` and `dist/en/index.html`. Confirm each has a `<meta name="description">`, an `Organization` JSON-LD with the correct `sameAs` socials, and a `WebSite` JSON-LD with the matching `inLanguage` (`th` / `en`).

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/pages/en/index.astro
git commit -m "feat(seo): home descriptions + Organization/WebSite JSON-LD"
```

---

## Task 8: Listings + service pages — descriptions

**Files:**
- Modify: `src/pages/blog/index.astro`, `src/pages/en/blogs/index.astro`
- Modify: `src/pages/projects/index.astro`, `src/pages/en/projects_en/index.astro`
- Modify: `src/pages/projects/[service].astro`, `src/pages/en/projects_en/[service].astro`

- [ ] **Step 1: Add a `description` attribute to each listing's `<BaseLayout>` tag** (exact replacements):

`src/pages/blog/index.astro` — replace
`<BaseLayout title="ข่าวสาร — Opendream" lang="th" path="/blog" altPath="/en/blogs">`
with
`<BaseLayout title="ข่าวสาร — Opendream" description="ข่าวสาร บทความ และมุมมองจากโอเพ่นดรีม เกี่ยวกับเทคโนโลยีเพื่อสังคม การออกแบบ และนวัตกรรมดิจิทัลเพื่อสร้างผลกระทบเชิงบวก" lang="th" path="/blog" altPath="/en/blogs">`

`src/pages/en/blogs/index.astro` — replace
`<BaseLayout title="News — Opendream" lang="en" path="/en/blogs" altPath="/blog">`
with
`<BaseLayout title="News — Opendream" description="News, articles, and perspectives from Opendream on social-impact technology, design, and digital innovation." lang="en" path="/en/blogs" altPath="/blog">`

`src/pages/projects/index.astro` — replace
`<BaseLayout title="งานของเรา — Opendream" lang="th" path="/projects" altPath="/en/projects_en">`
with
`<BaseLayout title="งานของเรา — Opendream" description="ผลงานและโครงการของโอเพ่นดรีม ทั้งเว็บไซต์ แอปพลิเคชัน เกม และนวัตกรรมดิจิทัลที่พัฒนาร่วมกับองค์กรเพื่อสังคม" lang="th" path="/projects" altPath="/en/projects_en">`

`src/pages/en/projects_en/index.astro` — replace
`<BaseLayout title="Projects — Opendream" lang="en" path="/en/projects_en" altPath="/projects">`
with
`<BaseLayout title="Projects — Opendream" description="Selected work and projects by Opendream — websites, apps, games, and digital innovation built with mission-driven organizations." lang="en" path="/en/projects_en" altPath="/projects">`

- [ ] **Step 2: Add `description` to the service pages** (these are template literals using `service.title`):

`src/pages/projects/[service].astro` — replace
`<BaseLayout title={`${service.title} — Opendream`} lang="th" path={path} altPath={service.altPath}>`
with
``<BaseLayout title={`${service.title} — Opendream`} description={`บริการ ${service.title} โดย Opendream ดูตัวอย่างงานและโครงการที่เกี่ยวข้องในหน้าผลงานของเรา`} lang="th" path={path} altPath={service.altPath}>``

`src/pages/en/projects_en/[service].astro` — replace
`<BaseLayout title={`${service.title} — Opendream`} lang="en" path={path} altPath={service.altPath}>`
with
``<BaseLayout title={`${service.title} — Opendream`} description={`${service.title} services by Opendream. See related work and project examples in our portfolio.`} lang="en" path={path} altPath={service.altPath}>``

- [ ] **Step 3: Build and verify**

Run: `make rebuild`
Confirm each of `dist/blog/index.html`, `dist/en/blogs/index.html`, `dist/projects/index.html`, `dist/en/projects_en/index.html`, and one service page (e.g. `dist/projects/chatbot/index.html`) has a non-empty `<meta name="description">`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/blog/index.astro src/pages/en/blogs/index.astro src/pages/projects/index.astro src/pages/en/projects_en/index.astro src/pages/projects/[service].astro src/pages/en/projects_en/[service].astro
git commit -m "feat(seo): meta descriptions for listing and service pages"
```

---

## Task 9: noindex for 404 + styleguide

**Files:**
- Modify: `src/pages/404.astro`
- Modify: `src/pages/styleguide.mdx`
- Modify: `src/layouts/ComposedLayout.astro`

- [ ] **Step 1: 404** — in `src/pages/404.astro`, replace
`<BaseLayout title="ไม่พบหน้านี้ — Opendream" lang="th" path="/404">`
with
`<BaseLayout title="ไม่พบหน้านี้ — Opendream" lang="th" path="/404" noindex={true}>`

- [ ] **Step 2: Pass `noindex` through `ComposedLayout`** (styleguide uses it via `layout:` frontmatter). Replace the frontmatter of `src/layouts/ComposedLayout.astro` with:

```astro
---
import BaseLayout from './BaseLayout.astro';
// For component-composed pages (home/about/contact): the MDX content sits directly in <main>
// so full-bleed components (Hero) and contained ones (Section > .od-container) manage their own
// width — unlike PageLayout's narrow prose column (for policies/plain text).
// Dual-mode: direct props (collection route) or MDX `layout:` frontmatter.
const p = Astro.props;
const fm = (p.frontmatter ?? {}) as Record<string, any>;
const title = p.title ?? fm.title;
const lang = (p.lang ?? fm.lang ?? 'th') as 'th' | 'en';
const path = p.path ?? fm.path;
const description = p.description ?? fm.description;
const noindex = p.noindex ?? fm.noindex ?? false;
---
<BaseLayout title={`${title} — Opendream`} description={description} lang={lang} path={path} noindex={noindex}>
  <slot />
</BaseLayout>
```

- [ ] **Step 3: Mark the styleguide noindex** — in `src/pages/styleguide.mdx`, add `noindex: true` to the frontmatter so it becomes:

```mdx
---
layout: ../layouts/ComposedLayout.astro
title: Component Styleguide
lang: th
path: /styleguide
noindex: true
---
```

- [ ] **Step 4: Build and verify**

Run: `make rebuild`
Confirm `dist/404.html` and `dist/styleguide/index.html` each contain `<meta name="robots" content="noindex,follow">`, and that a normal page (e.g. `dist/index.html`) does NOT.

- [ ] **Step 5: Commit**

```bash
git add src/pages/404.astro src/pages/styleguide.mdx src/layouts/ComposedLayout.astro
git commit -m "feat(seo): noindex the 404 and styleguide pages"
```

---

## Task 10: Default OG share image asset

**Files:**
- Create: `public/media/og-default.png`

- [ ] **Step 1: Convert the supplied artwork to a 1200×630 PNG** (macOS `sips`; `-z` takes height then width)

Run:
```bash
sips -s format png -z 630 1200 "$HOME/Downloads/od-og-default.webp" --out public/media/og-default.png
```

- [ ] **Step 2: Verify the output dimensions + format**

Run:
```bash
sips -g pixelWidth -g pixelHeight -g format public/media/og-default.png
```
Expected: `pixelWidth: 1200`, `pixelHeight: 630`, `format: png`.

- [ ] **Step 3: Commit**

```bash
git add public/media/og-default.png
git commit -m "feat(seo): add 1200x630 default OG share image (PNG)"
```

---

## Task 11: Sitemap i18n + exclude styleguide

**Files:**
- Modify: `astro.config.mjs`

- [ ] **Step 1: Replace the contents of `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://opendream.co.th',
  i18n: {
    defaultLocale: 'th',
    locales: ['th', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'th',
        locales: { th: 'th-TH', en: 'en-US' },
      },
      filter: (page) => !page.includes('/styleguide'),
    }),
    mdx(),
  ],
});
```

- [ ] **Step 2: Build and verify the sitemap**

Run: `make rebuild`
Confirm `dist/sitemap-index.xml` exists and references `sitemap-0.xml`; confirm `dist/sitemap-0.xml` contains `xhtml:link` hreflang alternates and does NOT list any `/styleguide` URL.

Run: `grep -c "styleguide" dist/sitemap-0.xml` — expected: `0`.

- [ ] **Step 3: Commit**

```bash
git add astro.config.mjs
git commit -m "feat(seo): sitemap hreflang i18n + exclude styleguide"
```

---

## Task 12: Alt-text audit (lib + runner) — TDD

**Files:**
- Create: `scripts/lib/alt.mjs`
- Test: `scripts/lib/alt.test.mjs`
- Create: `scripts/audit-alt.mjs`

- [ ] **Step 1: Write the failing test** — create `scripts/lib/alt.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { findEmptyAlt } from './alt.mjs';

describe('findEmptyAlt', () => {
  it('returns image srcs whose alt is empty or whitespace', () => {
    const md = 'a ![](/one.png) b ![ ](/two.png) c ![good](/three.png)';
    expect(findEmptyAlt(md)).toEqual(['/one.png', '/two.png']);
  });
  it('returns [] when all images have alt text', () => {
    expect(findEmptyAlt('![logo](/l.png) ![hero](/h.png)')).toEqual([]);
  });
  it('handles content with no images', () => {
    expect(findEmptyAlt('plain text, no images')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `docker compose --profile tools run --rm test`
Expected: FAIL — cannot resolve `./alt.mjs`.

- [ ] **Step 3: Create `scripts/lib/alt.mjs`**

```js
// Detect markdown images with empty/whitespace alt text. Pure + unit-tested.
export function findEmptyAlt(markdown = '') {
  const out = [];
  const re = /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    if (m[1].trim() === '') out.push(m[2]);
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `docker compose --profile tools run --rm test`
Expected: PASS.

- [ ] **Step 5: Create the runner `scripts/audit-alt.mjs`**

```js
// Report markdown content images with empty alt text, grouped by file.
// Usage: node scripts/audit-alt.mjs
import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { findEmptyAlt } from './lib/alt.mjs';

const ROOT = 'src/content';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(p));
    else if (['.md', '.mdx'].includes(extname(e.name))) files.push(p);
  }
  return files;
}

const files = await walk(ROOT);
let total = 0;
for (const f of files) {
  const empties = findEmptyAlt(await readFile(f, 'utf8'));
  if (empties.length) {
    total += empties.length;
    console.log(`\n${f}  (${empties.length})`);
    for (const src of empties) console.log(`  - ${src}`);
  }
}
console.log(`\n${total} image(s) with empty alt across ${files.length} content files.`);
```

- [ ] **Step 6: Run the audit and record the result**

Run: `docker compose --profile tools run --rm test node scripts/audit-alt.mjs`
(If the `test` service entrypoint is fixed to vitest, run instead via a one-off Node container: `docker compose run --rm --entrypoint node web scripts/audit-alt.mjs` — or run `node scripts/audit-alt.mjs` inside whichever tools container has Node.)
Expected: a list of files + a total count. **Fix the trivially-fixable ones** by editing the markdown to add descriptive `alt` text derived from the figure caption, surrounding heading, or filename. For images where the right alt is unclear, leave them and note the count in the commit message for human follow-up.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/alt.mjs scripts/lib/alt.test.mjs scripts/audit-alt.mjs src/content
git commit -m "feat(seo): alt-text audit tool + fix trivially-fixable empty alts"
```

---

## Task 13: Measurement runbook

**Files:**
- Create: `docs/seo-setup.md`

- [ ] **Step 1: Create `docs/seo-setup.md`**

```markdown
# SEO measurement setup (post-deploy)

Both integrations are **config-gated**: until you fill the values in `src/data/site.json`
and rebuild, no analytics or verification tags are emitted (no tracking, no cookie banner needed).

## 1. Cloudflare Web Analytics (privacy-first, no cookies)

1. Deploy the site to Cloudflare Pages first (separate task).
2. Cloudflare dashboard → Analytics & Logs → Web Analytics → Add a site → enter the domain.
3. Copy the **site token** (the `token` value from the snippet Cloudflare shows).
4. Put it in `src/data/site.json` as `"cfBeaconToken": "<token>"` and rebuild (`make rebuild`).
5. Verify: built pages now include the `static.cloudflareinsights.com/beacon.min.js` script.

(Alternatively, if the site is proxied through Cloudflare, you can enable Web Analytics
automatic injection at the zone level and leave `cfBeaconToken` empty.)

## 2. Google Search Console

1. Go to https://search.google.com/search-console → Add property → URL prefix
   `https://opendream.co.th`.
2. Choose the **HTML tag** verification method; copy the `content` value of the
   `google-site-verification` meta tag.
3. Put it in `src/data/site.json` as `"googleSiteVerification": "<value>"`, rebuild, deploy.
4. Click Verify in Search Console.
5. Submit the sitemap: Sitemaps → enter `sitemap-index.xml` → Submit.
6. Use URL Inspection to request indexing of the home pages (`/` and `/en/`).
7. Monitor Coverage + Performance over the following weeks.

## 3. Validate structured data

- Rich Results Test: https://search.google.com/test/rich-results — test the home page
  (Organization + WebSite), a blog post (BlogPosting + Breadcrumb), and a project
  (CreativeWork + Breadcrumb).
- Fix any errors it reports in `src/lib/seo.mjs` or the relevant layout.
```

- [ ] **Step 2: Commit**

```bash
git add docs/seo-setup.md
git commit -m "docs(seo): post-deploy measurement + structured-data runbook"
```

---

## Task 14: Full-site verification

**Files:** none (verification + final checks)

- [ ] **Step 1: Run the unit tests**

Run: `docker compose --profile tools run --rm test`
Expected: all tests pass (existing `scripts/**` tests + new `src/lib/seo.test.mjs` + `scripts/lib/alt.test.mjs`).

- [ ] **Step 2: Clean build**

Run: `make rebuild`
Expected: build completes with no errors.

- [ ] **Step 3: Regression sweep over `dist/`** — confirm no page uses the favicon as its OG image, every page has a title + description, and JSON-LD is present where expected:

```bash
echo "favicon-as-og (expect 0):"; grep -rl 'og:image" content=".*opendream-fav' dist | wc -l
echo "pages missing description (review list):"; grep -rL '<meta name="description"' dist --include=index.html
echo "Organization LD on home (expect >=1 each):"; grep -c '"Organization"' dist/index.html dist/en/index.html
echo "BlogPosting LD across posts (expect >0):"; grep -rl '"BlogPosting"' dist/blog | wc -l
echo "CreativeWork LD across projects (expect >0):"; grep -rl '"CreativeWork"' dist/project | wc -l
echo "x-default hreflang present (expect >0):"; grep -rl 'hreflang="x-default"' dist | wc -l
```
Expected: favicon-as-og = 0; the "missing description" list is empty (or only intentional pages); Organization counts ≥1; BlogPosting/CreativeWork counts > 0; x-default > 0.

- [ ] **Step 4: Validate JSON-LD parses** — spot-check that the JSON-LD on the home page is valid JSON:

```bash
grep -o '<script type="application/ld+json">[^<]*</script>' dist/index.html | sed -E 's/<[^>]+>//g' | head -1 | python3 -c 'import sys,json; json.loads(sys.stdin.read()); print("valid JSON-LD")'
```
Expected: `valid JSON-LD`.

- [ ] **Step 5: Human visual + social-preview check (manual)**

Open `http://localhost:4321` (TH home), `/en/`, a post, and a project. Confirm pages look unchanged from before. After deploy, paste a few URLs into the Facebook Sharing Debugger and LINE/Slack to confirm the share card shows the cover or the branded default — not the tiny favicon.

- [ ] **Step 6: Final commit (if any alt fixes or tweaks remain uncommitted)**

```bash
git add -A
git commit -m "chore(seo): final verification pass" || echo "nothing to commit"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- §4.1 SEO component → Tasks 3–4 ✓
- §4.2 social images (default PNG, og:image:alt/width/height, summary_large_image, twitter:*) → Tasks 3, 10 ✓
- §4.3 article metadata → Task 5 ✓
- §4.4 descriptions everywhere → Tasks 7 (home), 8 (listings/services); posts/projects use `excerpt` already passed via `[...path].astro`/layouts ✓
- §4.5 JSON-LD (Organization, WebSite no SearchAction, BlogPosting, CreativeWork, BreadcrumbList) → Tasks 2 (builders), 5, 6, 7 ✓
- §4.6 robots noindex + x-default → Tasks 9, 3 ✓
- §4.7 sitemap i18n → Task 11 ✓
- §4.8 alt-text audit → Task 12 ✓
- §4.9 testing → Tasks 2, 12 (unit) + Task 14 (build/regression) ✓
- §6 measurement (Cloudflare Web Analytics + Search Console, config-gated) → Tasks 1 (config), 3 (render), 13 (runbook) ✓

**Placeholder scan:** No "TBD"/"add error handling"-style gaps; every code step has complete code. Descriptions are real copy (Phase 4 may later refine, but they ship complete and valid).

**Type consistency:** Helper signatures are `fn(site, {options})`; layouts call them with `origin` + an options object matching the tested shapes. Prop names (`cover`, `type`, `publishedTime`, `modifiedTime`, `section`, `noindex`, `jsonLd`) are consistent across `SEO.astro`, `BaseLayout.astro`, and the layouts/pages that set them.

**Out of scope (separate flows):** Phase 2 `seo-audit` skill (skill-creator); Phase 4 keyword strategy (deep-research); Cloudflare Pages deploy.
