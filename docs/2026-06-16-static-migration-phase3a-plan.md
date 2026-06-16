# Static Migration Phase 3a Implementation Plan — Home + preserve-HTML pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the designed-page scrape pipeline and render the WordPress home page faithfully at TH `/` and EN `/en/`, inside the existing Astro chrome, using preserved Divi HTML + the page's own CSS.

**Architecture:** A Node pipeline fetches a rendered Divi page from the local WP front-end, extracts the `#et-boc` builder content + the page's `et-core-unified` (+ global customizer) CSS, mirrors all referenced `/wp-content/...` assets into `public/`, strips the WP origin, and writes content HTML + page CSS + a manifest. `BaseLayout` gains optional `pageStyles` (injected `<style>`) and `bodyClass` (so Divi's body-scoped CSS applies). The home front pages import their content+CSS and render them.

**Tech Stack:** Astro 5, `node-html-parser` (extract tooling only), Vitest, Docker (Node→nginx). Node runs only in containers.

**Spec:** `docs/2026-06-16-static-migration-phase3a-spec.md`.

**Git:** `site/` repo, branch `main`. Commit after each task.

**Preconditions:** local WP up (`curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/` → 200). Run Node via Docker.

---

## File Structure
```
site/
  scripts/lib/pages.mjs            # NEW: extractBoc(), collectWpContentUrls() (pure, tested)
  scripts/lib/pages.test.mjs       # NEW
  scripts/extract-pages.mjs        # NEW: scrape orchestrator (home for 3a)
  docker-compose.yml               # MODIFY: add `extract-pages` service; add node-html-parser to `test`
  src/content/pages/{th,en}/*.html # NEW (generated): page content HTML
  src/content/pages/manifest.json  # NEW (generated): [{path,lang,slug,title,description,bodyClass,html,css}]
  src/styles/pages/*.css           # NEW (generated): per-page CSS
  public/wp-content/…              # NEW (generated): mirrored Divi assets (fonts/images)
  src/layouts/BaseLayout.astro     # MODIFY: optional pageStyles + bodyClass
  src/pages/index.astro            # MODIFY: render TH home
  src/pages/en/index.astro         # NEW: render EN home (/en/)
```

---

## Task 1: Pipeline helpers (TDD)

**Files:** Create `src/../scripts/lib/pages.mjs` + `scripts/lib/pages.test.mjs`; Modify `docker-compose.yml`.

- [ ] **Step 1: Add `node-html-parser` to the Docker `test` service install list**

In `docker-compose.yml`, the `test` service `command` currently installs `turndown@^7.2.0 vitest@^2.1.0`. Change it to also install `node-html-parser@^6.1.13`:
```yaml
    command: sh -c "npm install --no-save turndown@^7.2.0 vitest@^2.1.0 node-html-parser@^6.1.13 >/dev/null 2>&1 && npx vitest run scripts/lib/"
```
(Note `scripts/lib/` so it runs both `convert.test.mjs` and the new `pages.test.mjs`.)

- [ ] **Step 2: Write the failing tests — `scripts/lib/pages.test.mjs`**
```js
import { describe, it, expect } from 'vitest';
import { extractBoc, collectWpContentUrls } from './pages.mjs';

describe('extractBoc', () => {
  it('returns the #et-boc element outerHTML', () => {
    const html = '<body><div id="main-content"><div id="et-boc" class="et-l"><section>X</section></div></div></body>';
    const out = extractBoc(html);
    expect(out).toContain('id="et-boc"');
    expect(out).toContain('<section>X</section>');
  });
  it('falls back to .entry-content when no #et-boc', () => {
    const html = '<div class="entry-content"><p>Y</p></div>';
    expect(extractBoc(html)).toContain('<p>Y</p>');
  });
  it('returns empty string when neither present', () => {
    expect(extractBoc('<div>nope</div>')).toBe('');
  });
});

describe('collectWpContentUrls', () => {
  it('collects unique absolute wp-content URLs from text', () => {
    const text = 'a url(http://localhost:8080/wp-content/themes/Divi/x.woff) b "http://localhost:8080/wp-content/uploads/1.jpg" http://localhost:8080/wp-content/uploads/1.jpg';
    expect(collectWpContentUrls(text).sort()).toEqual([
      'http://localhost:8080/wp-content/themes/Divi/x.woff',
      'http://localhost:8080/wp-content/uploads/1.jpg',
    ]);
  });
});
```

- [ ] **Step 3: Run to verify fail**

