# Phase 5 — De-Divi cleanup (final)

> Executes Phase 5 of `2026-06-18-content-architecture-spec.md`: drop the orphaned `services` pages
> and remove every remaining Divi dependency (vendor CSS, PurgeCSS crutch, `DEFAULT_BODY_CLASS`, the
> preserve-HTML route, the Divi theme asset dirs), leaving a small, all-`.od-*` CSS surface.

**Goal:** No Divi anywhere in `dist`; tiny CSS bundle; all kept URLs still 200 in both languages.

## Investigation findings (verified before deleting)

- **`et-cache/` + `themes/` under `public/wp-content/`** (720K+608K, 45 files w/ `et_pb_`/divi) are
  referenced only by the per-page CSS we're deleting → they'd otherwise leak Divi into `dist`. **Delete.**
- **Service pages are NOT orphaned:** 57 links across 46 project bodies point to `/projects/<svc>` &
  `/en/projects_en/<svc>` (the "ประเภท / Type" line; some EN ones already 404). Must **delink** (keep label).
- **No Divi markup** in any post/project/policy body (0 files) → removing Divi CSS won't affect content.
- **nav.{th,en}.json** link only kept pages. **translations.json** has 32 dead service-path keys.
- **Fonts:** modern.css sets no `body` font — the body font comes from vendor Divi CSS. Worse, the
  effective stack is `thonburi`(macOS-only)/`Prompt`(not loaded) → real visitors already fall back to
  generic sans. Replace with a robust stack from the **loaded** Google Fonts.
- **Scripts:** `extract-pages.mjs`, `extract-trailing.mjs`, `port-divi-parent.mjs`, `purge-css.mjs` are
  dead. `lib/pages.mjs#extractBoc` is dead (only `extract-pages` used it); `extractEntryContent`/
  `collectWpContentUrls`/`unlazy` are still used by `extract-content-pages.mjs` (policy regen) → keep.

## Changes

**Type system (do first — prevents a serif regression):** in `modern.css` add
`body{font-family:'Open Sans','Noto Sans Thai',system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--od-ink);-webkit-font-smoothing:antialiased}`
and `h1..h6{font-family:'Montserrat','Noto Sans Thai','Open Sans',sans-serif}` (all four load via BaseLayout).

**Remove Divi from the shipped site:**
1. `global.css` — drop the 6 `vendor/*` `@import`s and all Divi-specific rules (`.et-waypoint`,
   `.et_pb_portfolio_items`, dead `.project-grid/.project-filter/.project-card*`). Keep `modern.css`
   import + `color-scheme` + `img{max-width}`.
2. Delete `src/styles/vendor/` (6 files, ~868K).
3. Delete `public/wp-content/et-cache/` + `public/wp-content/themes/` (keep `uploads/`).
4. `BaseLayout.astro` — remove `DEFAULT_BODY_CLASS`, `bodyClass`, `pageStyles`; `<body>` (no class).
5. `[...path].astro` — remove the manifest import, the `pageHtml`/`pageCss` globs, the `designed`
   array, and the `kind:'page'` branch (+ now-unused `BaseLayout` import). Routes only
   posts/projects/policies/pages-mdx.

**Delete services + dead designed-page files:**
6. Delete `src/content/pages/**/*.html` (37: services + home/projects/trailing) — keep the 7 `.mdx`.
7. Delete `src/content/pages/manifest.json`.
8. Delete `src/styles/pages/` (38 per-page CSS).

**Fix inbound links:** delink the 57 service links in project bodies
(`[label](/…/projects[_en]/<svc>)` → `label`), preserving `/project/<slug>` (singular) links.

**Tooling/config:**
9. Delete `scripts/{extract-pages,extract-trailing,port-divi-parent,purge-css}.mjs`.
10. `lib/pages.mjs` — drop `extractBoc`; `lib/pages.test.mjs` — drop its `extractBoc` tests.
11. `package.json` — `build` → `astro build`; remove `purgecss` devDep; regenerate `package-lock.json`.
12. `docker-compose.yml` — remove the `extract-pages` service.
13. `translations.json` — remove the 32 service-path keys.

## Verification

- `docker compose up -d --build web` (build no longer runs PurgeCSS); spot-check kept URLs 200 in both langs.
- **`grep -r 'et_pb_\|divi-parent\|#et-boc' dist` → 0** (the spec's final gate).
- CSS bundle is small (no Divi); before/after screenshots of home + about + a project + blog confirm no
  font/layout regression (fonts now on loaded Open Sans/Montserrat/Noto Sans Thai).
- Project "ประเภท/Type" text still shows (just unlinked); no 404s from removed services.
- Pipeline tests pass.
