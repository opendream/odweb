# CLAUDE.md

This file guides Claude Code and other contributors working in this repository — the Astro static
site behind **opendream.co.th**.

## What this is

opendream.co.th as a fast, fully static **Astro** site that replaced a legacy WordPress + Divi
install. **It is live** at `https://opendream.co.th`, served from **Cloudflare Workers (static
assets)** (cut over 2026-06-20). Bilingual **TH and EN**; content is **markdown and MDX in git**;
built and served entirely in **Docker**. The original look is preserved, but all WordPress/Divi
scaffolding is gone — every style is a clean `.od-*` rule, no third-party CDNs at runtime. Repo:
`opendream/odweb`.

## Stack and conventions

- **Astro 6** static output, **Node 22** (Astro 6 requires Node ≥ 22.12; pinned in `.nvmrc`). Served
  by **nginx** in Docker locally; by **Cloudflare Workers static assets** in production.
- **i18n**: Thai default at `/`, English at `/en/`.
- **URL preservation**: each entry keeps its original URL via frontmatter `path`;
  `src/pages/[...path].astro` routes posts/projects/policies/MDX pages at those exact paths.
- **Canonical host = apex** (`https://opendream.co.th`), **non-trailing-slash**; `www → apex` 301.
- **Deploy-aware origin**: `src/lib/site.mjs` (`PRODUCTION_ORIGIN` + `resolveSiteOrigin`) picks the
  build's absolute-URL origin — apex on the production branch / local, the
  `<branch>-odweb…workers.dev` preview URL on other branches (via Cloudflare `WORKERS_CI_BRANCH`), or
  a `SITE_URL` override. Preview origins are auto-`noindex`ed.
- **Styling**: one stylesheet `src/styles/modern.css` (the `.od-*` system); `global.css` imports it +
  `fonts.css` + base resets. No vendor/Divi CSS.
- **Font**: one self-hosted typeface, **Noto Sans Thai Looped** (SIL OFL), TH + Latin; woff2 in
  `public/fonts/`, `@font-face` in `src/styles/fonts.css`. No font CDN.
- **Content**: markdown/MDX under `src/content/`, typed frontmatter, schema in `src/content.config.ts`.
  Media in `public/media`; nav in `src/data/nav.{th,en}.json`.
- **SEO**: `src/components/SEO.astro` (meta, OG/Twitter, JSON-LD, hreflang) driven by `src/lib/seo.mjs`;
  sitemap hreflang via `src/lib/sitemap-hreflang.mjs` + a custom serializer in `astro.config.mjs`.
  Default OG image `public/media/og-default.jpg`.

## Dev workflow

Everything runs in Docker; the host needs only Docker. A `Makefile` wraps the tasks:

```bash
make up        # build + serve at http://localhost:4321
make rebuild   # rebuild after editing content or code
make dist      # export a clean, deploy-ready build to ./dist
make release   # promote tested main -> production (triggers the prod deploy)
make down      # stop
make test      # run the content-pipeline unit tests
make help      # list every target
```

