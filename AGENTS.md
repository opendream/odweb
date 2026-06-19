# AGENTS.md

This file guides Codex and other contributors working in this repository, the Astro static
rebuild of **opendream.co.th**.

## What this is

opendream.co.th rebuilt as a fast, fully static **Astro** site that replaces a legacy WordPress and
Divi install. It is bilingual **TH and EN**, content is **markdown and MDX in git**, and it is built
and served entirely in **Docker**. The original look is preserved, but all the WordPress and Divi
scaffolding is gone: every style is a clean `.od-*` rule and there are no third-party CDNs at runtime.
The migration is complete and the repo is published at `opendream/odweb`.

## Deployment (Cloudflare Pages)

**Branch model.** `main` is the **experimental** line and **never** goes to production. A long-lived
**`production`** branch is Cloudflare Pages' production branch — production deploys only on a push to
it. `main` and every other branch/PR get **preview** deployments (their own URLs) for click-testing.

**One-time Pages setup.** Create a Pages project connected to `opendream/odweb`: framework **Astro**,
build command `npm run build`, output directory `dist`, and **set the production branch to
`production`** (not `main`). Keep preview deployments enabled (the default). Do **not** add the
`@astrojs/cloudflare` adapter — the site is static; Pages serves `dist/` directly. (A Workers/SSR
adapter was tried and reverted; it expects a `_worker.js` this static build never emits.)

**To release to production.** Run **`make release`** — it fast-forwards `production` to a tested,
pushed `main` and pushes it, triggering the Pages production build & deploy. It refuses to run on a
dirty working tree or when local `main` is out of sync with `origin/main`, and leaves you back on
`main`. Roll back with one click in the Pages dashboard (it keeps deploy history). Optionally tag the
released commit `vX.Y.Z` for version history — tags don't trigger deploys; the `production` push does.

**`production` is a protected branch** on GitHub: no force-pushes, no deletion, and linear history
required, so it can only ever **fast-forward from `main`** — exactly what `make release` does. `main`
stays unprotected and experimental.

**Environment variables.** Set `CLOUDFLARE_WEB_ANALYTICS_TOKEN` and `GOOGLE_SITE_VERIFICATION` on the
**Production** environment only (leave Preview empty), so experimental builds emit no analytics or
verification. See `docs/seo-setup.md`.

