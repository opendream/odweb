# Static Migration — Phase 1 Spec: Foundation, Design System & Posts

**Date:** 2026-06-16
**Status:** draft for review
**Project:** migrate opendream.co.th (WordPress) → static site

## Locked decisions (from brainstorming)

- **SSG:** Astro · **Host:** Cloudflare Pages
- **Design:** faithful replica of the current look (`opendraemrises` / Divi)
- **Scope (overall):** full parity — all pages, ~60 posts, 92 projects, both TH + EN
- **i18n:** Thai is default at `/`; English at `/en/` (mirrors current)
- **Content:** markdown-in-git, edited by developers
- **Conversion:** render-and-scrape the local Docker site (it renders Divi correctly)
- **Contact form:** replace with an email link (implemented in a later phase)
- **Source of truth:** `backups/20260616-clean-final/`, served locally at `http://localhost:8080` via `local/` (WP 5.7.15, clean verified snapshot).

This spec covers **Phase 1 only**. Later phases (separate specs): P2 projects, P3 designed
pages incl. home, P4 SEO/redirects + DNS cutover + WP decommission.

## Goal & success criteria

Prove the end-to-end approach on the smallest *complete* vertical slice: Astro foundation +
faithful global chrome + the extraction pipeline + the **posts** content type (both languages),
deployed to a Cloudflare Pages preview.

**Done when, on the CF Pages preview:**
1. Blog listing + individual post pages render for **both TH and EN**.
2. They **visually match** the current site's post pages (header, footer, nav, typography, post body) to a reasonable fidelity.
3. URLs **preserve the WP paths** (TH at `/…`, EN at `/en/…`, from each post's original `link`).
4. Post images and inline media load — **no broken assets**.
5. `<title>`, meta description, `lang`, and **hreflang** (TH↔EN) are present.
6. Clean `astro build` (no errors); basic Lighthouse sanity.

## Scope

**In:** Astro scaffold; i18n routing; global design system (Header, Footer, TH/EN Nav,
LangSwitcher, typography, colors, base CSS distilled from Divi); REST extraction pipeline limited
to **posts + their media + nav menus**; `posts` content collection (TH+EN); blog listing + post
detail pages; deploy to a CF Pages **preview** via Wrangler direct upload.

**Out (later phases):** projects, designed pages/home, full redirect map, DNS cutover, WP
decommission, CMS, site search, category/tag archives beyond what the posts listing needs.

## Project layout

New Astro project at **`site/`** in this workspace (alongside `local/`, `backups/`, `docs/`).

```
site/
  astro.config.mjs            # i18n: defaultLocale 'th', locales ['th','en'], prefixDefaultLocale:false; @astrojs/sitemap
  package.json
  scripts/
    extract.mjs               # REST extraction → markdown + media + nav data (one-off, re-runnable)
  src/
    content/
      config.ts               # zod schema for the `posts` collection
      posts/{th,en}/<slug>.md  # generated
    data/nav.{th,en}.json     # generated nav menus
    layouts/{BaseLayout,PostLayout}.astro
    components/{Header,Footer,Nav,LangSwitcher,PostCard}.astro
    pages/
      index.astro             # placeholder home (real home = P3)
      [...path].astro         # TH post routes keyed off frontmatter path
      en/[...path].astro       # EN post routes
      blog/index.astro + en/blog/index.astro   # listings (paths adjusted to match WP)
    styles/global.css         # distilled theme CSS + self-hosted fonts
  public/
    media/…                   # copied uploads referenced by posts
```
Exact routing mechanics finalized in the implementation plan.

## Extraction pipeline (`scripts/extract.mjs`)

- **Precondition:** on the local Docker copy only, `wp plugin deactivate disable-json-api`
  (verified: REST then returns 200 for posts/projects, both languages). Reactivate after, or keep
  an "extraction mode" toggle. **Never touch prod.** Local is disposable (rebuild from the
  canonical backup via `local/setup.sh`).
- **Source:** `http://localhost:8080/wp-json/wp/v2/`.
- For each language (`?lang=th`, `?lang=en`), paginate `GET /posts?per_page=100&_embed` and capture:
  `id, slug, date, modified, link, title.rendered, content.rendered, excerpt.rendered, categories,
  tags, featured media URL (via _embed)`.
- **Convert** `content.rendered` (Divi-rendered HTML) → markdown for prose (e.g. Turndown/rehype),
  preserving inline HTML where layout requires; strip Divi wrapper cruft.
- **Download** referenced media (featured + inline `<img>`) into `public/media/…`, rewriting URLs
  to site-relative paths.
- **Write** `src/content/posts/<lang>/<slug>.md` with frontmatter:
  `title, date, modified, lang, slug, path (original WP link path, host-stripped), categories,
  tags, cover, excerpt`.
- **Nav menus:** export the TH and EN menus (via `wp menu item list` over wp-cli, or REST) →
  `src/data/nav.<lang>.json` for the Nav component.
- Idempotent and re-runnable; output is committed content so builds have **no live dependency**.

## Design system / faithful chrome

- Identify the global look from the rendered local site: header, footer, primary nav (TH/EN),
  fonts, colors, and the single-post template styling.
- **Port the CSS:** take Divi/`opendraemrises` compiled CSS and distill the subset used by the
  chrome + post pages (don't ship all of Divi). Strategy: port post-relevant CSS wholesale first
  for fidelity, trim later.
- **Components:** `BaseLayout` (head: title/meta/hreflang/lang), `Header`, `Footer`, `Nav`
  (lang-aware), `LangSwitcher`, `PostCard`, `PostLayout`.
- **Fonts:** self-host the theme's fonts.

## i18n / routing

- Astro i18n: `defaultLocale: 'th'` (no prefix → `/`), `en` prefixed (`/en/`).
- **Preserve WP post paths:** route off each post's original `link` path (e.g. `/public/<slug>`,
  `/en/public/<slug>`) via a catch-all keyed on the frontmatter `path`, so URLs match today.
- Per-locale nav; `hreflang` alternates linking TH↔EN equivalents (pairing captured from REST
  where available, else the switcher links to the localized blog listing).

## Deploy (Phase 1)

- `astro build` → `site/dist/`.
- `wrangler pages deploy site/dist` → Cloudflare Pages **preview** (`*.pages.dev`). **No git repo
  required yet** (honors "no git for now"); **no DNS changes** (cutover is P4).

## Verification

- `astro build` clean.
- Pipeline sanity: extracted post count per language == published-post count per language in WP
  (cross-check against the DB: TH/EN totals).
- Visual spot-check ~5 TH + ~5 EN post pages vs the local/live site (chrome + typography + images).
- URL check: sample post paths match the original WP `link` paths (host-stripped); EN under `/en/`.
- Asset check: no 404s for images/fonts/CSS on the preview.
- `<title>`, meta description, and `hreflang` present.

## Risks / notes

- **CSS distillation** (faithful-but-lean) is the main effort; mitigate by porting post-relevant
  CSS wholesale first, optimizing later.
- **TH↔EN pairing** for the lang switcher relies on Polylang translation links; fall back to the
  localized listing if a pair is missing.
- **Media:** only posts' media in P1 (a small slice of the 2.5 GB).
- The REST-blocking plugin is toggled **on the local extraction copy only**.

## Explicitly out of scope

Projects, pages/home, full redirect map, DNS cutover, WP decommission, CMS, search.