Builds have no build-time dependency on WordPress; committed markdown + media are the source of truth.
**`make up` / `make rebuild` build `dist` inside the Docker image and serve it at `:4321` — they do
NOT write the host `dist/`.** For built files on the host (e.g. an offline audit), use `make dist`
(builds + copies the output out of the container, minus nginx's default `50x.html`).

## Deployment (Cloudflare Workers — live)

Live on a Cloudflare **Worker** named `odweb` (**static assets — no `main`/SSR; do NOT add the
`@astrojs/cloudflare` adapter**, it was tried and reverted). Config in `wrangler.jsonc`
(assets `./dist`, `html_handling: drop-trailing-slash`, `not_found_handling: 404-page`, observability).
Deploys run via **Cloudflare Workers Builds** (git-connected, `npm run build`).

- **Branch model.** `main` = **experimental** → a **preview** at `main-odweb.opendream.workers.dev`
  (noindexed). The **`production`** branch is the Worker's production branch → serves apex
  `opendream.co.th` (and `odweb.opendream.workers.dev`). `www → apex` is a Cloudflare Redirect Rule (301).
- **Release.** `make release` fast-forwards `production` to a tested, in-sync `main` and pushes it
  (refuses on a dirty tree / out-of-sync `main`). `production` is a **protected** branch (no
  force-push/deletion, linear history → fast-forward only). Roll back via the Cloudflare dashboard.
- **Measurement.** Cloudflare Web Analytics via a manual beacon token in `src/data/site.json`
  (`cfBeaconToken`), emitted **production-only** by `SEO.astro`. Google Search Console is
  **DNS-verified** (Domain property — covers apex + www). `CLOUDFLARE_WEB_ANALYTICS_TOKEN` /
  `GOOGLE_SITE_VERIFICATION` env vars override `site.json`. Runbook: `docs/seo-setup.md`.
- **Cutover specifics (done).** Apex attached as the Worker custom domain (replaced the WP A record);
  `www → apex` 301; old WP auto-install Web Analytics disabled (no double-count); MX/email + all
  verification TXTs preserved.

## Structure

- `src/content/` markdown/MDX: `posts/`, `projects/`, `pages/` (MDX designed pages), `policies/`.
- `src/layouts/` `BaseLayout` (head/meta/hreflang via `SEO.astro`), `PostLayout`, `ProjectLayout`,
  `PageLayout`, `ComposedLayout`.
- `src/components/` chrome (`Header`, `Footer`, `Nav`, `LangSwitcher`, `PostCard`, `ProjectCard`) +
  `SEO.astro`; reusable MDX blocks in `src/components/content/`.
- `src/pages/` `index.astro`, `en/index.astro`, the blog/projects listings, and `[...path].astro`.
- `src/styles/` `modern.css`, `global.css`, `fonts.css`.
- `src/data/` `nav.{th,en}.json`, `projects.config.json`, `service-landings.json`, `translations.json`,
  `org.json` (Organization facts), `site.json` (analytics/verification config).
- `src/lib/` `seo.mjs`, `sitemap-hreflang.mjs`, `site.mjs` (deploy-aware origin), `gradient.mjs`.
- `scripts/` content extraction/transform tooling + unit tests in `scripts/lib/`.
- root: `Dockerfile` (multi-stage Node 22 → nginx), `docker-compose.yml`, `nginx.conf`,
  `wrangler.jsonc`, `.nvmrc`, `astro.config.mjs`, `.github/dependabot.yml`.

## Content model and ordering

- **Posts and projects**: markdown under `src/content/posts/<lang>/` or `projects/<lang>/` with
  frontmatter `title, date, lang, slug, path, cover, excerpt, categories, tags`. Projects also carry
  `issues, type, year, partners` (rendered by `ProjectLayout` — one item plain, two+ as a list).
- **Designed pages** (about/contact/join-us/announcement): MDX in `src/content/pages/`, composed from
  `src/components/content/` blocks, rendered by `ComposedLayout`; `[...path].astro` passes the
  components to `<Content/>` so the MDX needs no per-file imports.
- **Coverless posts/projects** fall back to a deterministic `gradientFor()` placeholder.
- **Ordering**: `src/data/projects.config.json` (per language) — `featured` for the home showcase,
  `order` to pin slugs at the top of the listing (rest newest-first).

## Key notes

- **Static, no SSR** — output is `dist/` files; no adapter, no `_worker.js`.
- **Trailing slash**: canonicals/sitemap are non-trailing; the Worker's `drop-trailing-slash` serves
  `/blog` (200) and 301s `/blog/` → `/blog`.
- **De-Divi is complete**; CSS bundle ~15 KB. Keep new styling in `modern.css` as `.od-*`.
- **Project covers** come from the WP featured image (a few recovered via a map in
  `scripts/extract.mjs`); coverless → gradient placeholder.
- **hreflang**: per-page TH/EN pairing in `src/data/translations.json`, with a listing fallback.
- **Dependabot**: grouped/weekly config in `.github/dependabot.yml`; `npm audit` clean.

## When making changes

- Preserve original URLs and the faithful look; keep canonicals apex + non-trailing.
- Add content as markdown/MDX with the established frontmatter.
- Keep `node_modules`, `dist`, `.astro` out of git (built in Docker).
- Run `make test` after changing anything in `scripts/lib/` or `src/lib/`.
- Deploy with **`make release`** (main → production); don't push `production` directly otherwise.

## More

- `docs/` holds the phase-by-phase record (foundation → content → de-Divi → SEO → cutover);
  `docs/seo-setup.md` is the measurement runbook; `docs/superpowers/` has the specs + plans.
- Licensing: code/theme MIT, content CC BY 4.0, font SIL OFL (see README).
