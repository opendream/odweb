# Post-cutover report — opendream.co.th

**Date:** 2026-06-20 · **Status:** ✅ Live & verified

The WordPress → static **Astro** migration is complete. `https://opendream.co.th` now serves the new
site from **Cloudflare Workers (static assets)**; the legacy WordPress origin is retired. This report
records the cutover and a full sweep of the live apex.

## What shipped

- **Astro 6 / Node 22**, fully static (`dist/`), bilingual TH/EN, content as markdown/MDX in git.
- **De-Divi complete** — clean `.od-*` design system, ~15 KB CSS, no third-party CDNs.
- **SEO**: per-page metadata, Open Graph (with a branded default image), Twitter cards, JSON-LD
  (Organization/WebSite/BlogPosting/CreativeWork/Breadcrumb), hreflang, a custom apex/non-trailing
  sitemap.
- **Deploy-aware origin** (`src/lib/site.mjs`): apex canonicals in production; per-branch
  `*-odweb.workers.dev` preview URLs (auto-`noindex`ed) for non-production branches.
- **Measurement**: Cloudflare Web Analytics (manual beacon, production-only) + Google Search Console
  (DNS-verified Domain property).
- **Toolchain hygiene**: 0 Dependabot alerts; `npm audit` clean.

## Cutover actions (2026-06-20)

1. Deleted the apex `A` record (WordPress origin `167.99.70.18`) and attached **`opendream.co.th`** as
   the `odweb` Worker custom domain → apex serves the new site.
2. **`www → apex` 301** Cloudflare Redirect Rule (path + query preserved).
3. Disabled the old WordPress auto-install Web Analytics property (no double-count); the new manual
   beacon (production-only) is the single source.
4. Preserved **email (MX ×5)** and **all verification TXTs** (Google ×2, Anthropic, Slack, 1Password,
   SPF) throughout.

## Live sweep results

| Check | Result |
|---|---|
| All sitemap URLs (213) | **213 / 213 → 200** ✓ |
| `www → apex` | 301 ✓ · `http → https` 301 ✓ |
| Trailing slash | `/blog` → 200; `/blog/` → 307 → `/blog` (benign) |
| Canonicals | apex, non-trailing, on every sampled page ✓ |
| `og:image` | resolves (200) — covers on posts/projects, branded default elsewhere ✓ |
| JSON-LD | valid; Organization+WebSite (home), BlogPosting+Breadcrumb (posts), CreativeWork+Breadcrumb (projects) ✓ |
| hreflang | present on paired pages (home, projects, designed pages) ✓ |
| Indexability | production pages indexable; `/styleguide` + 404 `noindex` ✓ |
| favicon-as-og regression | 0 ✓ |
| robots.txt / sitemap-index | 200 `text/plain` / 200 `application/xml`, points to sitemap ✓ |
| 404 | styled `404.html`, HTTP 404 ✓ |
| Analytics beacon | present (production) ✓ |
| Email + verification | MX ×5, google-site-verification ×2 intact ✓ |

## Known / minor items (non-blocking)

- **Single-language posts omit hreflang.** Most TH blog posts have no EN counterpart, so no hreflang
  is emitted (correct — hreflang only applies when a translation exists). Paired pages (home,
  projects, designed pages) have full TH/EN/x-default hreflang.
- **Designed pages (about/contact/join-us/announcement) carry no JSON-LD.** Optional future
  enhancement: add `WebPage`/`AboutPage`/`ContactPage` schema.
- **`/blog/` → `/blog` uses 307** (Cloudflare `drop-trailing-slash` default) rather than 308. Benign:
  the canonical (non-trailing) form serves 200 and is what's indexed/linked.

## Operating the site

- **Develop**: `make up` (localhost:4321), `make rebuild`, `make test`. Everything in Docker.
- **Release**: `make release` — fast-forwards `production` (protected branch) to a tested `main`;
  Cloudflare Workers Builds deploys it. Roll back via the Cloudflare dashboard.
- **Preview**: pushes to `main` build `main-odweb.opendream.workers.dev` (noindexed).
- See `CLAUDE.md` / `AGENTS.md` for full detail and `docs/seo-setup.md` for measurement.

## Follow-ups (owner)

- Re-submit `sitemap-index.xml` in Google Search Console (the earlier "couldn't fetch" was a stale
  pre-cutover attempt; the sitemap serves correctly now) and monitor the `www → apex` re-consolidation.
- Scope-down or revoke the Cloudflare API token used for the cutover (least privilege).
