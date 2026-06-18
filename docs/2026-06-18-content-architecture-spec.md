# Content Architecture Spec — content-first SSG (de-Divi finish)

**Date:** 2026-06-18

## Why
WordPress is bloated and a security liability for a company brochure site; an SSG is safer and
lighter; and — most importantly — it lets us keep updating content sustainably by **separating
HTML/CSS (shared templates) from content (markdown/MDX + frontmatter)**. This spec defines the
target content model and finishes the de-Divi modernisation by making the remaining designed pages
content-driven, then removing the Divi theme entirely.

## Locked decisions (from brainstorming)
- **Content = MDX** (markdown + a small set of reusable components) + typed frontmatter, rendered by
  **shared layouts**. Authors edit `.md`/`.mdx` in git now; keep frontmatter clean for a **git-based
  CMS later** (Decap/Sveltia/Tina).
- **Projects** carry 4 metadata fields as frontmatter, rendered as a **metadata block** separate from
  the body: **ประเด็น (issues/sector) · ประเภท (type) · ปีที่พัฒนา (year) · ร่วมกับองค์กร (partners)**.
- **Home** = a bespoke template; its showcase tiles + the `/projects` listing order come from
  **central curated config** files (not per-page sorting).
- **Drop the ~17 `services` pages** entirely (orphaned capability catalog, redundant with the portfolio).
- **Finish:** once nothing references Divi, remove `vendor/divi-parent.css` + the vendor Divi CSS + the
  PurgeCSS build step + the `DEFAULT_BODY_CLASS`.

## Target architecture

### Collections (content + frontmatter → shared layout)
| Collection | Format | Layout | Frontmatter |
|---|---|---|---|
| `posts` | md/MDX | PostLayout | title, date, lang, slug, path, cover?, excerpt?, tags? |
| `projects` | MDX | ProjectLayout | title, lang, slug, path, cover?, excerpt?, **issues[] (sector), type, year, partners[]** |
| `pages` (**new**) | MDX | PageLayout | title, lang, slug, path, description? |
| `policies` | md | PageLayout | title, lang, slug, path |

`pages` = **about-us, join-us, announcement, contact** (TH+EN) — currently scraped Divi HTML, converted
to MDX content. `policies` (privacy pages) already fit this model.

### Bespoke
- **`home`** (`/` + `/en/`): its own template. Renders a hero + a **showcase grid** of the projects
  named in the central config (reusing `ProjectCard`), + any other home sections.

### Central config (`src/data/`)
- `projects.config.json` — per language: `{ th: { featured: [slug…], order: [slug…] }, en: {…} }`.
  `featured` (ordered) drives the **home** showcase; `order` drives the **/projects** listing
  (projects not listed fall back to date-desc after the ordered ones).

### MDX content components (`src/components/content/`)
Reusable building blocks content can drop into `.mdx`. Clean `.od-*` CSS in `modern.css`.
- `<Hero title subtitle? image? bg?/>` — section/banner header.
- `<Blurb image?|icon? title>…</Blurb>` + `<Blurbs>` grid wrapper — the icon/title/text cards (about
  uses ~30).
- `<Gallery images={[{src,alt}]} cols?/>` / `<ImageGrid>` — image grids.
- `<Map src/>` — responsive iframe wrapper (contact map; external src kept).
- `<CTA title? text? href? label?/>` — call-to-action band.
- `<Button href>…</Button>` — link button.
- (`<Section>` / `<Columns>` layout helpers if needed.)

### Project metadata block (ProjectLayout)
Render the 4 fields above the/aside the body, with bilingual labels:
`ประเด็น / ประเภท / ปีที่พัฒนา / ร่วมกับองค์กร` (th) · `Issue / Type / Year / Partners` (en). `issues`
(sector) also drives the `/projects` portfolio filter (replacing the mixed `categories`), via the
existing sector mapping in `scripts/lib/categories.mjs`.

## Extraction / migration
- **Projects:** re-scrape each live project detail page for the 4 metadata fields (labels present in
  the HTML: `ประเด็น/ประเภท/ปีที่พัฒนา/ร่วมกับองค์กร`) → frontmatter; body stays the existing markdown
  (→ `.mdx`). Reconcile `issues` ↔ the filter sectors.
- **Pages (about/join-us/announcement/contact):** convert the scraped `#et-boc` Divi HTML into MDX —
  text → markdown, and each Divi module → the matching component (`fullwidth_header`→`Hero`,
  `blurb`→`Blurb`, image grids→`Gallery`, `cta`→`CTA`, contact `iframe`→`Map`). Done **per page, with a
  before/after screenshot vs the live page** (these are bespoke).
- **Home:** rebuild as a template; showcase from `projects.config.json`.
- **Services:** delete the 17 pages + their `PAGES` entries, manifest records, generated files, routes.

## Phasing (each phase shippable + verified)
1. **Foundation** — add `@astrojs/mdx`; build the content components (`Hero`, `Blurb(s)`, `Gallery`,
   `Map`, `CTA`, `Button`) + their `.od-*` CSS; demo page to verify.
2. **Projects** — new schema + re-extracted 4 fields; ProjectLayout metadata block; `issues`-driven
   filter; `projects.config.json`; wire `/projects` listing order.
3. **Home** — bespoke template + showcase tiles from config.
4. **Pages** — convert about/join-us/announcement/contact → MDX (per-page, screenshot-verified).
5. **Cleanup** — delete `services`; remove `divi-parent.css` + vendor Divi CSS + PurgeCSS step +
   `DEFAULT_BODY_CLASS`; full visual + test pass; confirm CSS now tiny.

## Verification (per phase + final)
- All preserved URLs still 200; both languages; headless before/after screenshots for designed pages
  vs `localhost:8080`; pipeline + new unit tests pass; clean Docker build.
- Final: `grep` shows no `et_pb_`/`divi-parent`/`#et-boc` anywhere in `dist`; CSS bundle is small
  (no Divi); home showcase + `/projects` order reflect the config; project metadata block correct.

## Risks / notes
- **`fullwidth_code` modules** (custom HTML/JS on some designed pages, e.g. home's grid) — handle
  per-page during Phase 4 (rebuild as a component or keep a small static snippet); flag any that can't
  convert cleanly.
- **Partner lists** (`ร่วมกับองค์กร`) are free-text on the source; extraction splits them heuristically
  — review for mis-splits.
- **MDX migration of bespoke pages is manual** (not mechanical) — Phase 4 is the long pole; each page
  is its own reviewed unit.
- **CMS-readiness:** keep frontmatter flat/predictable so a git CMS can map to it later.
- This program supersedes the earlier "page-builder component library" idea — content-first MDX +
  shared templates + central config.