**Local / offline build.** `make dist` exports a clean, deploy-ready `dist/` on the host (it also
strips nginx's default `50x.html`). `make up` / `make rebuild` build inside the Docker image and
serve at `:4321`; they do **not** write the host `dist/`.

## Stack and conventions

- **Astro 5** static output, served by **nginx** in Docker.
- **i18n**: Thai is the default at `/`, English at `/en/`.
- **URL preservation**: each content entry keeps its original URL via its frontmatter `path`;
  `src/pages/[...path].astro` routes posts, projects, policies, and MDX pages at those exact paths.
- **Styling**: one stylesheet, `src/styles/modern.css`, the `.od-*` design system. `global.css`
  imports it plus `fonts.css` and base resets, including a site-wide `box-sizing: border-box`. There
  is no vendor or Divi CSS.
- **Font**: one self-hosted typeface, **Noto Sans Thai Looped** under the SIL OFL, covering Thai and
  Latin. The woff2 subsets live in `public/fonts/` with `public/fonts/OFL.txt`, and the `@font-face`
  rules are in `src/styles/fonts.css`. No external font CDN.
- **Content**: markdown and MDX under `src/content/` with typed frontmatter, schema in
  `src/content.config.ts`. Media in `public/media`; nav menus in `src/data/nav.{th,en}.json`.

## Dev workflow

Everything runs in Docker; the host needs only Docker. A `Makefile` wraps the tasks:

```bash
make up        # build and serve at http://localhost:4321
make rebuild   # rebuild after editing content or code
make dist      # export a clean, deploy-ready build to ./dist (for wrangler)
make down      # stop
make test      # run the content-pipeline unit tests
make help      # list every target
```

The raw equivalents are `docker compose up -d --build`, then `... --build web` to rebuild,
`docker compose down`, and `docker compose --profile tools run --rm test`. Builds have no build-time
dependency on WordPress; the committed markdown and media are the source of truth. **`make up` /
`make rebuild` build `dist` inside the Docker image and serve it via nginx at `:4321`; they do not
write the host `dist/`.** When you need the built files on the host (e.g. for `wrangler pages deploy`
or an offline audit), use `make dist`, which builds and then copies the output out of the container.

## Structure

- `src/content/` markdown and MDX content: `posts/`, `projects/`, `pages/` for the MDX designed
  pages, and `policies/`. Schema in `src/content.config.ts`.
- `src/layouts/` `BaseLayout` for head, meta, and hreflang, plus `PostLayout`, `ProjectLayout`,
  `PageLayout`, and `ComposedLayout`.
- `src/components/` chrome: `Header`, `Footer`, `Nav`, `LangSwitcher`, `PostCard`, `ProjectCard`.
  Reusable MDX building blocks are in `src/components/content/`: `Hero`, `Section`, `Blurbs`, `Blurb`,
  `Gallery`, `Map`, `CTA`, `Button`.
- `src/pages/` routes: `index.astro` and `en/index.astro` for the home, the blog and projects
  listings, and `[...path].astro` which routes posts, projects, policies, and MDX pages.
- `src/styles/` `modern.css`, `global.css`, `fonts.css`.
- `src/data/` `nav.{th,en}.json`, `projects.config.json`, `translations.json`.
- `src/lib/gradient.mjs` deterministic gradient for cover-less project placeholders.
- `scripts/` content extraction and transform tooling, with unit tests in `scripts/lib/`.
- `public/` media, self-hosted fonts, robots.txt. `Dockerfile` is multi-stage Node then nginx;
  `docker-compose.yml`, `nginx.conf`.

## Content model and ordering

- **Posts and projects**: add a markdown file under `src/content/posts/<lang>/` or
  `src/content/projects/<lang>/` with the standard frontmatter `title, date, lang, slug, path, cover,
  excerpt, categories, tags`. Projects also carry `issues, type, year, partners`, rendered as the
  metadata block by `ProjectLayout`. That block shows a value plain when there is one item and as a
  list only when there are two or more.
- **Designed pages**: about, contact, join-us, and announcement, written as MDX in
  `src/content/pages/`, composed from the `src/components/content/` building blocks and rendered by
  `ComposedLayout`. `[...path].astro` passes the components to `<Content/>` so the MDX needs no
  per-file imports.
- **Ordering**: `src/data/projects.config.json`, per language. `featured` is the ordered list of
  slugs for the home showcase, a curated subset. `order` pins slugs to the top of the projects
  listing, with the rest newest first. The README has the details.

## Key notes

- **De-Divi is complete.** `dist` has zero `et_pb_`, `divi-parent`, or `#et-boc`, and the CSS bundle
  is about 15 KB. Keep new styling in `modern.css` as `.od-*`.
- **Project covers** come from the WordPress featured image. A few were lost to a REST-forbidden
  quirk and are recovered via a small map in `scripts/extract.mjs`. A project with no cover renders a
  deterministic gradient placeholder with the name centered.
- **hreflang**: per-page TH and EN pairing in `src/data/translations.json`, consulted by
  `BaseLayout` and the language switcher, with a listing fallback when a page is unpaired.

## When making changes

- Preserve the original URLs and the faithful look.
- Add content as markdown or MDX with the established frontmatter.
- Keep `node_modules`, `dist`, and `.astro` out of git; the build creates them in Docker.
- Run `make test` after changing anything in `scripts/lib/`.

## More

- `docs/` holds the full phase-by-phase migration record, from foundation to content to de-Divi to
  cleanup.
- Licensing: code and theme are MIT, content is CC BY 4.0, and the font is under the SIL OFL. The
  README has the summary.
