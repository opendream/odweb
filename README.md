# opendream.co.th

The Opendream company website — a fast, static rebuild of our long-running WordPress site,
designed so content stays easy to update while the site itself is lightweight and secure.

> **Open by Design. Impact by Default.**

## The story

opendream.co.th ran on **WordPress** (with a Divi theme) for over a decade. It had grown heavy and
hard to maintain, and an aging install is a security liability. We rebuilt it as a **static site**
with three goals:

1. **Safer** — no database, no PHP, no plugins to patch; just pre-built HTML/CSS served from a CDN.
2. **Lighter & faster** — static pages, self-hosted fonts, a tiny (~15 KB) stylesheet, no heavy framework.
3. **Sustainable to edit** — content lives as **Markdown/MDX in git**, cleanly separated from the
   templates. Adding a blog post or project is just writing a markdown file; the designed pages are
   composed from a small set of reusable components.

The original look — bilingual **TH/EN**, the magazine-style project grid, the page designs — is
preserved, but the WordPress/Divi scaffolding is **entirely gone**: every style is a clean `.od-*`
rule we own, and there are no third-party CDNs at runtime.

## Stack

- **[Astro](https://astro.build) 5** — static site generator · **nginx** (in Docker) serves the build
- **Markdown / MDX** content with typed frontmatter (Astro content collections)
- **Self-hosted** Noto Sans Thai Looped (SIL OFL) — no external font CDN
- **i18n:** Thai at `/`, English at `/en/` · **Deploy target:** Cloudflare Pages (static `dist/`)

Built and served **entirely in Docker** — the only thing you need installed is Docker.

## Quick start

```bash
docker compose up -d --build       # build + serve at http://localhost:4321
docker compose up -d --build web   # rebuild after editing content/code
docker compose down                # stop
```

Open **http://localhost:4321**. Run the content-pipeline unit tests:

```bash
docker compose --profile tools run --rm test
```

## Project structure

```
src/
  content/      markdown/MDX content — the source of truth
    posts/        blog posts            (th/ + en/)
    projects/     portfolio projects    (th/ + en/)
    pages/        designed pages (about, contact, join-us, announcement) as MDX
    policies/     privacy / policy pages
  layouts/      BaseLayout + per-type layouts (Post, Project, Page, Composed)
  components/   chrome (Header/Footer/Nav/LangSwitcher) + content/ (Hero, Blurbs, CTA, Map, …)
  pages/        routes — home, listings, and [...path] (the content router)
  styles/       modern.css (the .od-* design system) + fonts.css
  data/         nav menus + projects.config.json (home showcase + listing order)
public/         media, self-hosted fonts, robots.txt
scripts/        content extraction/transform tooling (+ unit tests in scripts/lib)
docs/           the full migration record — specs + plans, phase by phase
```

## Editing content

- **Blog post / project** — add a markdown file under `src/content/posts/<lang>/` or
  `src/content/projects/<lang>/` with the standard frontmatter (`title, date, lang, slug, path,
  cover, …`). It renders at its `path`, in both the listing and at its own URL.
- **Designed pages** (about/contact/…) — MDX in `src/content/pages/`, composed from the components
  in `src/components/content/` (`<Hero>`, `<Blurbs>`, `<CTA>`, `<Map>`, `<Button>`, …).
- **Home showcase & project order** — curated in `src/data/projects.config.json`.

Then `docker compose up -d --build web` and refresh.

## Regenerating from the original site

The committed markdown is canonical. The `scripts/` (and the `extract` Docker service) can
re-derive content from the original WordPress source, but that's only for a bulk re-import and needs
access to that source — everyday editing is just markdown, no WordPress required.

## Licensing

Site **content** is licensed **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**.
The Noto Sans Thai Looped font is under the **SIL Open Font License** (see `public/fonts/OFL.txt`).

## More

- **`docs/`** — the phase-by-phase modernisation record (foundation → content → de-Divi → cleanup).
- **`CLAUDE.md`** — orientation for contributors (and AI assistants) working in this repo.
