# Static Migration — Phase 3d Spec: Policy pages → markdown

**Date:** 2026-06-17
**Builds on:** the posts/projects markdown pipeline (`scripts/extract.mjs`, `scripts/lib/convert.mjs`)
and the preserve-HTML lib (`scripts/lib/pages.mjs`). This is the **last content-conversion phase**;
after it the site is content-complete (pre-deploy polish + Cloudflare deploy follow).

## Locked decisions (from brainstorming)
- **15 privacy/policy pages → markdown.** They are plain WordPress content — real policy text in
  `article .entry-content`, no Divi builder. Rendered as readable prose inside our chrome.
- **`blueflagshops` is abandoned** (out of scope, per decision) — the richer campaign page is dropped;
  3d is the 15 policy pages only.
- **Minimal `PageLayout`** (chrome + `.container > article > .entry-content` so `divi-parent.css`
  styles the prose, matching the live plain-page template).
- **Language** is taken from each page's rendered `<html lang>` (Polylang-set: e.g. doctorme→`en`,
  buddy-homecare→`th`). All pages are top-level — URL = `/<slug>` (no `/en/` prefix).
- No clean TH/EN pairing exists (per-product policies in mixed languages); the lang switcher falls
  back to the listing (consistent with the rest of the site).

## Goal & success criteria
The 15 remaining published policy pages render at their preserved `/<slug>` URLs inside our chrome.

**Done when:** all 15 URLs return 200; each shows its full policy text as readable prose
(headings/lists/links preserved); images (if any) resolve; no `localhost`/`opendream.co.th` origin
leaks; `<html lang>` + hreflang + chrome language correct per page; clean Docker build; pipeline
tests pass; human visual gate vs `localhost:8080`.

## Scope
**In:** extract the 15 pages → markdown; a `policies` collection; a `PageLayout`; routing; verification.
**Out (later, unchanged):** `blueflagshops`; pre-deploy polish (CSS purge/trim,
`sitemap.xml`/`robots.txt`/`404`, TH↔EN per-page hreflang pairing); Cloudflare Pages deploy.

## The 15 pages (all `post_parent=0`, URL `/<slug>`, → markdown)
`606-privacy-policy`(en), `buddy-homecare-privacy-policy`(th), `buddy-homecare-privacy-policy-2`(en),
`corrupt-privacy-policy`(en), `doctorme-privacy-policy`(en), `judies-privacy-policy`(en),
`judies-privacy-policy-1`(en), `mor-huangyai-privacy-policy`(th), `new-horizons-policy`(en),
`privacy-policy-youthpoll-th`(th), `sabaidee-community-privacy-policy`(th), `sabaidee-privacy-policy`(en),
`sabaidee-privacy-policy-1`(th), `small-world-privacy-policy`(th), `vrt-vr-game-privacy-policy`(en).
(Lang is **detected at extraction** from `<html lang>`, not hardcoded — the list above is the expected
result and a verification cross-check.)

## Architecture & file changes

### 1. `scripts/lib/pages.mjs` — add `extractEntryContent(html)` (tested)
Returns the inner HTML of the first `article .entry-content` (scoped to `article`, so a footer/widget
`.entry-content` is never matched). Unit-tested in `scripts/lib/pages.test.mjs`.

### 2. `scripts/extract-content-pages.mjs` (new) — extract the 15 pages → markdown
A `SLUGS` list (15). For each: fetch `BASE/<slug>` (rendered HTML); read `<html lang>` → `'th'|'en'`;
`extractEntryContent` → inner HTML; `unlazy` + `toSiteRelative`; mirror every `/wp-content/` asset into
`public/` (decode the path like the hardened `extract-pages` `mirrorAsset`); then
`htmlToMarkdown(stripDiviCruft(html))` → write `src/content/policies/<slug>.md` via
`toFrontmatter({ title, lang, slug, path: '/'+slug })` (title from `<title>`, with the ` | Opendream`
suffix stripped). Reuses `scripts/lib/convert.mjs` + `scripts/lib/pages.mjs`; no `disable-json-api`
toggle (render-scrape, not REST). Run via the `extract-pages` service (socat tunnel to the WP +
node-html-parser/turndown) with a command override.

### 3. `src/content.config.ts` — add a `policies` collection
```ts
const policies = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/policies' }),
  schema: z.object({
    title: z.string(),
    lang: z.enum(['th', 'en']),
    slug: z.string(),
    path: z.string(),
  }),
});
export const collections = { posts, projects, policies };
```
(Policy pages have no date/cover/category needs, so a minimal schema — not `baseSchema`.)

### 4. `src/layouts/PageLayout.astro` (new) — minimal content layout
`BaseLayout` (title/lang/path/chrome) wrapping the live plain-page structure so the prose is styled:
```
<div id="et-main-area"><div class="container"><div id="content-area"><div class="left-area">
  <article class="et_pb_post"><h1 class="entry-title">{title}</h1>
    <div class="entry-content"><slot/></div>
  </article>
</div></div></div></div>
```

### 5. `src/pages/[...path].astro` — route the policies
Add the `policies` collection in `getStaticPaths` (kind `policy`) → render
`<PageLayout title lang path><Content/></PageLayout>`. Guard against path collisions with
posts/projects/manifest pages.

## Verification (Dockerized)
- All 15 URLs → 200; each renders chrome (`top-menu`/`main-footer`) + content in `.entry-content`.
- Real policy text present (e.g. doctorme contains "Privacy Policy"/"Effective date"); markdown
  headings/lists/links preserved; `<html lang>` matches the expected lang per the list above.
- No `data:image` placeholders; no `localhost:8080`/`opendream.co.th` leaks in `dist`; local asset
  refs on 2–3 pages resolve.
- Pipeline tests pass (incl. the new `extractEntryContent` test); clean Docker build.
- Human visual gate: a sample of policy pages vs `localhost:8080`.

## Risks / notes
- `extractEntryContent` must scope to `article .entry-content` — a naive `.entry-content` match could
  grab a footer/widget copy. The unit test covers this.
- Policy media: legal pages are mostly text; any images are mirrored under `/wp-content/` (same as
  designed pages); markdown `<img>` src stay root-relative after `toSiteRelative`.
- `judies-privacy-policy` and `judies-privacy-policy-1` both have English titles — possibly near
  duplicates. Each keeps its own URL (faithful coverage); note any duplication at verification, don't drop.
- Title suffix: strip ` | Opendream` from `<title>` for the frontmatter `title`.
