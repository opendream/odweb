# CLAUDE.md

This file guides Claude Code (claude.ai/code) when working in this repository — the Astro
static rebuild of **opendream.co.th**.

## What this is

A faithful static rebuild of opendream.co.th (a bilingual **TH/EN** site, originally WordPress)
in **Astro**, intended to replace WordPress. Built and served entirely in **Docker**; content is
**markdown-in-git**. The original site's design is reproduced faithfully.

## Stack & conventions

- **Astro 5** (static output), served by **nginx** in Docker.
- **i18n:** Thai is the default at `/`; English at `/en/` (mirrors the original).
- **URL preservation:** each content entry keeps its original URL via its frontmatter `path`;
  `src/pages/[...path].astro` routes posts at those exact paths.
- **Faithful replica:** theme CSS (Divi-based `opendraemrises`) is ported into
  `src/styles/vendor/`; fonts self-hosted in `public/fonts`.
- **Content:** markdown in `src/content/posts/{th,en}/` (schema in `src/content.config.ts`);
  media in `public/media`; nav menus in `src/data/nav.{th,en}.json`.

## Dev workflow (Docker — the host needs only Docker)

```bash
docker compose up -d --build          # build dist/ + serve at http://localhost:4321
docker compose up -d --build web      # rebuild after content/code changes
docker compose down                   # stop
docker compose --profile tools run --rm test     # Vitest pipeline tests
```
Regenerating content from the WordPress source (the local dev WordPress stack) uses the
`extract` service — see `README.md`. Builds have **no build-time dependency** on WordPress; the
committed markdown + media are the source of truth.

## Content pipeline

- `scripts/extract.mjs` reads the WordPress source's REST API and writes markdown + downloads
  media. Pure transforms (HTML→markdown, URL/path rewriting, frontmatter) live in
  `scripts/lib/convert.mjs` and are unit-tested (`scripts/lib/convert.test.mjs`).
- Run the tests after changing `convert.mjs`.

## Structure

- `src/layouts/` — `BaseLayout` (head/meta/hreflang), `PostLayout`.
- `src/components/` — `Header`, `Footer`, `Nav`, `LangSwitcher`, `PostCard`.
- `src/pages/` — `[...path].astro` (post detail, path-preserving), `blog/` + `en/blogs/` listings, `index.astro`.
- `scripts/` — extraction + tested transform lib. `public/` — media + fonts.
- `Dockerfile` (multi-stage Node→nginx), `docker-compose.yml`, `nginx.conf`.

## Migration phases

- **Phase 1 — DONE:** foundation + i18n + design system + extraction pipeline + all posts
  (TH/EN) rendering at preserved URLs. See `docs/2026-06-16-static-migration-phase1-spec.md`
  and `docs/2026-06-16-static-migration-phase1-plan.md`.
- **Phase 2 — DONE:** all 92 projects (52 TH / 40 EN) rendering at preserved `/project/<slug>`
  URLs via `ProjectLayout`, plus `/projects` + `/en/projects_en` listings with a client-side
  category filter (`ProjectCard` grid). Detail bodies are markdown. See
  `docs/2026-06-16-static-migration-phase2-spec.md` and `-plan.md`. *Deferred to Phase 3: the
  pixel-faithful Divi filterable-portfolio design for the listings.*
- **Phase 3 — designed pages + home** (preserve rendered Divi HTML + per-page CSS, not markdown).
  Decomposed: **3a home — DONE** (scrape pipeline `scripts/extract-pages.mjs` + `scripts/lib/pages.mjs`;
  home TH `/` + EN `/en/` rendered from `src/content/pages/**` + `src/styles/pages/**`, Divi assets
  mirrored under `public/wp-content/`; `BaseLayout` gained `pageStyles`+`bodyClass`; nginx `absolute_redirect off` keeps link host:port).
  **3b core pages — DONE** (about/contact/join-us/announcement TH+EN via the generic manifest-driven
  route in `[...path].astro`; header search box removed).
  **3c service pages + faithful projects — DONE** (33 service pages — TH `/projects/<slug>`, EN
  `/en/projects_en/<slug>` — via the preserve-HTML pipeline; the `/projects` + `/en/projects_en`
  landings rebuilt as data-driven Divi filterable-portfolio grids — `ProjectCard` emits
  `et_pb_portfolio_item` markup styled by the global `divi-parent.css`, filtered by the 4 sector
  categories via tested `scripts/lib/categories.mjs`. The landings' two trailing sections after the
  grid — a parallax strip + an "Our Clients" logos section — are restored from the scraped landing
  HTML via `scripts/extract-trailing.mjs` → `*-trailing.html` partials rendered after the portfolio.)
  **3d policy pages — DONE** (15 privacy/policy pages render-scraped from `article .entry-content` →
  markdown in the `policies` collection via `scripts/extract-content-pages.mjs` + `extractEntryContent`;
  rendered as prose by the new minimal `PageLayout`, routed by `[...path].astro` kind `policy`; lang per
  page from `<html lang>`; `blueflagshops` dropped by decision). **Content conversion is now complete.**
  **Pre-deploy polish — DONE** (robots.txt + auto sitemap + custom 404 + favicon/OG meta;
  per-page TH↔EN hreflang pairing via `scripts/extract-translations.mjs` → `src/data/translations.json`
  consulted by `BaseLayout` + threaded to the lang switcher, listing-fallback when unpaired; safe
  PurgeCSS pass — see Global CSS note). Pending: human visual check; then Cloudflare Pages deploy.
  See `docs/2026-06-17-static-migration-phase3{c,d}-spec.md`, `-pre-deploy-polish-plan.md`.
