# Frontpage Responsiveness + Blog Gradient Covers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Make the home project showcase collapse from 2→1 column on a reliable **viewport-width** breakpoint instead of screen orientation, and (2) give coverless blog posts a deterministic gradient placeholder (the same `gradientFor()` look projects already use) on both the listing cards and the single-post cover, instead of rendering nothing.

**Architecture:** Two independent, small front-end changes. Issue 1 is a one-line CSS media-query swap in `src/styles/modern.css` (plus its comment). Issue 2 reuses the existing `src/lib/gradient.mjs` `gradientFor(key)` helper in `PostCard.astro` (listing) and `PostLayout.astro` (single post), keyed on the post path so a given post gets the same gradient in both places. Plain gradient, no text overlay (the title already appears in the card and as the H1).

**Tech Stack:** Astro 5 components + `src/styles/modern.css` (`.od-*` design system). No new dependencies, no new files. Build/verify in Docker.

**Branch:** These changes are independent of the SEO work and live on the `cosmetic-touch-up` branch (off `main`).

**How to run things (no Node on host — everything is Docker):**
- Build + **export host `dist/`** for inspection: `make dist` (builds in Docker, copies the output to the host `dist/`). NOTE: `make up`/`make rebuild` build inside the image and serve at `:4321` but do **not** write host `dist/` — use `make dist` when you need to grep the built files.
- Serve for visual check: `make up` then open `http://localhost:4321`.
- Unit tests (regression only): `docker compose --profile tools run --rm test`.

**Out of scope:** `og:image` for coverless posts is unchanged — it correctly continues to fall back to `/media/og-default.png` (a CSS gradient cannot be an OG image). No changes to project tiles (they already use `gradientFor`). No new breakpoint tiers (showcase stays 2-column above the breakpoint).

---

## File Structure

**Modify only:**
- `src/styles/modern.css` — swap the showcase media query (Task 1); add one placeholder aspect-ratio rule (Task 3).
- `src/components/PostCard.astro` — gradient fallback for coverless listing cards (Task 2).
- `src/layouts/PostLayout.astro` — gradient fallback for the coverless single-post cover (Task 3).

---

## Task 1: Home showcase — collapse by width, not orientation

**Files:**
- Modify: `src/styles/modern.css` (the `.od-showcase` block, around lines 117–120)

- [ ] **Step 1: Replace the showcase comment + media query.** In `src/styles/modern.css`, replace:

```css
/* Full-bleed magazine grid: square covers touching edge-to-edge — 2 columns on landscape
   (wide) screens, 1 full-width column on portrait (vertical) screens. Name + subtle zoom on hover. */
.od-showcase { display: grid; grid-template-columns: 1fr 1fr; gap: 0; max-width: var(--od-max); margin: 0 auto; }
@media (orientation: portrait) { .od-showcase { grid-template-columns: 1fr; } }
```

with:

```css
/* Full-bleed magazine grid: square covers touching edge-to-edge — 2 columns on wider screens,
   1 full-width column at/below the mobile breakpoint so tablet portrait widths stay two-up.
   Name + subtle zoom on hover. */
.od-showcase { display: grid; grid-template-columns: 1fr 1fr; gap: 0; max-width: var(--od-max); margin: 0 auto; }
@media (max-width: 640px) { .od-showcase { grid-template-columns: 1fr; } }
```

- [ ] **Step 2: Confirm no other orientation-based rules remain.**

Run: `grep -n "orientation" src/styles/*.css`
Expected: no matches (this was the only one).

- [ ] **Step 3: Build and visually verify the fix.**

Run: `make up`
Open `http://localhost:4321` and resize the browser to a **tall, narrow-ish but still wide** desktop window (e.g. ~900px wide × ~1200px tall — portrait orientation, but width > 640px). The showcase must stay **2 columns** (previously it collapsed to 1). Tablet portrait widths such as 768px must also stay **2 columns**. Then narrow to 640px or below → it collapses to a single column.

- [ ] **Step 4: Commit**

```bash
git add src/styles/modern.css
git commit -m "fix(home): collapse project showcase by width, not orientation"
```

---

## Task 2: Coverless blog listing cards — gradient placeholder

**Files:**
- Modify: `src/components/PostCard.astro`

Note on layout: `.od-postcard__img` is a flex child of `.od-postcard` (flex column), so it is blockified and keeps its `aspect-ratio: 16/10` box even when empty. An inline `background` overrides the default `#f3f4f6` gray. No CSS change is needed.

- [ ] **Step 1: Replace the entire contents of `src/components/PostCard.astro`:**

```astro
---
// Clean, de-Divi'd blog post card: cover image, title, excerpt. Styled by .od-postcard in modern.css.
// Posts without a cover fall back to a deterministic gradient block (same look as project tiles).
import { gradientFor } from '../lib/gradient.mjs';
interface Props { title: string; href: string; excerpt?: string; cover?: string; }
const { title, href, excerpt, cover } = Astro.props;
---
<a href={href} class="od-postcard">
  {cover
    ? <span class="od-postcard__img"><img src={cover} alt={title} loading="lazy" /></span>
    : <span class="od-postcard__img" style={`background:${gradientFor(href)}`}></span>}
  <h2 class="od-postcard__title">{title}</h2>
  {excerpt && <p class="od-postcard__excerpt">{excerpt}</p>}
</a>
```

- [ ] **Step 2: Build, export, and verify a coverless card renders the gradient.**

Run: `make dist`
The TH blog has coverless posts (the EN blog does not). Find one and confirm the listing card now carries a gradient background:
```bash
grep -L "^cover:" src/content/posts/th/*.md | head -3   # e.g. election-2554-mps-per-province
grep -o 'class="od-postcard__img" style="background:linear-gradient[^"]*"' dist/blog/index.html | head -3
```
Expected: one or more `.od-postcard__img` spans with an inline `background:linear-gradient(...)`. A post **with** a cover must still render `<span class="od-postcard__img"><img ...></span>` (unchanged).

