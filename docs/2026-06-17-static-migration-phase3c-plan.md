# Static Migration Phase 3c Implementation Plan — Service pages + faithful /projects design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the ~33 service pages at their nested `/projects/<slug>` + `/en/projects_en/<slug>` URLs via the proven preserve-HTML pipeline, and rebuild the `/projects` + `/en/projects_en` landings as a data-driven grid that reproduces the live Divi filterable-portfolio look.

**Architecture:** Service pages reuse `scripts/extract-pages.mjs` + the generic `[...path].astro` route (no new route code). The landings stay driven by the `projects` content collection but render their cards in Divi `et_pb_portfolio_item` markup wrapped in the Divi `#et-boc → .et-l → section → row → column → module` nesting, so the already-global `src/styles/vendor/divi-parent.css` (which carries the portfolio grid/overlay/filter CSS) plus the scraped per-page CSS both style them. A tiny tested pure module maps our category labels to the 4 live sector slugs that drive the filter.

**Tech Stack:** Astro 5, the existing `extract-pages` pipeline (`unlazy`, `node-html-parser`), Docker, Vitest.

**Spec:** `docs/2026-06-17-static-migration-phase3c-spec.md`. **Git:** `site/` repo, branch `main`, commit per task.

**Preconditions:** local WP up (`curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/projects/web-application` → `200` after redirect, `301` without `-L`). Run Node tooling via Docker.

---

## File Structure
```
site/
  scripts/extract-pages.mjs               # MODIFY: add 33 service + 2 landing entries to PAGES
  scripts/lib/categories.mjs              # NEW: label→sector-slug map + SECTORS list (pure)
  scripts/lib/categories.test.mjs         # NEW: vitest for the above
  src/content/pages/{th,en}/*.html        # NEW (generated, service pages + unused landing html)
  src/styles/pages/*.css                  # NEW (generated, incl. th-projects.css, en-projects_en.css)
  src/content/pages/manifest.json         # UPDATED (9 → ~44 entries)
  public/wp-content/…                     # NEW (generated assets)
  src/pages/[...path].astro               # MODIFY: exclude the two landing paths from routing
  src/components/ProjectCard.astro        # REWRITE: emit Divi portfolio-item markup
  src/pages/projects/index.astro          # REWRITE: faithful TH filterable portfolio (data-driven)
  src/pages/en/projects_en/index.astro    # REWRITE: faithful EN filterable portfolio (data-driven)
```

---

## Task 1: Scrape the service pages + landing CSS

**Files:** Modify `scripts/extract-pages.mjs`.

- [ ] **Step 1: Add the service-page + landing entries to the `PAGES` array**

