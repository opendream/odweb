# SEO Improvements — Design Spec

**Date:** 2026-06-19
**Repo:** `opendream/odweb` (Astro static rebuild of opendream.co.th)
**Status:** Approved scope; pending spec review.

## 1. Context & goals

The Astro rebuild has a solid technical *foundation* (sitemap, canonicals, hreflang, basic
Open Graph, fast static delivery) but is missing the *rich metadata* and *measurement* that drive
discovery and click-through. The site is bilingual TH/EN and not yet in production (the live
`opendream.co.th` is still WordPress), so this work bakes SEO in **before cutover** — the right time.

**Business goals (all four, per the user):** win clients & partners, showcase portfolio &
credibility, grow blog/thought-leadership reach, support recruiting. **Market:** bilingual, TH and
EN weighted equally. **Analytics:** Cloudflare Web Analytics (privacy-first, no cookie banner →
PDPA-clean); no GA4. **Deliverable for the "skill" ask:** a reusable repo `seo-audit` skill.

## 2. Decisions (locked)

| Decision | Value |
|---|---|
| Scope | On-page technical + measurement + bilingual keyword strategy + reusable skill |
| Analytics | Cloudflare Web Analytics only (no GA4, no consent banner) |
| Market | Bilingual TH/EN, equal weight |
| Skill | Build a repo `seo-audit` skill via skill-creator |
| Org logo | `/media/od_logo.svg` |
| Phase order | 1 Technical → 2 Skill → 3 Measurement → 4 Strategy |

## 3. Organization facts (verified from footer + contact page)

- **Name:** Opendream Co., Ltd. (TH: บริษัท โอเพ่นดรีม จำกัด)
- **Logo:** `/media/od_logo.svg`
- **Founded:** 2007
- **Slogan:** "Open by Design. Build for Impact."
- **sameAs:** `https://www.facebook.com/opendream`, `https://x.com/opendream`, `https://github.com/opendream`
- **Address:** 349 SJ Infinite One Business Complex, Floor 10 Unit 1004-1005, Vibhavadi-Rangsit Rd, Chompol, Chatuchak, Bangkok 10900, Thailand
- **Tel:** +66.90.559.8288 · **Email:** info@opendream.co.th (public business contact; will appear de-obfuscated only inside JSON-LD)
- **Geo:** 13.8097085, 100.5563118

---

## 4. Phase 1 — On-page technical SEO (code)

### 4.1 Extract head metadata into an `SEO` component
Create `src/components/SEO.astro` holding everything currently in `BaseLayout`'s `<head>` plus the
new fields. `BaseLayout` keeps its current props and passes them through, gaining:

```
Props: title, description?, lang, path, altPath?,
       image?         // absolute or site-relative; defaults to /media/og-default.png
       imageAlt?
       type?          // 'website' | 'article'   (default 'website')
       publishedTime? // ISO; only when type='article'
       section?       // category label; only when type='article'
       noindex?       // boolean -> <meta name="robots" content="noindex,follow">
```

Rationale: one place builds all meta, so the audit skill and every layout share one source of truth.
`BaseLayout` is currently the only head owner, so the change is localized and the existing
canonical/hreflang logic moves verbatim.

### 4.2 Social images (Open Graph + Twitter)
- `og:image` resolves to: page `image` → else the post/project `cover` → else
  `/media/og-default.png`. Always emitted as an **absolute** URL.
- Add `og:image:alt`. Add `og:image:width`/`height` **only for the default image** (known 1200×630);
  omit for covers (unknown dimensions — wrong dims are worse than none).
- Twitter: change `summary` → **`summary_large_image`**; add `twitter:title`, `twitter:description`,
  `twitter:image`.
- **New asset:** `public/media/og-default.png`, 1200×630, branded (logo + slogan on brand
  background). Raster (PNG) — LINE/Facebook do not render SVG OG images. Generated as a build/one-off
  step from the SVG logo; committed to the repo.

### 4.3 Article metadata for posts
When `type='article'` (posts): emit `og:type=article`, `article:published_time` (post date),
`article:author` = "Opendream", `article:section` = first category. `PostLayout` passes
`type="article"`, `publishedTime`, `section`, and `image={cover}`.

### 4.4 Meta descriptions everywhere
Pages currently missing a description get one:
- **Home TH `/` and EN `/en/`** — hand-written, keyword-aware (the two most important pages).
- **Listings** (`/blog`, `/en/blogs`, `/projects`, `/en/projects_en`) — hand-written.
- **Project-service pages** (`projects/[service]`, `en/projects_en/[service]`) — derive from service
  data; add a fallback string per service.
- **Posts/projects** — use frontmatter `excerpt`; fallback = first ~155 chars of body text.
Target length 120–160 chars; the audit skill flags violations.

