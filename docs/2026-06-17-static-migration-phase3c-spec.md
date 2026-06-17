# Static Migration — Phase 3c Spec: Service pages + faithful /projects design

**Date:** 2026-06-17
**Builds on:** Phase 3a (preserve-HTML pipeline + global Divi base CSS) and 3b (generic
manifest-driven route). Today's global fixes — Divi parent grid (`.et_pb_row` centering +
responsive `@media`), `.et-waypoint`/`.et_animated` reveal, and the `decodeURIComponent`
asset-mirror fix — are in place and cover these pages.

## Locked decisions (from brainstorming)
- **Service pages → preserve-HTML** (the proven 3a/3b pipeline). They are **child pages of the
  projects landing**, served at their real nested URLs.
- **/projects landing → data-driven restyle.** Keep the listing driven by the project markdown
  collection (single source of truth); make it look like the live Divi filterable portfolio by
  scraping the landing's per-page CSS and rendering our cards in Divi portfolio-item markup.
- **Faithful: URLs only.** No invented navigation — service pages are orphaned on the live site
  too (reachable by direct URL); we replicate that exactly.
- **Filter = the 4 live sectors + "all"** (ทั้งหมด / การศึกษา / ความเป็นอยู่ / สุขภาพ / อื่น ๆ →
  `all/education/livelihood/health/other`). The vanilla-JS filter (no Divi/isotope JS) toggles items.

## Goal & success criteria
The ~33 service pages render faithfully at their nested URLs, and the `/projects` +
`/en/projects_en` landings reproduce the live filterable-portfolio look while staying driven by
our project markdown.

**Done when:** each service page returns 200 at its nested URL and renders the real Divi design
+ our chrome (images un-lazied, assets resolve, no `localhost`/`wp-content` origin leaks); the two
landings show the live filter bar (4 sectors + all) over a portfolio-styled grid whose every card
links to a built `/project/<slug>`; the filter works; clean Docker build; pipeline tests pass;
human visual gate (4321 vs 8080) on a sample of pages + both landings.

## Scope
**In:** add 33 service pages to the scrape list; scrape the two landings' CSS; restyle the two
listings (Divi portfolio markup + sector filter); verification.
**Out (later):** ~15 privacy pages → markdown (3d); Cloudflare deploy; the global-CSS purge/trim
(the ported Divi parent grid is ~825 KB — fidelity-first, trim before deploy).

---

## Architecture & file changes

### 1. Service pages — `scripts/extract-pages.mjs` (`PAGES`)
Append the entries below. Each is a standard Divi designed page (`#et-boc` + per-page
`et-core-unified`), so the existing pipeline writes content HTML + per-page CSS + mirrors assets +
appends to `manifest.json`. The generic `[...path].astro` route already renders manifest pages, so
they route automatically (no new route code).

URLs (canonical form, no trailing slash — the live site redirects `…/slug/` → `…/slug`):
TH `/projects/<slug>` (parent page 248), EN `/en/projects_en/<slug>` (parent page 27155).

**TH (17)** — `{ path: '/projects/<slug>', lang: 'th', slug: '<slug>' }`:
`chatbot, crowdfunding, crowdsourcing, e-commerce, graphic-design, interactive-infographic,
intranet, mobileapplication, mobilegame, online-donation, online-payment, online-ticketing-system,
open-data, project, web-application, web-portal, website`

**EN (16)** — `{ path: '/en/projects_en/<slug>', lang: 'en', slug: '<slug>' }`:
`chatbot, crowdfunding, crowdsourcing, graphic-design, interactive-infographic, intranet,
mobile-application, mobilegame, online-donation, online-payment, online-ticketing-system,
open-data, project, web-application, web-portal, website`

Slug notes (faithful, do not normalize): EN has **no** `e-commerce`; TH uses `mobileapplication`
(no hyphen) while EN uses `mobile-application`; both langs have a `project` child ("ระบบเฝ้าระวัง" /
"Surveillance System") → URL `/projects/project` and `/en/projects_en/project`. Slugs are unique
within each language, so the generated files (`src/content/pages/<lang>/<slug>.html`,
`src/styles/pages/<lang>-<slug>.css`) and the manifest glob keys do not collide.

Manifest grows from 9 → ~44 entries (9 existing + 33 service + the 2 landing CSS-only entries
from §2, which are written to the manifest but excluded from routing).

### 2. Landing CSS — scrape (reuse pipeline, like home)
Add the two landings to `PAGES` **for their CSS only**:
`{ path: '/projects', lang: 'th', slug: 'projects' }` and
`{ path: '/en/projects_en', lang: 'en', slug: 'projects_en' }`.
This writes `src/styles/pages/th-projects.css` + `en-projects_en.css` (the `et-core-unified-248` /
`-27155` CSS that styles `.et_pb_filterable_portfolio`, items, overlay, and the filter bar) and
mirrors any portfolio assets. The scraped HTML is not used (we render the grid from data).

