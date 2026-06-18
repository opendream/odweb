# Content Architecture — Phase 2 Plan: Projects (metadata + config)

> Spec: `docs/2026-06-18-content-architecture-spec.md`. Controller-executed + screenshot-verified.

**Goal:** Give projects the 4 metadata fields (ประเด็น/ประเภท/ปีที่พัฒนา/ร่วมกับองค์กร) as frontmatter +
a metadata block in `ProjectLayout`; make the `/projects` filter use `issues` (sector); add a central
`projects.config.json` (per-lang `featured`+`order`) and sort the listing by it.

## Source structure (verified)
Live project detail has `#project-sidebar` → repeated `<h3>{label}</h3>` then `<p>{value}</p>` (or
`<ul><li>` for partners). Labels map by text (TH/EN) to: **issues** (ประเด็น/Issue), **type**
(ประเภท/Type), **year** (ปีที่พัฒนา/Year/Developed), **partners** (ร่วมกับองค์กร/Collaborative/Partner).

## Tasks

### 1. Extract metadata → augment project frontmatter
`scripts/extract-project-meta.mjs`: for each `src/content/projects/**/*.md`, parse its existing
frontmatter, fetch `BASE + path`, parse `#project-sidebar` (h3 → next p/ul), classify labels, and merge
`issues[]` / `type` / `year` / `partners[]` into the frontmatter (re-serialized via `toFrontmatter`,
keeping the body). Run via the `extract-pages` Docker service (socat). Idempotent (overwrites the 4
fields). Verify a TH + EN sample + a count of how many got each field.

### 2. Schema + metadata block
- `content.config.ts` projects schema: add `issues: z.array(z.string()).default([])`,
  `type: z.string().optional()`, `year: z.union([z.number(),z.string()]).optional()`,
  `partners: z.array(z.string()).default([])` (keep title/lang/slug/path/cover/excerpt/date; `categories`
  optional for back-comat).
- `ProjectLayout.astro`: render an `.od-meta` block (after title/cover, before body) with bilingual
  labels — th: ประเด็น/ประเภท/ปีที่พัฒนา/ร่วมกับองค์กร · en: Issue/Type/Year/Partners — showing the values
  (issues + partners as lists). Pass the new fields from `[...path].astro`.

### 3. issues-driven filter + central config + listing order
- `ProjectCard`: `data-sectors = sectorSlugs(issues)` (was `categories`); listings pass `issues`.
- `src/data/projects.config.json`: `{ "th": { "featured": [], "order": [slug…] }, "en": {...} }`.
  Seed `order` with the current date-desc slug order (so the listing is unchanged but now config-driven);
  `featured` left for Phase 3 (home) to curate.
- `/projects` + `/en/projects_en`: sort items by `order` (listed slugs first in that order; the rest by
  date desc), reading the per-lang config.

### 4. Build + verify + commit
- A project detail shows the metadata block (TH + EN, correct labels/values).
- `/projects` filter still works (now via `issues`); listing order matches the config.
- All projects 200; build clean; 27 tests pass; headless screenshot of a project detail + `/projects`.

## Risks
- Free-text `partners` parsing — review for mis-splits; `<ul><li>` handles most cleanly.
- Projects with no `#project-sidebar` / missing fields → those fields empty (fall back gracefully;
  no sector → appears only under "all").
- `type` value may wrap a link to a (dropped) service page — strip to text.
