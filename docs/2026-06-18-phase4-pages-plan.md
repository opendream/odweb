# Phase 4 — Pages (about / join-us / announcement / contact) → MDX

> Executes Phase 4 of `2026-06-18-content-architecture-spec.md`: convert the bespoke designed
> pages from preserved Divi HTML into content-driven **MDX** rendered by `ComposedLayout` with the
> existing `.od-*` content components. Per-page, screenshot-verified vs the live WP (localhost:8080).

**Goal:** Replace the 7 preserved-HTML core pages with clean MDX so they're de-Divi'd and editable as content.

**Scope (7 pages):** TH `about-us`, `contact`, `join-us`, `announcement`; EN `about_en`, `contact_en`,
`join-us_en`. (No EN announcement — TH-only on the source.) URLs unchanged.

**Out of scope / dropped (per earlier decision):** the parallax strip + "Our Clients" logos section
on about/join-us. Services pages + Divi-CSS removal stay in Phase 5.

## Infrastructure (once, sequential — before pages)

1. **`src/content.config.ts`** — add a `pages` MDX collection:
   `glob({ pattern: '**/*.mdx', base: './src/content/pages' })`, schema `{ title, lang, slug, path, description? }`.
2. **`src/pages/[...path].astro`** — add `getCollection('pages')` mapped as `kind: 'page-mdx'`; render via
   `ComposedLayout` with `<Content components={mdxComponents} />`, passing the content components so MDX
   can use `<Hero/>` etc. without per-file imports. Import the 8 components + ComposedLayout.
3. **Avoid route collisions** — delete the 7 old `.html` (`src/content/pages/{th,en}/…`) + their per-page
   `.css` (`src/styles/pages/{th,en}-…css`) and remove their 7 `manifest.json` entries, so the
   preserve-HTML route no longer emits `/about-us` etc.
4. **Hero component** — add an optional `class` prop (1 line) so pages can apply `.od-hero--brand`.
5. **`src/styles/modern.css`** — add: `.od-hero--brand` (dark gradient banner); `.od-prose--center`
   (centered intro/closing prose, max 760px); `.od-logos .od-blurb__img{aspect-ratio:1/1}` (square project
   logos in about); `.od-contact` (map 2fr / address 1fr, stacks on mobile); `.od-roles`/`.od-role`
   (icon + h3 + text grid for join-us).

## Per-page recipe (each = one reviewed, screenshot-verified unit)

All heroes: `<Hero class="od-hero--brand" dark title subtitle />`. Images keep their mirrored
`/wp-content/uploads/…` paths (verified present in `public/`).

- **about-us / about_en** — Hero → full-width team banner (`opendream-about.jpg`, in a `<Section>`) →
  intro (`.od-prose--center`: h2 + lead ¶) → `<div class="od-logos"><Blurbs cols={3}>` of **6** project
  `<Blurb image href title>` (Corrupt, DoctorMe, PODD, Taejai, Judies, Balloon — TH/EN links + sentences
  exactly as source) → partners closing `<Section>` `.od-prose` (¶ with Google/Oxfam/Skoll/CMU links +
  join links + "founded 2007").
- **contact / contact_en** — Hero → `<Section>` `.od-contact`: left `<Map src="<google embed>"/>`, right
  `.od-prose` address block (company, address, Tel, Email, Location link). Exact strings per source.
- **announcement** (TH) — Hero → `<Section>`: h2 "ประกาศจัดซื้อจัดจ้าง" + one item (date "13 พฤษภาคม 2565" +
  description) + `<Button href="/wp-content/uploads/2022/07/TOR-Fake-News-Content-Production.pdf">ดาวน์โหลด</Button>`.
- **join-us / join-us_en** — Hero → `<CTA title="สำหรับองค์กร / For Organization" text=… href=<gform> label=…>` →
  centered h2 "สำหรับบุคคลทั่วไป / For Individuals" → `<Section>` `.od-roles`: TH **2** roles (dev, design),
  EN **4** roles (Program Developer, Game Developer (Unity), Software Developer iOS/Android, Graphic Designer)
  — each icon + h3 + ¶(s), exact text → closing `.od-prose--center` ("หากคุณอ่านมาถึงตรงนี้ / If you have read
  this far…", email).

## Verification (per page + final)

- `docker compose up -d --build web`; each URL returns 200; both langs.
- Headless screenshot each of the 7 vs `localhost:8080` — content + structure faithful (modernised, not
  pixel-identical); images resolve; links correct; hreflang switcher pairs.
- `grep` the 7 pages in `dist` show **no** `et_pb_`/`#et-boc`. Pipeline tests still pass. Clean build.

## Notes / risks

- MDX uses components via the `components` prop (clean, CMS-friendly — no imports in content files).
- about/about_en are structurally identical (EN text + `-en` project links); join-us differs by role count.
- The Google Maps embed + Google Form links are external; kept verbatim.
