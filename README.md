# opendream.co.th

The Opendream company website, rebuilt as a fast static site so content stays easy to update
while the site itself stays lightweight and secure.

> **Open by Design. Build for Impact.**

## The story

opendream.co.th ran on WordPress with a Divi theme for over a decade. It had grown heavy and hard
to maintain, and an aging install is a security liability. We rebuilt it as a static site with
three goals:

1. **Safer.** No database, no PHP, no plugins to patch. Just pre-built HTML and CSS served from a CDN.
2. **Lighter and faster.** Static pages, self-hosted fonts, a stylesheet of about 15 KB, no heavy framework.
3. **Sustainable to edit.** Content lives as Markdown and MDX in git, cleanly separated from the
   templates. Adding a blog post or project is just writing a markdown file, and the designed pages
   are composed from a small set of reusable components.

The original look is preserved: bilingual TH and EN, the magazine-style project grid, the page
designs. But the WordPress and Divi scaffolding is entirely gone. Every style is a clean `.od-*`
rule we own, and there are no third-party CDNs at runtime.

## Stack

- **Astro 5** for the static build, served by **nginx** in Docker.
- **Markdown and MDX** content with typed frontmatter, via Astro content collections.
- **Self-hosted** Noto Sans Thai Looped under the SIL Open Font License. No external font CDN.
- **i18n**: Thai at `/`, English at `/en/`.
- **Deploy target**: Cloudflare Pages, serving the static `dist/`.

Everything is built and served in Docker, so the only thing you need installed is Docker.

## Quick start

The `Makefile` wraps the common tasks:

```bash
make up        # build and serve at http://localhost:4321
make rebuild   # rebuild after editing content or code
make down      # stop
make test      # run the content-pipeline unit tests
make help      # list every target
```

Open http://localhost:4321 in your browser, or run `make open`. Other targets include
`make logs`, `make ps`, `make restart`, and `make clean`.

## Project structure

```
src/
  content/      markdown and MDX content, the source of truth
    posts/        blog posts, th and en
    projects/     portfolio projects, th and en
    pages/        designed pages as MDX: about, contact, join-us, announcement
    policies/     privacy and policy pages
  layouts/      BaseLayout plus per-type layouts: Post, Project, Page, Composed
  components/   chrome: Header, Footer, Nav, LangSwitcher. content: Hero, Blurbs, CTA, Map, and more
  pages/        routes: home, listings, and the [...path] content router
  styles/       modern.css, the .od-* design system, plus fonts.css
  data/         nav menus plus projects.config.json for the home showcase and listing order
public/         media, self-hosted fonts, robots.txt
scripts/        content extraction and transform tooling, with unit tests in scripts/lib
docs/           the full migration record: specs and plans, phase by phase
```

## Editing content

- **Blog post or project.** Add a markdown file under `src/content/posts/<lang>/` or
  `src/content/projects/<lang>/` with the standard frontmatter: `title, date, lang, slug, path,
  cover`, and so on. It renders at its `path`, in both the listing and at its own URL.
- **Designed pages** such as about and contact. MDX in `src/content/pages/`, composed from the
  components in `src/components/content/`: `<Hero>`, `<Blurbs>`, `<CTA>`, `<Map>`, `<Button>`, and more.
- **Home showcase and project order.** Configured in `src/data/projects.config.json`, explained in
  the next section.

Then run `make rebuild` and refresh.

## Ordering the front page and the projects page

Both orders live in one file, `src/data/projects.config.json`, which has a `th` block and an `en`
block. A short example:

```json
{
  "th": {
    "featured": ["podd", "doctorme", "taejai"],
    "order": ["podd", "vote62"]
  },
  "en": {
    "featured": ["podd-en", "doctorme-en", "taejai"],
    "order": []
  }
}
```

- **`featured`** drives the **front page** showcase. List the project slugs you want, in the order
  you want them. The home page shows exactly those tiles, in that order. It is a curated subset, so
  only the projects you list appear there.
- **`order`** drives the **projects page** at `/projects` and `/en/projects_en`. Slugs listed here
  are pinned to the top, in that order. Every other project follows, newest first. Leave it as an
  empty list for purely newest-first.

A slug is the `slug` value in a project's frontmatter, for example `podd` or `doctorme`. Thai and
English keep separate lists because their slugs differ, such as `podd` for Thai and `podd-en` for
English. A few projects share one slug across both languages, such as `taejai`.

After editing the file, run `make rebuild` and refresh.

## Regenerating from the original site

The committed markdown is canonical. The scripts in `scripts/`, and the `extract` Docker service,
can re-derive content from the original WordPress source. That is only for a bulk re-import and
needs access to that source. Everyday editing is just markdown, no WordPress required.

## Licensing

- **Code and theme** such as templates, components, styles, scripts, and config: **[MIT][mit]**.
- **Content** such as text, images, and markdown under `src/content/` and `public/media/`:
  **[CC BY 4.0][ccby]**.
- **Font**: Noto Sans Thai Looped under the SIL Open Font License, see `public/fonts/OFL.txt`.
  Brand icons for Facebook, X, and GitHub remain their owners' trademarks.

## More

- **`docs/`** holds the phase-by-phase modernisation record, from foundation to content to de-Divi
  to cleanup.
- **`CLAUDE.md`** is the orientation for contributors and AI assistants working in this repo.

[mit]: LICENSE
[ccby]: https://creativecommons.org/licenses/by/4.0/
