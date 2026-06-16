# Static Migration — Phase 3b Spec: Core designed pages

**Date:** 2026-06-17
**Builds on:** Phase 3a (home + the preserve-HTML pipeline, now proven & visually validated).

## Locked decisions
- Approach = **preserve-HTML** (proven in 3a): scrape `#et-boc` content + the page's `et-core-unified` CSS, mirror `/wp-content/` assets, `unlazy` images, render inside our chrome via `BaseLayout`.
- **Remove the header search box** (no static backend) — chrome change, applies site-wide.
- Pages in scope (all confirmed 200 on the source): TH `/about-us`, `/contact`, `/join-us`, `/announcement`; EN `/en/about_en`, `/en/contact_en`, `/en/join-us_en`. (announcement is TH-only.)
- No contact form to handle — the contact page is info + a Google Maps `<iframe>` (external, works statically); the only `<form>` on pages was the header search (being removed).
- Reuse the proven pipeline (`scripts/extract-pages.mjs` + `unlazy`), nginx relative-redirects, config-driven canonical.

## Goal & success criteria
The 7 core pages render faithfully at their preserved URLs, inside our chrome, so the nav links (เราทำอะไร, ติดต่อเรา, ร่วมงาน, ประกาศ + EN) resolve instead of 404.

**Done when:** each of the 7 paths returns 200 and renders the real page design (sections/columns/images) + our header/footer; images show (un-lazied); the contact map iframe loads; assets resolve; **no `localhost`/`wp-content` origin leaks**; the search box is gone from the header; hreflang/lang/title present; clean Docker build; pipeline tests pass.

## Scope
**In:** add the 7 pages to the scrape list + re-run the pipeline; a **generic manifest-driven route** that renders all non-root designed pages; remove the header search box; verification.
**Out (later):** ~17 service pages + faithful `/projects` design (3c), ~14 privacy policies → markdown (3d), Cloudflare deploy.

## Architecture & file changes
### 1. `scripts/extract-pages.mjs` — add the 7 pages to `PAGES`
Append entries `{path, lang, slug}` for `/about-us`(th,about-us), `/contact`(th,contact), `/join-us`(th,join-us), `/announcement`(th,announcement), `/en/about_en`(en,about_en), `/en/contact_en`(en,contact_en), `/en/join-us_en`(en,join-us_en). Re-run → writes `src/content/pages/<lang>/<slug>.html` + `src/styles/pages/<lang>-<slug>.css` + mirrors assets + updates `manifest.json` (now 9 entries incl. home).

### 2. Generic designed-page route — `src/pages/[...path].astro` (modify)
The single root rest-route already renders `posts` + `projects`. Extend it to ALSO render manifest designed pages (except the home paths `/` and `/en/`, which `index.astro`/`en/index.astro` own):
- Load page HTML/CSS via `import.meta.glob('../content/pages/**/*.html', {query:'?raw', import:'default', eager:true})` and the same for `../styles/pages/*.css`.
- In `getStaticPaths`, add manifest entries with `path !== '/' && path !== '/en/'` as `{ params:{path}, props:{ kind:'page', entry:{title,description,bodyClass,lang,path}, html, css } }` (html/css looked up by `../content/pages/${lang}/${slug}.html` etc.).
- Render: `kind==='page'` → `BaseLayout` with `pageStyles={css}`, `bodyClass`, `<Fragment set:html={html} />`; else existing post/project layouts.
- Guard: no path collisions among posts/projects/pages (report if any).

### 3. Remove header search — `src/components/Header.astro` (modify)
Remove the search box/icon markup (and any now-unused search vars). Keep logo + nav + lang switcher. Affects all pages (chrome).

### 4. Re-run pipeline + build (Docker)
`extract-pages` (the socat-over-shared-network service) → then `docker compose up -d --build web`.

## Verification (Dockerized)
- 7 paths → 200; each contains the page's Divi sections + our `top-menu`/`main-footer`; contact pages contain the map `<iframe>`.
- Images: no `data:image` lazy placeholders on the 7 pages; sample images resolve.
- Asset scan on 2–3 pages: every local `/...` ref resolves; no `localhost`/`wp-content` origin leaks in `dist`.
- Nav links เราทำอะไร/ติดต่อเรา/ร่วมงาน/ประกาศ (+EN) now resolve (200) from the home.
- Header: no search form/icon in served output.
- hreflang/lang/title present; pipeline tests pass; clean build.
- **Human visual check**: the 7 pages vs `localhost:8080` equivalents.

## Risks / notes
- Some pages use Divi `fullwidth_code` modules (custom HTML/JS). If any renders **empty** statically (like the home's grid did before un-lazy), flag it during verification and reconstruct/accept per the same static approach (no Divi JS). `unlazy` already covers lazy images.
- The contact Google Maps iframe keeps its external `google.com` src (not origin-stripped) — works statically.
- EN has no `announcement` page (TH-only) — don't fabricate one.
