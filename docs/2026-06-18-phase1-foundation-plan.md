# Content Architecture — Phase 1 Plan: Foundation (MDX + content components)

> Spec: `docs/2026-06-18-content-architecture-spec.md`. Controller-executed with headless screenshot verification.

**Goal:** Add MDX support and a clean, reusable set of content components (`.od-*`) that the
designed pages (Phase 4) and `/projects` metadata (Phase 2) will compose from. No existing page
changes yet — purely additive.

## Tasks
1. **MDX integration** — add `@astrojs/mdx`; update `astro.config.mjs` integrations + `package.json`
   (+ lockfile via a throwaway Docker `npm install --package-lock-only`).
2. **Content components** (`src/components/content/`):
   - `Section.astro` `{ bg?, class? }` — full-bleed section wrapping `.od-container`.
   - `Hero.astro` `{ title, subtitle?, image?, bg?, dark? }` — banner (generalises the existing `.od-hero`).
   - `Blurbs.astro` `{ cols? }` + `Blurb.astro` `{ title, image?, href? }` (slot = body) — card grid.
   - `Gallery.astro` `{ images: {src,alt}[], cols? }` — responsive image grid.
   - `Map.astro` `{ src, title? }` — responsive iframe (contact map).
   - `CTA.astro` `{ title?, text?, href?, label? }` — call-to-action band.
   - `Button.astro` `{ href, variant? }` (slot = label) — styled link.
   - CSS for all in `modern.css` (`.od-section/.od-blurbs/.od-blurb/.od-gallery/.od-map/.od-cta/.od-btn`;
     generalise `.od-hero` to take bg/image/dark; update `BlogHero` to use `<Hero>`).
3. **Styleguide demo** — `src/pages/styleguide.mdx` (routed MDX importing + exercising every component),
   to prove MDX works and visually verify the kit; `Disallow: /styleguide` in robots.txt.
4. **Build + verify** — clean build (purge keeps `/^od-/`); headless screenshot of `/styleguide`
   desktop+mobile; confirm each component renders; all existing pages still 200; tests pass. Commit.

## Verification
- `/styleguide` 200 and renders all components; MDX compiles.
- Representative existing pages (`/`, `/blog`, `/projects`, a post) still 200 + visually unchanged
  (BlogHero refactor didn't regress).
- `docker compose --profile tools run --rm test` passes; clean build.