Run: `cd site && docker compose --profile tools run --rm test 2>&1 | tail -6`
Expected: FAIL — `Cannot find module './pages.mjs'`.

- [ ] **Step 4: Implement `scripts/lib/pages.mjs`**
```js
import { parse } from 'node-html-parser';

export function extractBoc(html) {
  const root = parse(html);
  const el = root.querySelector('#et-boc') || root.querySelector('.entry-content');
  return el ? el.outerHTML.trim() : '';
}

const WP_CONTENT_RE = /https?:\/\/[^"')\s]+\/wp-content\/[^"')\s]+/g;
export function collectWpContentUrls(text) {
  return [...new Set(text.match(WP_CONTENT_RE) || [])];
}
```

- [ ] **Step 5: Run to verify pass**

Run: `cd site && docker compose --profile tools run --rm test 2>&1 | tail -6`
Expected: PASS (existing convert tests + new pages tests all green).

- [ ] **Step 6: Commit**
```bash
cd site && git add -A && git commit -q -m "feat(pages): tested et-boc + wp-content URL helpers"
```

---

## Task 2: Scrape orchestrator + run for home

**Files:** Create `scripts/extract-pages.mjs`; Modify `docker-compose.yml` (add `extract-pages` service). Output: `src/content/pages/**`, `src/styles/pages/**`, `public/wp-content/**`.

- [ ] **Step 1: Implement `scripts/extract-pages.mjs`**
```js
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'node-html-parser';
import { extractBoc, collectWpContentUrls } from './lib/pages.mjs';
import { toSiteRelative } from './lib/convert.mjs';

const BASE = process.env.WP_BASE || 'http://localhost:8080';
const ROOT = new URL('..', import.meta.url).pathname;
const PAGES = [
  { path: '/',    lang: 'th', slug: 'home' },
  { path: '/en/', lang: 'en', slug: 'homepage' },
];

async function fetchText(url) {
  const r = await fetch(url, { headers: { Accept: 'text/html,text/css,*/*' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}
async function mirrorAsset(absUrl) {
  const p = new URL(absUrl).pathname;            // /wp-content/...
  const dest = join(ROOT, 'public', p);
  if (existsSync(dest)) return;
  const r = await fetch(absUrl);
  if (!r.ok) { console.warn(`asset ${r.status}: ${absUrl}`); return; }
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
}

async function run() {
  const manifestPath = join(ROOT, 'src/content/pages/manifest.json');
  let manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : [];
  for (const pg of PAGES) {
    const dom = parse(await fetchText(BASE + pg.path));
    let content = extractBoc(dom.toString());
    const cssLinks = dom.querySelectorAll('link[rel="stylesheet"]')
      .map((l) => l.getAttribute('href')).filter(Boolean)
      .filter((h) => /et-cache\/\d+\/et-core-unified/.test(h) || /et-divi-customizer-global/.test(h));
    let css = '';
    for (const href of cssLinks) {
      const abs = href.startsWith('http') ? href : BASE + href;
      css += `\n/* ${href} */\n` + await fetchText(abs);
    }
    const title = (dom.querySelector('title')?.text || 'Opendream').trim();
    const description = dom.querySelector('meta[name="description"]')?.getAttribute('content') || undefined;
    const bodyClass = dom.querySelector('body')?.getAttribute('class') || '';
    for (const u of collectWpContentUrls(content + '\n' + css)) await mirrorAsset(u);
    content = toSiteRelative(content);
    css = toSiteRelative(css);
    const htmlRel = `src/content/pages/${pg.lang}/${pg.slug}.html`;
    const cssRel = `src/styles/pages/${pg.lang}-${pg.slug}.css`;
    await mkdir(dirname(join(ROOT, htmlRel)), { recursive: true });
    await mkdir(dirname(join(ROOT, cssRel)), { recursive: true });
    await writeFile(join(ROOT, htmlRel), content + '\n');
    await writeFile(join(ROOT, cssRel), css + '\n');
    manifest = manifest.filter((m) => !(m.path === pg.path && m.lang === pg.lang));
    manifest.push({ path: pg.path, lang: pg.lang, slug: pg.slug, title, description, bodyClass, html: htmlRel, css: cssRel });
    console.log(`page[${pg.lang}] ${pg.path}: ${content.length}B html, ${css.length}B css, bodyClass="${bodyClass.slice(0,40)}…"`);
  }
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add the `extract-pages` Docker service to `docker-compose.yml`**

Under `services:` (mirroring the `extract` service), add:
```yaml
  extract-pages:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./:/app
      - extract_modules:/app/node_modules
    environment:
      - WP_BASE=http://host.docker.internal:8080
    extra_hosts:
      - "host.docker.internal:host-gateway"
    command: sh -c "npm install --no-save node-html-parser@^6.1.13 turndown@^7.2.0 >/dev/null 2>&1 && node scripts/extract-pages.mjs"
    profiles: ["tools"]