In `scripts/extract-pages.mjs`, the `PAGES` array currently ends with the `join-us_en` entry. Insert the following entries before the closing `];` (keep all existing entries):
```js
  // Phase 3c — service pages (children of the projects landing), preserve-HTML
  { path: '/projects/chatbot',                  lang: 'th', slug: 'chatbot' },
  { path: '/projects/crowdfunding',             lang: 'th', slug: 'crowdfunding' },
  { path: '/projects/crowdsourcing',            lang: 'th', slug: 'crowdsourcing' },
  { path: '/projects/e-commerce',               lang: 'th', slug: 'e-commerce' },
  { path: '/projects/graphic-design',           lang: 'th', slug: 'graphic-design' },
  { path: '/projects/interactive-infographic',  lang: 'th', slug: 'interactive-infographic' },
  { path: '/projects/intranet',                 lang: 'th', slug: 'intranet' },
  { path: '/projects/mobileapplication',        lang: 'th', slug: 'mobileapplication' },
  { path: '/projects/mobilegame',               lang: 'th', slug: 'mobilegame' },
  { path: '/projects/online-donation',          lang: 'th', slug: 'online-donation' },
  { path: '/projects/online-payment',           lang: 'th', slug: 'online-payment' },
  { path: '/projects/online-ticketing-system',  lang: 'th', slug: 'online-ticketing-system' },
  { path: '/projects/open-data',                lang: 'th', slug: 'open-data' },
  { path: '/projects/project',                  lang: 'th', slug: 'project' },
  { path: '/projects/web-application',          lang: 'th', slug: 'web-application' },
  { path: '/projects/web-portal',               lang: 'th', slug: 'web-portal' },
  { path: '/projects/website',                  lang: 'th', slug: 'website' },
  { path: '/en/projects_en/chatbot',                 lang: 'en', slug: 'chatbot' },
  { path: '/en/projects_en/crowdfunding',            lang: 'en', slug: 'crowdfunding' },
  { path: '/en/projects_en/crowdsourcing',           lang: 'en', slug: 'crowdsourcing' },
  { path: '/en/projects_en/graphic-design',          lang: 'en', slug: 'graphic-design' },
  { path: '/en/projects_en/interactive-infographic', lang: 'en', slug: 'interactive-infographic' },
  { path: '/en/projects_en/intranet',                lang: 'en', slug: 'intranet' },
  { path: '/en/projects_en/mobile-application',       lang: 'en', slug: 'mobile-application' },
  { path: '/en/projects_en/mobilegame',              lang: 'en', slug: 'mobilegame' },
  { path: '/en/projects_en/online-donation',         lang: 'en', slug: 'online-donation' },
  { path: '/en/projects_en/online-payment',          lang: 'en', slug: 'online-payment' },
  { path: '/en/projects_en/online-ticketing-system', lang: 'en', slug: 'online-ticketing-system' },
  { path: '/en/projects_en/open-data',               lang: 'en', slug: 'open-data' },
  { path: '/en/projects_en/project',                 lang: 'en', slug: 'project' },
  { path: '/en/projects_en/web-application',          lang: 'en', slug: 'web-application' },
  { path: '/en/projects_en/web-portal',              lang: 'en', slug: 'web-portal' },
  { path: '/en/projects_en/website',                 lang: 'en', slug: 'website' },
  // Phase 3c — the two landings, scraped for their per-page CSS + bodyClass only
  // (routing is owned by the index.astro listings; excluded in [...path].astro)
  { path: '/projects',        lang: 'th', slug: 'projects' },
  { path: '/en/projects_en',  lang: 'en', slug: 'projects_en' },
```

- [ ] **Step 2: Run the scrape**

Run: `cd /Users/keng/Workspaces/odweb/site && docker compose --profile tools run --rm extract-pages 2>&1 | tail -40`
Expected: a `page[..] <path>: …B html, …B css` line for each new entry (33 service + 2 landings), each with non-trivial bytes and a `bodyClass` containing `page-id-…`/`et-db`.

- [ ] **Step 3: Verify outputs**
```bash
cd /Users/keng/Workspaces/odweb/site
ls src/content/pages/th/web-application.html src/content/pages/en/web-application.html src/styles/pages/th-projects.css src/styles/pages/en-projects_en.css
echo "manifest entries: $(grep -oc '"path"' src/content/pages/manifest.json)"   # expect ~44
( grep -rl "localhost:8080\|//opendream.co.th" src/content/pages src/styles/pages && echo LEAK ) || echo "no origin leaks"
echo "data:image placeholders on a sample service page: $(grep -oc 'data:image' src/content/pages/th/web-application.html)"  # expect 0
```
Expected: files exist; manifest ≈ 44; no origin leaks; 0 `data:image` (unlazy handled them). If a service page's html is tiny or a `fullwidth_code` section is empty (JS-rendered on the original), note it as DONE_WITH_CONCERNS for the verification task.

- [ ] **Step 4: Commit**
```bash
cd /Users/keng/Workspaces/odweb/site
git add -A && git commit -q -m "feat(pages): scrape 33 service pages + the two projects-landing CSS files"
```

---

## Task 2: Route the service pages (exclude the landings)

**Files:** Modify `src/pages/[...path].astro`.

The manifest now contains the two landing entries (`/projects`, `/en/projects_en`). Those paths are owned by the `index.astro` listing routes, so they must NOT also be emitted by the rest route, or the build hits duplicate routes.

