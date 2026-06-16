# Static Migration — Phase 3a Spec: Home + preserve-HTML infrastructure

**Date:** 2026-06-16
**Status:** draft for review
**Builds on:** Phases 1 & 2 (posts + projects). Part of **Phase 3** (designed pages + home).

## Locked decisions

- **Designed pages use preserve-HTML:** scrape each page's rendered Divi content HTML + its
  per-page CSS, and serve it inside our faithful chrome. (Markdown is only for text pages —
  privacy policies in sub-phase 3d.)
- **Phase 3 is decomposed; do home first.** Sub-phases: **3a home + pipeline (this spec)** →
  3b core pages (about/contact/join-us/announcement) → 3c services (~17) + faithful `/projects`
  design → 3d privacy policies (markdown).
- Full Phase-3 scope is in (all groups), executed across 3a–3d.
- Reuse all prior infra (Astro 5, Docker build/serve, `BaseLayout`, ported theme CSS, the
  `convert.mjs` helpers, i18n, URL preservation). Source: local WP at `http://localhost:8080`.

## Key facts (verified)
- Each Divi page loads ONE self-contained stylesheet: `/wp-content/et-cache/<id>/et-core-unified-<id>-<hash>.min.css` (no scattered inline `<style>` blocks). The global customizer CSS is `et-cache/global/et-divi-customizer-global-<hash>.min.css`.
- Page body is in `#main-content` → `article#post-<id>` → `.entry-content` → **`#et-boc`** (the Divi builder output).
- Home is the WP front page (`page_on_front=2`): TH at `/`, EN at `/en/`.

## Goal & success criteria
Build the page-scrape pipeline and render the **home page faithfully** at TH `/` and EN `/en/`.

**Done when:**
1. The pipeline produces, for home (TH + EN): the content HTML (`#et-boc`), the page's CSS, and downloaded media with URLs rewritten to `/media/...`.
2. `/` and `/en/` render the home design inside our header/nav/footer chrome, visually matching `localhost:8080/` and `/en/` (allowing for Divi JS effects — parallax/scroll — becoming static).
3. Assets (CSS, fonts, images) resolve; **no `localhost:8080` / `wp-content/uploads` leaks**; clean Docker build; hreflang/lang/title present.

## Scope
**In:** the `extractDesignedPage` pipeline; a reusable storage format for designed pages; rendering the home front pages (TH `/`, EN `/en/`) via `BaseLayout` + injected page CSS + content HTML; CSS/media handling; verification.
**Out (later sub-phases):** all other designed pages, the generic catch-all designed-page route (3b), services + faithful projects listing (3c), privacy policies (3d), Cloudflare deploy.

## Architecture & file changes

### 1. Pipeline — `site/scripts/extract-pages.mjs` (new)
- Input: a list of designed pages to scrape `[{ path, lang, slug }]`. For 3a: `{path:'/', lang:'th', slug:'home'}` and `{path:'/en/', lang:'en', slug:'homepage'}`.
- For each: `fetch(WP_BASE + path)` (front-end render — no REST/plugin toggle needed). Then:
  - Parse the HTML (use `node-html-parser`, added as a dep used only by the extract container) and extract the inner HTML of **`#et-boc`** (fallback `.entry-content`).
  - Find the page's stylesheet link matching `et-cache/<id>/et-core-unified-...min.css` and the `et-divi-customizer-global` link; download both; **concatenate** into one page CSS file.
  - In BOTH the content HTML and the CSS, rewrite asset URLs: images/uploads → `/media/...` (reuse `extractImageUrls`/`rewriteMediaUrls`), font/other `url(...)` in the CSS → download to `public/fonts` or `public/media` and rewrite; strip the WP origin (`toSiteRelative`). Download all referenced media into `public/`.
  - Write: `src/content/pages/<lang>/<slug>.html` (content HTML), `src/styles/pages/<lang>-<slug>.css` (page CSS), and upsert an entry in `src/content/pages/manifest.json` (`{ path, lang, slug, title, description, html, css }`).
- Title/description: read from the page `<title>`/meta or pass in.
- Re-runnable; committed output is the build source (no build-time WP dependency).

### 2. Render the home front pages
- Replace placeholder `src/pages/index.astro` (TH `/`) and create `src/pages/en/index.astro` (EN `/en/`). Each:
  - imports its content HTML via `?raw` (`import html from '../content/pages/th/home.html?raw'`) and its CSS via `?raw`,
  - renders `BaseLayout` (lang, path `/` or `/en/`, title/description from the manifest), passing the page CSS to a new optional `BaseLayout` mechanism that emits it in `<head>` (add a `pageStyles?: string` prop → `<style set:html={pageStyles}>`, or a named `head` slot),
  - injects the content HTML into `<main>` via `<Fragment set:html={html} />`.

### 3. `BaseLayout` change
- Add an optional `pageStyles?: string` prop; when present, emit `<style set:html={pageStyles}></style>` in `<head>` (after global.css). No change to existing callers (prop optional).

### 4. CSS reconciliation
- The page's `et-core-unified` is large and includes Divi base rules that may overlap the chrome's ported CSS. Accept the overlap for fidelity (last-wins); verify visually. If the page CSS visibly breaks the chrome, scope the injected page styles under a wrapper (e.g. emit content inside `<div class="et-l">` and prefix) — only if needed; note it rather than pre-optimizing.

### 5. Storage format (reused by 3b's catch-all)
- `src/content/pages/<lang>/<slug>.html` + `src/styles/pages/<lang>-<slug>.css` + `manifest.json`. 3b will add a manifest-driven route for non-root designed pages; 3a wires home explicitly (front page `/` can't be a catch-all param).

## Verification (Dockerized)
- Run the pages pipeline (via a Docker node step like the existing `extract` service, or extend it): produces home HTML + CSS + media.
- `docker compose up -d --build web`; clean build.
- `curl localhost:4321/` and `/en/` → 200; the page contains the home hero/sections markup (`et_pb_section`/`et-boc`), our header (`top-menu`) and footer (`main-footer`), and the page `<style>`.
- Asset scan on `/`: every local `/...` ref (css/fonts/media) resolves in `dist`; no `localhost:8080`/`wp-content` leaks anywhere in `dist`.
- hreflang (th/en) + `<html lang>` + non-empty `<title>` present.
- **Human visual check:** `localhost:4321/` vs `localhost:8080/` (TH + EN) — layout/colors/fonts/images.

## Risks / notes
- `#et-boc` extraction selector must capture the full builder content; verify the home body is complete (hero + all sections).
- The `et-core-unified` CSS references fonts/images via `url(...)` — these must be downloaded + rewritten or they 404; this is the main pipeline subtlety.
- Divi JS-driven effects (fullwidth header parallax/scroll, animations) won't run statically — layout/visual is preserved, motion is not (accepted).
- `node-html-parser` is used only by the extract tooling (container), not shipped in the site build.
