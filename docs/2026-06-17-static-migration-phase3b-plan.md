# Static Migration Phase 3b Implementation Plan — Core designed pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the 7 core designed pages (about/contact/join-us/announcement, TH+EN) faithfully at their preserved URLs via the proven preserve-HTML pipeline + a generic manifest-driven route, and remove the non-functional header search box.

**Architecture:** Add the 7 pages to `scripts/extract-pages.mjs`'s `PAGES` list and re-run (writes content HTML + page CSS + mirrored assets + manifest). Extend the single root rest-route `[...path].astro` to render manifest designed pages (non-root) alongside posts/projects. Edit `Header.astro` to drop the search box.

**Tech Stack:** Astro 5, the existing `extract-pages` pipeline (`unlazy`, `node-html-parser`), Docker, Vitest.

**Spec:** `docs/2026-06-17-static-migration-phase3b-spec.md`. **Git:** `site/` repo, branch `main`, commit per task.

**Preconditions:** local WP up (`curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/about-us` → 200). Run Node via Docker.

---

## File Structure
```
site/
  scripts/extract-pages.mjs        # MODIFY: add 7 pages to PAGES
  src/content/pages/{th,en}/*.html # NEW (generated)
  src/styles/pages/*.css           # NEW (generated)
  src/content/pages/manifest.json  # UPDATED (→ 9 entries)
  public/wp-content/…              # NEW (generated assets)
  src/pages/[...path].astro        # MODIFY: render manifest designed pages too
  src/components/Header.astro      # MODIFY: remove search box
```

---

## Task 1: Scrape the 7 core pages

**Files:** Modify `scripts/extract-pages.mjs`.

- [ ] **Step 1: Add the 7 pages to the `PAGES` array**

In `scripts/extract-pages.mjs`, the `PAGES` array currently has the 2 home entries. Add these 7 (keep the home entries):
```js
  { path: '/about-us',       lang: 'th', slug: 'about-us' },
  { path: '/contact',        lang: 'th', slug: 'contact' },
  { path: '/join-us',        lang: 'th', slug: 'join-us' },
  { path: '/announcement',   lang: 'th', slug: 'announcement' },
  { path: '/en/about_en',    lang: 'en', slug: 'about_en' },
  { path: '/en/contact_en',  lang: 'en', slug: 'contact_en' },
  { path: '/en/join-us_en',  lang: 'en', slug: 'join-us_en' },
```

- [ ] **Step 2: Run the scrape**

Run: `cd /Users/keng/Workspaces/odweb/site && docker compose --profile tools run --rm extract-pages 2>&1 | tail -12`
Expected: a `page[..] <path>: …B html, …B css` line for each of the 7 (plus the 2 home), each with non-trivial bytes and a `bodyClass` containing `et-db`/`page-id-…`.

- [ ] **Step 3: Verify outputs**
```bash
ls src/content/pages/th/{about-us,contact,join-us,announcement}.html src/content/pages/en/{about_en,contact_en,join-us_en}.html
echo "manifest entries: $(node -e "console.log(require('./src/content/pages/manifest.json').length)" 2>/dev/null || grep -oc '"path"' src/content/pages/manifest.json)"   # expect 9
( grep -rl "localhost:8080\|//opendream.co.th" src/content/pages src/styles/pages && echo LEAK ) || echo "no origin leaks"
echo "data:image placeholders across new pages: $(grep -oc 'data:image' src/content/pages/th/contact.html src/content/pages/th/about-us.html | paste -sd+ | bc 2>/dev/null || echo check)"
echo "contact map iframe present: $(grep -oc '<iframe' src/content/pages/th/contact.html)"
```
Expected: all 7 files exist; manifest = 9; no origin leaks; **0** `data:image` placeholders (unlazy handled them); contact has its `<iframe>` map. If a page's html is suspiciously tiny or a `fullwidth_code` section is empty (JS-rendered on the original), NOTE it as DONE_WITH_CONCERNS for the verification task.

- [ ] **Step 4: Commit**
```bash
git add -A && git commit -q -m "feat(pages): scrape core designed pages (about/contact/join-us/announcement, th/en)"
```

---

## Task 2: Generic designed-page route + remove header search

**Files:** Modify `src/pages/[...path].astro`, `src/components/Header.astro`.

- [ ] **Step 1: Replace `src/pages/[...path].astro` to also render manifest designed pages**
```astro
---
import { getCollection, render } from 'astro:content';
import PostLayout from '../layouts/PostLayout.astro';
import ProjectLayout from '../layouts/ProjectLayout.astro';
import BaseLayout from '../layouts/BaseLayout.astro';
import manifest from '../content/pages/manifest.json';

const pageHtml = import.meta.glob('../content/pages/**/*.html', { query: '?raw', import: 'default', eager: true });
const pageCss = import.meta.glob('../styles/pages/*.css', { query: '?raw', import: 'default', eager: true });

export async function getStaticPaths() {
  const posts = await getCollection('posts');
  const projects = await getCollection('projects');
  const col = (entry, kind) => ({ params: { path: entry.data.path.replace(/^\//, '') }, props: { kind, entry } });
  const designed = manifest
    .filter((m) => m.path !== '/' && m.path !== '/en/')   // home is owned by index.astro / en/index.astro
    .map((m) => ({
      params: { path: m.path.replace(/^\//, '') },
      props: {
        kind: 'page',
        page: m,
        html: pageHtml[`../content/pages/${m.lang}/${m.slug}.html`],
        css: pageCss[`../styles/pages/${m.lang}-${m.slug}.css`],
      },
    }));
  return [...posts.map((e) => col(e, 'post')), ...projects.map((e) => col(e, 'project')), ...designed];
}

const props = Astro.props;
let Content = null;
let d = null;
if (props.kind !== 'page') {
  Content = (await render(props.entry)).Content;
  d = props.entry.data;
}
---
{props.kind === 'page' ? (
  <BaseLayout title={props.page.title} description={props.page.description} lang={props.page.lang} path={props.page.path} pageStyles={props.css} bodyClass={props.page.bodyClass}>
    <Fragment set:html={props.html} />
  </BaseLayout>
) : props.kind === 'project' ? (
  <ProjectLayout title={d.title} lang={d.lang} path={d.path} cover={d.cover} categories={d.categories} description={d.excerpt}>
    <Content />
  </ProjectLayout>
) : (
  <PostLayout title={d.title} date={d.date} lang={d.lang} path={d.path} cover={d.cover} description={d.excerpt}>
    <Content />
  </PostLayout>
)}
```