In `[...path].astro` `getStaticPaths`, **exclude `/projects` and `/en/projects_en`** from manifest
routing (alongside the existing `/` and `/en/` exclusions) — these paths are owned by their
dedicated `index.astro` listing routes.

### 3. Faithful landings — `src/pages/projects/index.astro` + `src/pages/en/projects_en/index.astro` (rewrite) and `src/components/ProjectCard.astro` (restyle)
- Import the scraped landing CSS and pass it as `pageStyles` to `BaseLayout` (same mechanism home
  uses), plus the landing `bodyClass`.
- Render the live filterable-portfolio DOM so the scraped CSS applies:
  ```
  <div class="et_pb_module et_pb_portfolio et_pb_filterable_portfolio …">
    <div class="et_pb_portfolio_filters clearfix">
      <ul class="clearfix">
        <li class="et_pb_portfolio_filter et_pb_portfolio_filter_all"><a href="#" class="active" data-category-slug="all">ทั้งหมด</a></li>
        <li class="et_pb_portfolio_filter"><a href="#" data-category-slug="education">การศึกษา</a></li>
        … livelihood / health / other …
      </ul>
    </div>
    <div class="et_pb_portfolio_items_wrapper no_pagination">
      <div class="et_pb_portfolio_items">
        {projects.map(p => <ProjectCard … />)}  {/* one .et_pb_portfolio_item each */}
      </div>
    </div>
  </div>
  ```
- `ProjectCard` emits one Divi item:
  ```
  <div class="et_pb_portfolio_item et_pb_grid_item project_category_<slug>…">
    <a href={path}><span class="et_portfolio_image"><img src={cover} alt={title}/><span class="et_overlay"></span></span></a>
    <h2 class="et_pb_module_header"><a href={path}>{title}</a></h2>
  </div>
  ```
  The exact item inner markup (overlay/title nodes) is copied from a live item during
  implementation so the scraped CSS matches 1:1.
- **Category → class/filter mapping** (drives both the item classes and the filter buttons):

  | Live slug | TH label | EN label | Frontmatter source |
  |---|---|---|---|
  | `education` | การศึกษา | Education | `categories` |
  | `livelihood` | ความเป็นอยู่ | Livelihood | `categories` |
  | `health` | สุขภาพ | Health | `categories` |
  | `other` | อื่น ๆ | Other | `categories` |

  Each card gets `project_category_<slug>` for whichever of the 4 sectors its `categories` contain.
  (Our frontmatter also holds *type* labels like "Web Application" — ignored for the filter, which
  exposes only the 4 sectors, matching live. The exact EN sector labels are confirmed against
  `src/content/projects/en/*.md` during implementation.)
- **Filter JS** (reuse the existing vanilla pattern): clicking a filter sets `.active` and toggles
  each item's display by whether its class list includes `project_category_<slug>` (`all` shows all).

### 4. Re-run pipeline + build (Docker)
`docker compose --profile tools run --rm extract-pages` → `docker compose up -d --build web`.

## Verification (Dockerized)
- **Service pages:** all 33 nested URLs → 200; each contains Divi `et_pb_section`s + our
  `top-menu`/`main-footer`; no `data:image` lazy placeholders; sample images resolve; full
  local-asset scan on 3–4 pages shows no missing assets and no origin leaks in `dist`.
- **Landings:** `/projects` + `/en/projects_en` → 200; filter bar shows exactly
  ทั้งหมด/การศึกษา/ความเป็นอยู่/สุขภาพ/อื่น ๆ (EN equivalents) in live order; clicking a sector filters
  the grid; every card links to a built `/project/<slug>` (no 404s); grid styled like the live
  portfolio.
- **Count reconcile:** our TH grid (~53) vs live (~52) — identify the 1-item delta and confirm it's
  not a missing/extra project; same check for EN. Flag, don't silently drop.
- Pipeline tests pass; clean Docker build; **human visual gate** on a sample of service pages + both
  landings vs `localhost:8080`.

## Risks / notes
- **Item markup fidelity:** the restyle depends on matching Divi's `et_pb_portfolio_item` inner
  markup to the scraped CSS — copy a real item as the template; verify overlay/title render.
- **Landing trailing modules:** after the portfolio the live page has a `fullwidth_code` + a
  trailing image (likely decorative/JS). The landing's visible text is *only* the filter labels, so
  these are out of scope unless the visual gate shows meaningful content — then reconstruct statically.
- **Count delta (53 vs 52):** reconcile during verification (possibly a non-portfolio project or a
  duplicate) — do not mask it.
- **fullwidth_code on service pages:** if any service page uses a `fullwidth_code` module that renders
  empty statically (no Divi JS), note it for the human gate (same stance as 3b).
- **Global CSS weight:** unchanged by this phase; trim is a pre-deploy task, not here.