- [ ] **Step 1: Extend the manifest exclusion filter**

In `src/pages/[...path].astro`, find (around line 16):
```js
    .filter((m) => m.path !== '/' && m.path !== '/en/')
```
Replace with:
```js
    .filter((m) => m.path !== '/' && m.path !== '/en/' && m.path !== '/projects' && m.path !== '/en/projects_en')
```

- [ ] **Step 2: Build**

Run: `cd /Users/keng/Workspaces/odweb/site && docker compose up -d --build web 2>&1 | tail -6`
Expected: clean build, no duplicate-route error.

- [ ] **Step 3: Smoke-check the service routes**
```bash
cd /Users/keng/Workspaces/odweb/site
for u in /projects/web-application /projects/chatbot /projects/mobilegame /projects/open-data /projects/project \
         /en/projects_en/web-application /en/projects_en/chatbot /en/projects_en/project; do
  echo "$u -> $(curl -s -o /dev/null -w '%{http_code}' -L "http://localhost:4321$u")"; done   # all 200
echo "landings still serve (old listing): /projects -> $(curl -s -o /dev/null -w '%{http_code}' -L http://localhost:4321/projects)  /en/projects_en -> $(curl -s -o /dev/null -w '%{http_code}' -L http://localhost:4321/en/projects_en)"
```
Expected: all service URLs → 200; both landings → 200 (still the old card listing — restyled in Task 4).

- [ ] **Step 4: Commit**
```bash
cd /Users/keng/Workspaces/odweb/site
git add -A && git commit -q -m "feat(pages): route service pages; exclude landings from rest route"
```

---

## Task 3: Category → sector-slug mapping (TDD)

**Files:** Create `scripts/lib/categories.mjs`, `scripts/lib/categories.test.mjs`.

This pure module maps our project frontmatter category labels (TH + EN) to the 4 live sector slugs and exposes the ordered filter list. It is imported by `ProjectCard` (for the item classes) and the listings (for the filter bar). It lives under `scripts/lib/` so the existing Vitest config (`npx vitest run scripts/lib/`) picks it up.

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/categories.test.mjs`:
```js
import { describe, it, expect } from 'vitest';
import { sectorSlugs, SECTORS } from './categories.mjs';

describe('sectorSlugs', () => {
  it('maps a TH sector label and ignores non-sector (type) labels', () => {
    expect(sectorSlugs(['การศึกษา', 'Web Application'])).toEqual(['education']);
  });
  it('maps EN sector labels', () => {
    expect(sectorSlugs(['Health', 'Other'])).toEqual(['health', 'other']);
  });
  it('dedupes labels that map to the same slug', () => {
    expect(sectorSlugs(['อื่น ๆ', 'Other', 'Mobile Game'])).toEqual(['other']);
  });
  it('returns [] for empty or undefined input', () => {
    expect(sectorSlugs()).toEqual([]);
    expect(sectorSlugs([])).toEqual([]);
  });
});

