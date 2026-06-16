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
  route in `[...path].astro`; header search box removed). Pending: human visual check of 3a+3b. **3c** ~17 service pages + faithful `/projects` filterable-portfolio design; **3d** ~14
  privacy policies → markdown. See `docs/2026-06-16-static-migration-phase3a-spec.md` + `-plan.md`.
- **Deploy (Cloudflare Pages)** — deferred until the whole site is converted.

## When making changes

- Preserve the faithful-replica intent and original URLs.
- Add content as markdown with the established frontmatter (`title, date, lang, slug, path,
  categories, tags, cover, excerpt`).
- Keep `node_modules`/`dist`/`.astro` out of git (see `.gitignore`); the build creates them in Docker.
