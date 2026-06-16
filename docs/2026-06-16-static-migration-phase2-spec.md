# Static Migration — Phase 2 Spec: Projects

**Date:** 2026-06-16
**Status:** draft for review
**Builds on:** Phase 1 (`docs/2026-06-16-static-migration-phase1-spec.md` + `-plan.md`).

## Locked decisions (from brainstorming)

- Migrate the **`project` custom type** (92 items: **52 TH / 40 EN**) + `project_category` taxonomy.
- **Detail bodies → markdown** (clean, like posts; content is text + images + a few videos/buttons).
- **Listing** at `/projects` (TH) + `/en/projects_en` (EN): a project-card grid with a
  **lightweight client-side category filter**. Pixel-faithful filterable-portfolio design is
  **deferred to Phase 3**.
- **No per-category archive pages** (the original filters client-side).
- Reuse all Phase 1 infrastructure: Astro 5, Docker build/serve, render-and-scrape extraction,
  `scripts/lib/convert.mjs`, i18n (TH `/`, EN `/en/`), URL preservation via frontmatter `path`.
- Source of truth: the local WordPress Docker stack at `http://localhost:8080`.

## Goal & success criteria

All 92 projects render as a static `projects` collection at their **original `/project/<slug>`
(TH) and `/en/...` (EN) URLs**, plus a navigable **projects listing with category filter** at the
real nav URLs — built in Docker, verified against the local source.

**Done when:**
1. `src/content/projects/{th,en}/` holds 52 TH + 40 EN markdown files (counts **match the DB**).
2. Each project renders at its preserved WP URL via a `ProjectLayout` (cover + title + categories + body), with chrome (header/nav/footer), hreflang, and site-relative media.
3. `/projects` and `/en/projects_en` render a project-card grid with a working category filter; the nav "Projects"/"โครงการ" link resolves.
4. Build is clean in Docker; assets resolve; **no `localhost:8080` / `wp-content/uploads` leaks**.

## Scope

**In:** extend extraction to `project`; `projects` content collection; `ProjectLayout`;
`ProjectCard`; the two listing pages + client-side category filter; include projects in the
path-preserving route; verification.

**Out (Phase 3+):** pixel-faithful filterable-portfolio design, designed pages/home, per-category
archive pages, Cloudflare deploy, TH↔EN per-item hreflang pairing (same listing-fallback as Phase 1).

## Architecture & file changes

### 1. Extraction — `site/scripts/extract.mjs` (refactor + extend)
- Refactor the post-extraction loop into a reusable `extractType({ type, dir })` so it serves both
  `posts` and `project`. Keep the Phase-1 behavior for posts unchanged.
- Add a `project` pass: fetch `/wp-json/wp/v2/project?per_page=100&_embed` (REST enabled by toggling
  `disable-json-api` off on local, as in Phase 1; `?lang=` doesn't filter → assign language by
  `urlToPath(link).startsWith('/en/')`). Capture: `title, date, modified, slug, link→path,
  content.rendered→markdown (toSiteRelative + stripDiviCruft + htmlToMarkdown), excerpt, featured
  media→cover, project_category term names→categories`. Download referenced media to `public/media`.
- Write `src/content/projects/<lang>/<slug>.md` via `toFrontmatter`.
- Re-runnable; committed markdown/media remain the build source (no build-time WP dependency).

### 2. Collection — `site/src/content.config.ts` (modify)
- Add a `projects` collection (glob `base: './src/content/projects'`) with the **same schema** as
  `posts` (`title, date, modified?, lang, slug, path, categories[], tags[], cover?, excerpt?`).
  `categories` holds `project_category` names. Export `{ posts, projects }`.

### 3. Layout — `site/src/layouts/ProjectLayout.astro` (create)
- Like `PostLayout` but project-styled: cover/hero image, title, the project's categories (as
  labels/links to the filtered listing), then the markdown body. Wraps `BaseLayout`.

### 4. Routes — `site/src/pages/[...path].astro` (modify)
- `getStaticPaths` returns entries from **both** `posts` and `projects`, each with a `kind`
  discriminator; render `PostLayout` for posts and `ProjectLayout` for projects. Paths come from
  each entry's frontmatter `path` (leading slash stripped), preserving original URLs.
- Guard against path collisions across collections (none expected; report if found).

### 5. Listing — `site/src/pages/projects/index.astro` (TH) + `site/src/pages/en/projects_en/index.astro` (EN) (create)
- Grid of `ProjectCard`s for that language, sorted (date desc or menu order).
- **Category filter:** derive the category list from the language's projects; render filter
  controls (buttons) + cards tagged with `data-categories`; a small inline vanilla-JS script toggles
  card visibility. No separate archive routes.
- `BaseLayout` with the listing's own `path`/`altPath` (TH `/projects` ↔ EN `/en/projects_en`).

### 6. Component — `site/src/components/ProjectCard.astro` (create)
- Props `{ title, href, cover?, categories[] }`; renders cover + title + category labels; sets
  `data-categories` for the filter.

## Verification (Dockerized)
- `docker compose --profile tools run --rm extract` (with `disable-json-api` toggled on local) →
  then re-block it.
- Counts: `find src/content/projects/{th,en} -name '*.md' | wc -l` == DB project counts per language (52/40).
- `docker compose up -d --build web` → clean build.
- Sample 3 projects (≥1 EN): frontmatter `path` matches the WP `/project/...` URL; `dist/<path>/index.html` exists; page has chrome + cover + body; media resolves; no `localhost`/`wp-content` leaks.
- `/projects` + `/en/projects_en` return 200, show the grid, and the category filter toggles cards.
- Pipeline unit tests still pass (`docker compose --profile tools run --rm test`).

## Risks / notes
- **Filter JS** is the only client-side code; keep it tiny and progressive (cards visible if JS off).
- Project bodies may include `et_pb_video` embeds and buttons — preserve videos as iframes/links and
  buttons as links during markdown conversion; extend `convert.mjs` only if needed (add tests).
- Reuse the already-ported Divi/theme CSS; add project-card/grid styles as needed.
- EN project URL pattern is taken from each item's REST `link` (not assumed).