- [ ] **Step 3: Visual check.**

Open `http://localhost:4321/blog` and confirm coverless cards show a colored gradient block in the 16/10 image slot (not an empty/collapsed gap), with the title + excerpt below as usual. (If a placeholder box appears collapsed to zero height — not expected — add `display: block;` to the `.od-postcard__img` rule in `modern.css` and rebuild.)

- [ ] **Step 4: Commit**

```bash
git add src/components/PostCard.astro
git commit -m "feat(blog): gradient placeholder for coverless post cards"
```

---

## Task 3: Coverless single post — gradient cover

**Files:**
- Modify: `src/layouts/PostLayout.astro`
- Modify: `src/styles/modern.css` (add one rule near `.od-article__cover`)

Note on layout: `.od-article__cover` is styled for an `<img>` (it has no `aspect-ratio`; height comes from the image). The gradient version is a `<div>` with no intrinsic height, so it needs an explicit aspect-ratio. Use `16 / 9` for a hero-banner feel.

- [ ] **Step 1: Add the placeholder aspect-ratio rule.** In `src/styles/modern.css`, immediately after the existing line:

```css
.od-article__cover { width: 100%; border-radius: 12px; margin: 6px 0 34px; display: block; }
```

add:

```css
.od-article__cover--ph { aspect-ratio: 16 / 9; }
```

- [ ] **Step 2: Render the gradient when there's no cover.** In `src/layouts/PostLayout.astro`, add this import to the frontmatter (after the existing `import { blogPostingLd, breadcrumbLd } from '../lib/seo.mjs';` line):

```astro
import { gradientFor } from '../lib/gradient.mjs';
```

Then replace the cover line:

```astro
    {cover && <img class="od-article__cover" src={cover} alt={title} />}
```

with:

```astro
    {cover
      ? <img class="od-article__cover" src={cover} alt={title} />
      : <div class="od-article__cover od-article__cover--ph" style={`background:${gradientFor(path)}`}></div>}
```

(`gradientFor(path)` uses the same key the listing card uses via `href`, so a post's card and its page show the same gradient.)

- [ ] **Step 3: Build, export, and verify the coverless post page.**

Run: `make dist`
Using a coverless post from Task 2 (e.g. path `/blog/election-2554-mps-per-province`):
```bash
grep -o 'class="od-article__cover od-article__cover--ph" style="background:linear-gradient[^"]*"' dist/blog/election-2554-mps-per-province/index.html
```
Expected: one match (the gradient cover div). A post **with** a cover must still render `<img class="od-article__cover" ...>` — verify on any covered post, e.g.:
```bash
grep -o '<img class="od-article__cover"' dist/blog/opendream-style/index.html
```
Expected: one match.

- [ ] **Step 4: Visual check.**

Open `http://localhost:4321/blog/election-2554-mps-per-province` and confirm a gradient banner appears where the cover image would be (full width, rounded, ~16:9), above the article body.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/PostLayout.astro src/styles/modern.css
git commit -m "feat(blog): gradient cover for coverless single posts"
```

---

## Task 4: Final regression verification

**Files:** none (verification)

- [ ] **Step 1: Unit tests still green** (no logic changed, but confirm nothing broke):

Run: `docker compose --profile tools run --rm test`
Expected: all tests pass.

- [ ] **Step 2: Clean build + export.**

Run: `make dist`
Expected: succeeds; prints an exported file count.

- [ ] **Step 3: Spot-check no regressions in the built output:**

```bash
echo "showcase orientation rule gone (expect 0):"; grep -c "orientation" src/styles/modern.css
echo "covered post still uses <img> cover (expect 1):"; grep -c '<img class="od-article__cover"' dist/blog/opendream-style/index.html
echo "covered project tiles unchanged — home still has tiles (expect >0):"; grep -c 'od-showcase__tile' dist/index.html
```
Expected: orientation `0`; covered-post `1`; home tiles `>0`.

- [ ] **Step 4: Final visual pass.** At `http://localhost:4321`: home showcase is 2-up on a wide-but-tall window and tablet portrait widths, and 1-up at/below 640px; `/blog` coverless cards and a coverless post page both show gradients; covered posts/cards still show their real images.

---

## Self-Review (completed by plan author)

**Requirement coverage:**
- Issue 1 (orientation → width) → Task 1 (swap `@media (orientation: portrait)` for `@media (max-width: 640px)`; Step 2 proves it's the only orientation rule) ✓
- Issue 2 (gradient cover for coverless posts) → Task 2 (listing cards) + Task 3 (single-post cover), both reusing `gradientFor` keyed on the post path for consistency ✓
- User decisions honored: 640px breakpoint so tablet portrait widths stay two-column, both cards + post page, plain gradient (no title text) ✓

**Placeholder scan:** No vague steps; every edit shows exact before/after code. Verification uses concrete file paths (a known coverless post `election-2554-mps-per-province` and a known covered post `opendream-style`).

**Consistency:** `PostCard` keys the gradient on `href` and `PostLayout` on `path`; in `blog/index.astro` the card is called with `href={p.data.path}`, so both resolve to the same value → identical gradient per post. The `make dist` export step is used wherever the built HTML is grepped (host `dist/` is otherwise stale — see CLAUDE.md). CSS class names `.od-article__cover--ph` match between Task 3's CSS rule and its markup.

**Scope:** `og:image` fallback unchanged (gradients are CSS-only); project tiles untouched; no new breakpoint tiers. Minimal, focused edits.