- **Global CSS note:** `src/styles/global.css` imports `vendor/divi-parent.css` (the full Divi theme
  stylesheet, ~825 KB — the base `.et_pb_row` grid + responsive `@media`; without it designed pages
  box left). Divi's JS-driven reveal animations are neutralised site-wide
  (`.et-waypoint, .et_animated { opacity: 1 !important }`) since there's no Divi JS. The `build` script
  runs `scripts/purge-css.mjs` (PurgeCSS) after `astro build`, trimming the bundle 852 KB → ~165 KB
  (88 KB → 22 KB gzipped) with a Divi-aware safelist; per-page inline `et-core-unified` styles are untouched.
- **Modernisation (de-Divi), in progress — phased.** We're progressively replacing the ported Divi
  scaffolding/classes with a clean design system in `src/styles/modern.css` (`.od-*`), on the surfaces
  we control. **Done:** the **chrome** (Header/Footer/Nav/LangSwitcher rebuilt clean — sticky `.od-header`,
  animated hamburger → dropdown nav, `.od-footer`; no `#main-header`/`#top-menu`/`et_pb_*`, no body-class
  coupling, no fixed-header `#page-container` offset) and the **listings** (`/projects` = centered
  `.od-container` + centered pill `.od-filter` + 1:1 `.od-card` grid w/ hover; `/blog` = `.od-postgrid`
  of `.od-postcard` under `BlogHero`). PurgeCSS safelist keeps `/^od-/`. **Also done:** detail layouts
  (Post/Project/Page prose); the bespoke **home** (`index.astro` + `/en/`, showcase tiles from
  `src/data/projects.config.json`, 1:1 covers w/ deterministic gradient placeholders via
  `src/lib/gradient.mjs`); and **Phase 4 — the designed pages** (`about-us`/`contact`/`join-us`/
  `announcement` TH + `about_en`/`contact_en`/`join-us_en` EN) converted from preserved Divi HTML to
  **MDX** in the new `pages` collection, composed from the `.od-*` content components
  (`src/components/content/*`) and rendered by `ComposedLayout` (route kind `page-mdx` in
  `[...path].astro`, which passes the components to `<Content/>` so MDX needs no per-file imports).
  The parallax + "Our Clients" logos sections were dropped by decision. See
  `docs/2026-06-18-content-architecture-spec.md` + `-phase4-pages-plan.md`. **Remaining = Phase 5
  cleanup:** drop the ~33 `services` pages (`/projects/<slug>`, `/en/projects_en/<slug>`) + their
  manifest/HTML/CSS, then remove `vendor/divi-parent.css`, the PurgeCSS step, and `DEFAULT_BODY_CLASS`
  (the lone remaining Divi leak — a stale `et_pb_*` class string still applied to `<body>`).
- **Global CSS note (legacy/Divi):** `vendor/divi-parent.css` (full Divi theme) still backs the
  not-yet-modernised surfaces (designed pages, detail layouts). Divi reveal animations neutralised
  (`.et-waypoint,.et_animated{opacity:1!important}`); designed-page grids that relied on isotope/salvattore
  JS are laid out with plain CSS.
- **Deploy (Cloudflare Pages)** — deferred until the whole site is converted.

## When making changes

- Preserve the faithful-replica intent and original URLs.
- Add content as markdown with the established frontmatter (`title, date, lang, slug, path,
  categories, tags, cover, excerpt`).
- Keep `node_modules`/`dist`/`.astro` out of git (see `.gitignore`); the build creates them in Docker.