- [ ] **Step 2: Remove the search box from `src/components/Header.astro`**

Read `Header.astro`. Remove the search UI — the search toggle/icon and the `<div id="et_top_search">…</div>` / `<form ... class="et-search-form">…</form>` block (and any now-unused search-related variables like `searchPlaceholder`). Keep the logo, `<Nav/>`, and everything else. Goal: no `et-search-form`/`et_top_search`/search icon remains in the rendered header.

- [ ] **Step 3: Build**

Run: `cd site && docker compose up -d --build web 2>&1 | tail -6`
Expected: clean build. If `import.meta.glob` lookups return `undefined` for a page (key mismatch), fix the key template to match the actual generated file paths (check `ls src/content/pages/<lang>/`).

- [ ] **Step 4: Smoke-check the routes + search removal**
```bash
for u in /about-us /contact /join-us /announcement /en/about_en /en/contact_en /en/join-us_en; do
  echo "$u -> $(curl -s -o /dev/null -w '%{http_code}' "http://localhost:4321$u")"; done   # all 200
curl -s http://localhost:4321/ | grep -oc 'et-search-form\|et_top_search'   # expect 0 (search removed)
```
Expected: all 7 → 200; search markup count 0.

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -q -m "feat(pages): generic designed-page route + remove header search box"
```

---

## Task 3: Verification

**Files:** none.

- [ ] **Step 1: Routes + content + chrome**
```bash
cd site && docker compose up -d --build web
for u in /about-us /contact /join-us /announcement /en/about_en /en/contact_en /en/join-us_en; do
  H=$(curl -s "http://localhost:4321$u")
  echo "$u: code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:4321$u") sections=$(printf '%s' "$H" | grep -oc 'et_pb_section') chrome=$(printf '%s' "$H" | grep -oE 'top-menu|main-footer' | sort -u | tr -d '\n')"
done
echo "contact map iframe served: $(curl -s http://localhost:4321/contact | grep -oc '<iframe')"
```
Expected: all 200; sections > 0; chrome present (`top-menu`+`main-footer`); contact iframe present.

- [ ] **Step 2: Images + assets + leaks**
```bash
curl -s http://localhost:4321/about-us | grep -oc 'data:image'   # 0 (no lazy placeholders)
grep -rl 'localhost:8080\|http://opendream' dist 2>/dev/null || echo NONE
# broken local-asset scan on /about-us and /contact:
for P in /about-us /contact; do
  curl -s "http://localhost:4321$P" | grep -oE '(src|href)="/[^"]+"' | grep -oE '/[^"]+' | sort -u | while read u; do
    [ -f "dist$u" ] || [ -f "dist$u/index.html" ] || echo "MISSING($P) $u"; done; done
```
Expected: 0 data:image; NONE leaks; no MISSING local assets (external + nav links to still-unbuilt service pages are expected; list separately).

- [ ] **Step 3: Nav links from home now resolve**
```bash
for u in /about-us /contact /join-us /announcement; do
  echo "$u -> $(curl -s -L -o /dev/null -w '%{http_code}' "http://localhost:4321$u")"; done   # 200 (was 404)
```

- [ ] **Step 4: Pipeline tests + clean build**
```bash
docker compose --profile tools run --rm test 2>&1 | tail -3   # all pass
```

- [ ] **Step 5: Note any JS-empty `fullwidth_code` sections for the human visual check**

If any page has a Divi `fullwidth_code` module that renders empty statically (no Divi JS), note which page+section. The human visual check (localhost:4321 vs localhost:8080) is the final gate for fidelity.

- [ ] **Step 6: Commit any fixups**
```bash
git add -A && git commit -q -m "test(pages): phase 3b verification" || echo "nothing to commit"
```

---

## Self-Review (plan author)
- **Spec coverage:** 7 pages scraped (T1) ✓; generic manifest-driven route for non-root designed pages (T2 S1) ✓; header search removed (T2 S2) ✓; verification incl. routes/content/chrome/images/assets/leaks/nav-resolves/tests (T3) ✓; contact map iframe checked (T1/T3) ✓. Out-of-scope (services/projects-design/privacy/deploy) excluded.
- **Placeholder scan:** route code is complete; the search-removal step is an existing-file edit with a concrete acceptance check (0 `et-search-form` in output); the fullwidth_code note is a flagging step for the human gate, not a vague TODO.
- **Type consistency:** manifest fields (`path,lang,slug,title,description,bodyClass`) written by `extract-pages.mjs` match the route's reads (`props.page.title/description/lang/path/bodyClass`); glob key templates `../content/pages/${lang}/${slug}.html` + `../styles/pages/${lang}-${slug}.css` match the pipeline's output paths; `BaseLayout` `pageStyles`/`bodyClass` props exist (added in 3a).
```