describe('SECTORS', () => {
  it('lists all + the 4 sectors in the live filter order', () => {
    expect(SECTORS.map((s) => s.slug)).toEqual(['all', 'education', 'livelihood', 'health', 'other']);
  });
  it('carries TH and EN labels for each', () => {
    const edu = SECTORS.find((s) => s.slug === 'education');
    expect(edu.th).toBe('การศึกษา');
    expect(edu.en).toBe('Education');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/keng/Workspaces/odweb/site && docker compose --profile tools run --rm test 2>&1 | tail -15`
Expected: FAIL — cannot resolve `./categories.mjs`.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/categories.mjs`:
```js
// Maps project frontmatter category labels (TH + EN) to the 4 sector slugs used by the
// live /projects filterable-portfolio filter. Type labels (e.g. "Web Application") are not
// sectors and map to nothing. SECTORS is the ordered filter list (all + 4 sectors).
const SECTOR_BY_LABEL = {
  'การศึกษา': 'education',   Education: 'education',
  'ความเป็นอยู่': 'livelihood', Livelihood: 'livelihood',
  'สุขภาพ': 'health',        Health: 'health',
  'อื่น ๆ': 'other',         Other: 'other',
};

export function sectorSlugs(categories = []) {
  const out = [];
  for (const c of categories) {
    const slug = SECTOR_BY_LABEL[c];
    if (slug && !out.includes(slug)) out.push(slug);
  }
  return out;
}

export const SECTORS = [
  { slug: 'all',        th: 'ทั้งหมด',     en: 'All' },
  { slug: 'education',  th: 'การศึกษา',    en: 'Education' },
  { slug: 'livelihood', th: 'ความเป็นอยู่', en: 'Livelihood' },
  { slug: 'health',     th: 'สุขภาพ',      en: 'Health' },
  { slug: 'other',      th: 'อื่น ๆ',      en: 'Other' },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/keng/Workspaces/odweb/site && docker compose --profile tools run --rm test 2>&1 | grep -E 'Tests|passed|failed'`
Expected: all tests pass (the 11 prior + the new `categories` tests).

- [ ] **Step 5: Commit**
```bash
cd /Users/keng/Workspaces/odweb/site
git add -A && git commit -q -m "feat(projects): tested category→sector-slug mapping for the portfolio filter"
```

---

## Task 4: Faithful landings (ProjectCard + both listings)

**Files:** Rewrite `src/components/ProjectCard.astro`, `src/pages/projects/index.astro`, `src/pages/en/projects_en/index.astro`.

`ProjectCard` is shared by both listings, so all three change together (no broken intermediate state). The cards are image-only with a hover overlay (faithful — the live items have no visible title).

- [ ] **Step 1: Rewrite `src/components/ProjectCard.astro`**

Replace the whole file with:
```astro
---
import { sectorSlugs } from '../../scripts/lib/categories.mjs';
interface Props { title: string; href: string; cover?: string; categories?: string[]; index?: number; }
const { title, href, cover, categories = [], index = 0 } = Astro.props;
const slugs = sectorSlugs(categories);
const catClasses = slugs.map((s) => `project_category_${s}`).join(' ');
---
<div
  class={`et_pb_portfolio_item et_pb_grid_item ${catClasses} et_pb_filterable_portfolio_item_0_${index}`.trim()}
  data-sectors={slugs.join(' ')}
>
  <a href={href}>
    <span class="et_portfolio_image">
      {cover && <img src={cover} alt={title} width="400" height="284" />}
      <span class="et_overlay et_pb_inline_icon" data-icon={'\ue0f7'}></span>
    </span>
  </a>
</div>
```
Note: `data-icon={'\ue0f7'}` (U+E0F7) is the ETmodules glyph the live overlay uses (`&#xe0f7;`); the font is already mirrored globally. The `.et_overlay` reveal-on-hover comes from `divi-parent.css`.

- [ ] **Step 2: Rewrite `src/pages/projects/index.astro` (TH)**

Replace the whole file with:
```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import ProjectCard from '../../components/ProjectCard.astro';
import { SECTORS } from '../../../scripts/lib/categories.mjs';
import manifest from '../../content/pages/manifest.json';

const pageCss = import.meta.glob('../../styles/pages/*.css', { query: '?raw', import: 'default', eager: true });
const pageStyles = pageCss['../../styles/pages/th-projects.css'];
const bodyClass = manifest.find((m) => m.path === '/projects')?.bodyClass;

const items = (await getCollection('projects', (p) => p.data.lang === 'th'))
  .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
---
<BaseLayout title="งานของเรา — Opendream" lang="th" path="/projects" altPath="/en/projects_en" pageStyles={pageStyles} bodyClass={bodyClass}>
  <div id="et-boc" class="et-boc"><div class="et-l">
    <div class="et_pb_section et_pb_section_0 et_section_regular">
      <div class="et_pb_row et_pb_row_0">
        <div class="et_pb_column et_pb_column_4_4 et_pb_column_0 et_pb_css_mix_blend_mode_passthrough et-last-child">
          <div class="et_pb_module et_pb_portfolio et_pb_bg_layout_light et_pb_text_align_left et_pb_filterable_portfolio et_pb_filterable_portfolio_0 clearfix">
            <div class="et_pb_portfolio_filters clearfix">
              <ul class="clearfix">
                {SECTORS.map((s) => (
                  <li class={s.slug === 'all' ? 'et_pb_portfolio_filter et_pb_portfolio_filter_all' : 'et_pb_portfolio_filter'}>
                    <a href="#" class={s.slug === 'all' ? 'active' : undefined} data-category-slug={s.slug}>{s.th}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div class="et_pb_portfolio_items_wrapper no_pagination">
              <div class="et_pb_portfolio_items">
                {items.map((p, i) => (
                  <ProjectCard title={p.data.title} href={p.data.path} cover={p.data.cover} categories={p.data.categories} index={i} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div></div>
  <script is:inline>
    (() => {
      const root = document.currentScript.closest('main') || document;
      const links = root.querySelectorAll('.et_pb_portfolio_filter a');
      const items = root.querySelectorAll('.et_pb_portfolio_item');
      links.forEach((a) => a.addEventListener('click', (e) => {
        e.preventDefault();
        const slug = a.getAttribute('data-category-slug');
        links.forEach((x) => x.classList.toggle('active', x === a));
        items.forEach((it) => {
          const show = slug === 'all' || it.classList.contains('project_category_' + slug);
          it.style.display = show ? '' : 'none';
        });
      }));
    })();
  </script>
</BaseLayout>
```

- [ ] **Step 3: Rewrite `src/pages/en/projects_en/index.astro` (EN)**

Replace the whole file with:
```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../../layouts/BaseLayout.astro';
import ProjectCard from '../../../components/ProjectCard.astro';
import { SECTORS } from '../../../../scripts/lib/categories.mjs';
import manifest from '../../../content/pages/manifest.json';

const pageCss = import.meta.glob('../../../styles/pages/*.css', { query: '?raw', import: 'default', eager: true });
const pageStyles = pageCss['../../../styles/pages/en-projects_en.css'];
const bodyClass = manifest.find((m) => m.path === '/en/projects_en')?.bodyClass;

const items = (await getCollection('projects', (p) => p.data.lang === 'en'))
  .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
---
<BaseLayout title="Projects — Opendream" lang="en" path="/en/projects_en" altPath="/projects" pageStyles={pageStyles} bodyClass={bodyClass}>
  <div id="et-boc" class="et-boc"><div class="et-l">
    <div class="et_pb_section et_pb_section_0 et_section_regular">
      <div class="et_pb_row et_pb_row_0">
        <div class="et_pb_column et_pb_column_4_4 et_pb_column_0 et_pb_css_mix_blend_mode_passthrough et-last-child">
          <div class="et_pb_module et_pb_portfolio et_pb_bg_layout_light et_pb_text_align_left et_pb_filterable_portfolio et_pb_filterable_portfolio_0 clearfix">
            <div class="et_pb_portfolio_filters clearfix">
              <ul class="clearfix">
                {SECTORS.map((s) => (
                  <li class={s.slug === 'all' ? 'et_pb_portfolio_filter et_pb_portfolio_filter_all' : 'et_pb_portfolio_filter'}>
                    <a href="#" class={s.slug === 'all' ? 'active' : undefined} data-category-slug={s.slug}>{s.en}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div class="et_pb_portfolio_items_wrapper no_pagination">
              <div class="et_pb_portfolio_items">
                {items.map((p, i) => (
                  <ProjectCard title={p.data.title} href={p.data.path} cover={p.data.cover} categories={p.data.categories} index={i} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div></div>
  <script is:inline>
    (() => {
      const root = document.currentScript.closest('main') || document;
      const links = root.querySelectorAll('.et_pb_portfolio_filter a');
      const items = root.querySelectorAll('.et_pb_portfolio_item');
      links.forEach((a) => a.addEventListener('click', (e) => {
        e.preventDefault();
        const slug = a.getAttribute('data-category-slug');
        links.forEach((x) => x.classList.toggle('active', x === a));
        items.forEach((it) => {
          const show = slug === 'all' || it.classList.contains('project_category_' + slug);
          it.style.display = show ? '' : 'none';
        });
      }));
    })();
  </script>
</BaseLayout>
```

- [ ] **Step 4: Build**

Run: `cd /Users/keng/Workspaces/odweb/site && docker compose up -d --build web 2>&1 | tail -6`
Expected: clean build.

- [ ] **Step 5: Smoke-check the landings**
```bash
cd /Users/keng/Workspaces/odweb/site
for u in /projects /en/projects_en; do
  H=$(curl -sL "http://localhost:4321$u")
  echo "$u: code=$(curl -s -o /dev/null -w '%{http_code}' -L "http://localhost:4321$u") filters=$(printf '%s' "$H" | grep -oc 'et_pb_portfolio_filter\b') items=$(printf '%s' "$H" | grep -oc 'et_pb_portfolio_item') links=$(printf '%s' "$H" | grep -oc 'href="/project/')"
done
echo "broken images on /projects: $(curl -sL http://localhost:4321/projects | grep -oE 'src="/[^"]+\.(jpg|jpeg|png|svg|webp|gif)"' | grep -oE '/[^"]+' | sort -u | while read u; do c=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:4321$u"); [ "$c" = 200 ]||echo X; done | wc -l | tr -d ' ')"
```
Expected: both 200; 5 filter buttons each (`all` counts once via `et_pb_portfolio_filter_all`, plus 4 → `grep -oc 'et_pb_portfolio_filter\b'` ≈ 5); item count > 0; every card has an `/project/` link; 0 broken images.

- [ ] **Step 6: Commit**
```bash
cd /Users/keng/Workspaces/odweb/site
git add -A && git commit -q -m "feat(projects): faithful filterable-portfolio landings (data-driven)"
```

---

## Task 5: Verification

**Files:** none (fixups only).

- [ ] **Step 1: All service pages 200 + chrome + sections**
```bash
cd /Users/keng/Workspaces/odweb/site
TH="chatbot crowdfunding crowdsourcing e-commerce graphic-design interactive-infographic intranet mobileapplication mobilegame online-donation online-payment online-ticketing-system open-data project web-application web-portal website"
EN="chatbot crowdfunding crowdsourcing graphic-design interactive-infographic intranet mobile-application mobilegame online-donation online-payment online-ticketing-system open-data project web-application web-portal website"
for s in $TH; do u="/projects/$s"; H=$(curl -sL "http://localhost:4321$u"); echo "$u code=$(curl -s -o /dev/null -w '%{http_code}' -L "http://localhost:4321$u") sec=$(printf '%s' "$H"|grep -oc et_pb_section) chrome=$(printf '%s' "$H"|grep -oE 'top-menu|main-footer'|sort -u|tr -d '\n')"; done
for s in $EN; do u="/en/projects_en/$s"; echo "$u code=$(curl -s -o /dev/null -w '%{http_code}' -L "http://localhost:4321$u")"; done
```
Expected: all 200; sections > 0; chrome present (`top-menu`+`main-footer`).

- [ ] **Step 2: Images + assets + leaks on a sample**
```bash
cd /Users/keng/Workspaces/odweb/site
for P in /projects/web-application /projects/mobilegame /en/projects_en/web-application; do
  echo "$P data:image=$(curl -sL "http://localhost:4321$P" | grep -oc 'data:image')"
  curl -sL "http://localhost:4321$P" | grep -oE '(src|href)="/[^"]+"' | grep -oE '/[^"]+' | sort -u | while read u; do
    [ -f "dist$u" ] || [ -f "dist$u/index.html" ] || echo "  MISSING($P) $u"; done
done
grep -rl 'localhost:8080\|http://opendream' dist 2>/dev/null || echo "NO leaks"
```
Expected: 0 `data:image`; no MISSING local assets (external + nav links to still-unbuilt privacy pages are expected — list separately, don't fail on them); NO leaks.

- [ ] **Step 3: Landing filter behaves + count reconcile**
```bash
cd /Users/keng/Workspaces/odweb/site
echo "TH grid items: $(curl -sL http://localhost:4321/projects | grep -oc 'et_pb_portfolio_item')  built TH projects: $(ls src/content/projects/th/*.md | wc -l | tr -d ' ')  live TH portfolio: 52"
echo "EN grid items: $(curl -sL http://localhost:4321/en/projects_en | grep -oc 'et_pb_portfolio_item')  built EN projects: $(ls src/content/projects/en/*.md | wc -l | tr -d ' ')"
echo "any card with NO sector class (won't show under any sector filter):"
curl -sL http://localhost:4321/projects | grep -oE 'class="et_pb_portfolio_item[^"]*"' | grep -v 'project_category_' | head
```
Expected: TH grid ≈ built TH count; reconcile the built-vs-live delta (53 vs 52) — identify whether the extra is a real project or a duplicate and note it (do not silently drop). Cards with no sector class only appear under "all" — list them so the human gate can confirm that matches live.

- [ ] **Step 4: Pipeline tests + clean build**
```bash
cd /Users/keng/Workspaces/odweb/site
docker compose --profile tools run --rm test 2>&1 | grep -E 'Tests|passed|failed'   # all pass
docker compose up -d --build web 2>&1 | tail -3
```
Expected: all tests pass; clean build.

- [ ] **Step 5: Note JS-empty `fullwidth_code` sections + the landing trailing modules for the human gate**

If any service page has a Divi `fullwidth_code` module that renders empty statically, note which page+section. Also note that the live landing has a trailing `fullwidth_code` + image after the portfolio that this plan omits (the landing's only visible text is the filter labels); confirm at the visual gate that nothing meaningful is missing. The human visual check (localhost:4321 vs localhost:8080) for a sample of service pages + both landings is the final fidelity gate.

- [ ] **Step 6: Commit any fixups**
```bash
cd /Users/keng/Workspaces/odweb/site
git add -A && git commit -q -m "test(pages): phase 3c verification" || echo "nothing to commit"
```

---

## Self-Review (plan author)
- **Spec coverage:** 33 service pages scraped + routed (T1, T2) ✓; landings scraped for CSS/bodyClass (T1) ✓; data-driven faithful landings with Divi portfolio markup + nesting so global+scraped CSS apply (T4) ✓; 4-sector filter via tested mapping (T3, T4) ✓; faithful URLs-only, no invented nav ✓; verification incl. routes/chrome/images/leaks/filter/count-reconcile/tests (T5) ✓. Out-of-scope (privacy/deploy/CSS-trim) excluded.
- **Spec deviation (noted):** the spec's §2 said "scrape the landing CSS" and inject it; this plan keeps that **and** reproduces the Divi `#et-boc → .et-l → section → row → column → module` nesting, because the portfolio styling lives in the already-global `divi-parent.css` keyed on `.et_pb_column .et_pb_grid_item.et_pb_portfolio_item` etc., which only applies inside that nesting. The scraped per-page CSS (scoped to `#et-boc .et-l … et_pb_row_0`) then also applies. Net: more faithful, no spec intent lost.
- **Placeholder scan:** every code step shows complete file contents or exact edits; commands have expected output; no TBD/TODO.
- **Type/name consistency:** `sectorSlugs`/`SECTORS` defined in T3 and consumed identically in T4 (`ProjectCard` imports `sectorSlugs`; listings import `SECTORS`); glob keys (`../../styles/pages/th-projects.css`, `../../../styles/pages/en-projects_en.css`) match the files T1 generates (`<lang>-<slug>.css`); manifest `bodyClass`/`path` fields read in T4 are written by `extract-pages.mjs`; the `[...path].astro` exclusion (T2) matches the landing paths added to `PAGES` (T1).
```