```
(`turndown` is installed because `convert.mjs`, imported for `toSiteRelative`, imports it.)

- [ ] **Step 3: Run the page scrape (front-end render — no REST/plugin toggle needed)**

Run: `cd site && docker compose --profile tools run --rm extract-pages 2>&1 | tail -8`
Expected: two `page[th] /` and `page[en] /en/` lines with non-trivial html/css byte counts and a `bodyClass` containing e.g. `et-db` / `page-id-2`.

- [ ] **Step 4: Verify outputs**
```bash
ls -la src/content/pages/th/home.html src/content/pages/en/homepage.html src/styles/pages/th-home.css src/styles/pages/en-homepage.css src/content/pages/manifest.json
echo "wp-content assets mirrored: $(find public/wp-content -type f 2>/dev/null | wc -l | tr -d ' ')"
grep -l "localhost:8080" src/content/pages/*/*.html src/styles/pages/*.css || echo "NO localhost leaks"
grep -c 'et_pb_section' src/content/pages/th/home.html   # >0 (home has sections)
```
Expected: all files exist; assets mirrored (>0); NO localhost leaks; home HTML contains Divi sections.

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -q -m "feat(pages): scrape pipeline + home content/css/assets (th/en)"
```

---

## Task 3: BaseLayout support + render the home pages

**Files:** Modify `src/layouts/BaseLayout.astro`; Modify `src/pages/index.astro`; Create `src/pages/en/index.astro`.

- [ ] **Step 1: Add `pageStyles` + `bodyClass` to `BaseLayout.astro`**

Read the current `BaseLayout.astro`. Add to its `Props` interface: `pageStyles?: string;` and `bodyClass?: string;`. Destructure them. In `<head>`, AFTER the existing `global.css`/font links, add:
```astro
{pageStyles && <style set:html={pageStyles}></style>}
```
Change the `<body ...>` tag to apply the optional class:
```astro
<body class={bodyClass}>
```
(Existing callers pass neither prop, so `bodyClass` is `undefined` → no class; unchanged behavior.)

- [ ] **Step 2: Render the TH home — replace `src/pages/index.astro`**
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import manifest from '../content/pages/manifest.json';
import html from '../content/pages/th/home.html?raw';
import css from '../styles/pages/th-home.css?raw';
const page = manifest.find((m) => m.path === '/' && m.lang === 'th');
---
<BaseLayout title={page?.title ?? 'Opendream'} description={page?.description} lang="th" path="/" altPath="/en/" pageStyles={css} bodyClass={page?.bodyClass}>
  <Fragment set:html={html} />
</BaseLayout>
```

- [ ] **Step 3: Render the EN home — create `src/pages/en/index.astro`**
```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import manifest from '../../content/pages/manifest.json';
import html from '../../content/pages/en/homepage.html?raw';
import css from '../../styles/pages/en-homepage.css?raw';
const page = manifest.find((m) => m.path === '/en/' && m.lang === 'en');
---
<BaseLayout title={page?.title ?? 'Opendream'} description={page?.description} lang="en" path="/en/" altPath="/" pageStyles={css} bodyClass={page?.bodyClass}>
  <Fragment set:html={html} />
</BaseLayout>
```

- [ ] **Step 4: Build**

Run: `cd site && docker compose up -d --build web 2>&1 | tail -6`
Expected: clean build (importing `.json` and `?raw` text is supported by Astro/Vite). If `?raw` import errors, confirm the file paths match the manifest.

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -q -m "feat(home): render TH/EN home via preserved Divi HTML + page CSS"
```

---

## Task 4: Dockerized verification + visual-fidelity check

**Files:** none (verification; minor CSS-scoping fixups allowed).

- [ ] **Step 1: Routes + content present**
```bash
cd site && docker compose up -d --build web
for u in / /en/; do echo "$u -> $(curl -s -o /dev/null -w '%{http_code}' http://localhost:4321$u)"; done
curl -s http://localhost:4321/ | grep -ciE 'et_pb_section|et-boc'   # >0 home sections
curl -s http://localhost:4321/ | grep -ciE 'top-menu|main-footer'   # chrome present (each >0)
curl -s http://localhost:4321/ | grep -c '<style'                   # page CSS injected (>0)
```
Expected: `/` and `/en/` → 200; home sections present; chrome present; injected style present.

- [ ] **Step 2: Assets resolve + no leaks (against dist)**
```bash
grep -rl 'localhost:8080\|http://opendream' dist 2>/dev/null || echo NONE
# broken local-asset scan on home (css/fonts/images, incl. mirrored /wp-content/...):
curl -s http://localhost:4321/ | grep -oE '(src|href)="/[^"]+"' | grep -oE '/[^"]+' | sort -u | while read u; do
  [ -f "dist$u" ] || [ -f "dist$u/index.html" ] || echo "MISSING $u"; done
# also scan url(...) refs inside the injected page CSS for unresolved /wp-content fonts/images:
curl -s http://localhost:4321/ | grep -oE 'url\(/[^)]+\)' | grep -oE '/[^)"]+' | sort -u | while read u; do
  [ -f "dist$u" ] || echo "CSS-MISSING $u"; done
```
Expected: `NONE`; no `MISSING`/`CSS-MISSING` local refs (external http(s):// and nav links to not-yet-built pages — about/contact/services — are EXPECTED missing; list them separately, don't fail on them).

- [ ] **Step 3: SEO/i18n**
```bash
curl -s http://localhost:4321/en/ | grep -oiE '<html lang="en"|hreflang="th"|hreflang="en"|<title>[^<]*</title>' | head
```
Expected: `lang="en"`, both hreflang alternates, non-empty title.

- [ ] **Step 4: Visual-fidelity check (the real gate — iterate here)**

Compare `http://localhost:4321/` vs `http://localhost:8080/` (and `/en/`). The home must look faithful (hero, sections, columns, colors, fonts, images). **If it doesn't:** the usual cause is Divi CSS scoping — rules scoped to `body.et-db`/`.page-id-N` not matching. Fixes, in order of preference:
  1. Confirm `bodyClass` from the manifest is actually applied to `<body>` (view source).
  2. If module rules are scoped under `#et-main-area`/`.et-l` ancestors that we dropped, wrap the injected `#et-boc` content accordingly in the home page (e.g. `<div id="et-main-area">` around the `<Fragment set:html>`), and re-scrape isn't needed — just adjust the wrapper.
  3. If specific assets/fonts are missing, check the `CSS-MISSING` scan and ensure `mirrorAsset` fetched them (re-run `extract-pages`).
Make the minimal change needed for visual parity; note any residual gaps (e.g. JS-driven parallax/scroll motion, which is expected to be static).

- [ ] **Step 5: Pipeline tests still pass**
```bash
docker compose --profile tools run --rm test 2>&1 | tail -4
```
Expected: all tests pass (convert + pages).

- [ ] **Step 6: Commit any fixups**
```bash
git add -A && git commit -q -m "test(home): phase 3a verification + CSS-scoping fixups" || echo "nothing to commit"
```

---

## Self-Review (plan author)

- **Spec coverage:** scrape pipeline producing content HTML + page CSS + mirrored media (T2) ✓; `extractBoc` content + `et-core-unified`/customizer CSS selection (T1 helper + T2) ✓; URL rewriting via `toSiteRelative` + asset mirroring (T2) ✓; reusable storage format `src/content/pages/**` + `manifest.json` (T2) ✓; home render TH `/` + EN `/en/` via BaseLayout + injected CSS + content (T3) ✓; BaseLayout `pageStyles`+`bodyClass` (T3 S1) ✓; verification: routes/content/chrome/assets/leaks/hreflang + visual check + tests (T4) ✓. Out-of-scope items (other pages, generic route, services, privacy, deploy) correctly excluded.
- **Placeholder scan:** all code steps contain complete code; T4 S4 is an inherent visual-iteration step with concrete diagnostics + ordered fixes, not a vague TODO.
- **Type consistency:** `pages.mjs` exports `extractBoc`/`collectWpContentUrls` — imported identically in `pages.test.mjs` (T1) and `extract-pages.mjs` (T2). Manifest fields written in T2 (`path,lang,slug,title,description,bodyClass,html,css`) are exactly the fields read in T3 (`page.title`, `page.description`, `page.bodyClass`). `BaseLayout` props `pageStyles`/`bodyClass` defined in T3 S1 are passed in T3 S2/S3. `toSiteRelative` is the existing `convert.mjs` export.
```