### 4.5 Structured data (JSON-LD)
Emitted via the `SEO` component (or a small `JsonLd.astro` helper). All `@id`-linked to the
Organization where relevant.
- **`Organization`** (home, both langs): name, url, logo, slogan, foundingDate, sameAs[],
  address (PostalAddress), telephone, email.
- **`WebSite`** (home): name, url, inLanguage. **No `SearchAction`** — the site has no on-site
  search; claiming one violates Google guidance.
- **`BlogPosting`** (posts): headline, datePublished, image, author (Opendream), publisher
  (Organization ref), mainEntityOfPage, inLanguage.
- **`CreativeWork`** (projects): name, image, about (issues), inLanguage, creator (Organization
  ref). (`CreativeWork` not `SoftwareApplication` — the latter needs offers/ratings to be useful.)
- **`BreadcrumbList`** (posts & projects): Home → Listing → Current.

### 4.6 Robots + hreflang polish
- `noindex,follow` on `/styleguide` and `/404` (styleguide is already `Disallow`-ed in robots.txt;
  add the meta tag too for defense in depth).
- Add **`hreflang="x-default"`** alternate (points to the TH/default URL) alongside `th`/`en`.

### 4.7 Sitemap upgrade
Configure `@astrojs/sitemap` with the **i18n** option (defaultLocale `th`, locales `th`/`en`) so the
sitemap emits per-URL hreflang links, and confirm `lastmod` is present. Keep `/styleguide` excluded
via the sitemap `filter`.

### 4.8 Image alt-text audit
Inline content images imported from WordPress often have empty/missing `alt`. Audit at **transform
time** in `scripts/`: report images with empty alt across `src/content/`; fill obvious ones (derive
from filename/figure caption/post title) and list the rest for human review. The `seo-audit` skill
(Phase 2) also catches these in `dist/`.

### 4.9 Phase 1 testing
- Extend the Vitest pipeline tests: assert every built page has a non-empty `<title>` and
  `description`, a canonical, and (posts/projects) an `og:image` that is **not** the favicon.
- Build `dist/` and grep for: zero pages with the favicon as `og:image`; valid JSON-LD parses on a
  sample post/project/home; hreflang includes `x-default`.

---

## 5. Phase 2 — Reusable `seo-audit` skill (skill-creator)

A repo skill that builds `dist/` then scans the HTML and reports, prioritized:
- Missing / duplicate / over-/under-length `<title>` and `meta description`.
- Missing `canonical`, `og:image`, `og:title`/`description`, or JSON-LD.
- `og:image` still pointing at the favicon (regression guard).
- `<img>` with empty/missing `alt`.
- Broken hreflang pairing (a page claims an alternate that 404s / isn't in the sitemap).
- Sitemap + robots presence and sitemap reference correctness.
- Output: a grouped report (Critical / Warning / Info) with file paths and counts.

Built **after** Phase 1 so its checks match the exact conventions we settled. Lives in the repo's
skills location; documented in the site README.

---

## 6. Phase 3 — Measurement

- **Cloudflare Web Analytics:** add the beacon `<script defer src=".../beacon.min.js"
  data-cf-beacon='{"token":"__CF_BEACON_TOKEN__"}'>` gated behind a config value
  (`src/data/site.config` or env) so it's empty/no-op until the real token is filled post-deploy.
  No cookies → no PDPA consent banner.
- **Google Search Console:** add a verification `<meta name="google-site-verification">` placeholder
  (config-gated), plus a written **setup checklist**: create property, verify, submit
  `sitemap-index.xml`, request indexing, monitor coverage.
- Documented in a `docs/seo-setup.md` post-deploy runbook.

---

## 7. Phase 4 — Bilingual keyword strategy (deep-research)

- Keyword + competitor research across the four goals × TH/EN using the `deep-research` skill.
- Per-page **title + meta-description recommendations** for money pages: home, service pages, top
  projects, key posts. (Recommendations feed back into Phase 1 fields.)
- Internal-linking and blog-topic-gap suggestions.
- Delivered as `docs/seo-strategy.md` for user review; iterative.

---

## 8. Out of scope / non-goals
- GA4 and any cookie-consent UI (explicitly declined).
- Production domain cutover and Cloudflare Pages deploy (separate, already-tracked task).
- Paid SEO tooling/subscriptions; backlink outreach.
- Rewriting page *content* beyond titles/descriptions (Phase 4 recommends; large rewrites are
  separate work).

## 9. Risks & mitigations
- **OG image generation** needs a raster step; mitigate by committing a single static
  `og-default.png` (no per-page dynamic generation in v1).
- **JSON-LD email exposure** — business email is already public on the contact page; acceptable.
- **hreflang x-default / pairing** — existing `translations.json` is incomplete; audit skill flags
  unpaired pages so the listing fallback is intentional, not silent breakage.
- **Author data** — posts lack per-author frontmatter; default author = "Opendream" org (documented,
  not guessed per post).
