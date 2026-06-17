# Pre-deploy Polish Implementation Plan

> Design approved in conversation. Subagent-driven execution. Steps use `- [ ]` tracking.

**Goal:** Deploy-ready hardening (local-only for now): SEO/chrome basics, faithful TH↔EN per-page hreflang pairing, and a safe CSS purge — with no visual regression.

**Tech:** Astro 5 (sitemap already wired, `site=https://opendream.co.th`), Docker, headless-Chrome visual verification, PurgeCSS.

**Preconditions:** local WP up (for the translations scrape); current build serves at localhost:4321.

---

## Task A: SEO/chrome basics (robots, 404, favicon, OG meta)

**Files:** `public/robots.txt` (new), `src/pages/404.astro` (new), `public/wp-content/uploads/2016/12/opendream-fav.png` (mirrored), `src/layouts/BaseLayout.astro` (head).

- [ ] **Step 1: `public/robots.txt`**
```
User-agent: *
Allow: /

Sitemap: https://opendream.co.th/sitemap-index.xml
```

- [ ] **Step 2: mirror the favicon**
```bash
cd /Users/keng/Workspaces/odweb/site
mkdir -p public/wp-content/uploads/2016/12
[ -f public/wp-content/uploads/2016/12/opendream-fav.png ] || curl -s -o public/wp-content/uploads/2016/12/opendream-fav.png http://localhost:8080/wp-content/uploads/2016/12/opendream-fav.png
```

- [ ] **Step 3: add favicon + OG/Twitter meta to `BaseLayout.astro` head** — after the `<link rel="canonical" ...>` line:
```astro
    <link rel="icon" href="/wp-content/uploads/2016/12/opendream-fav.png" />
    <link rel="apple-touch-icon" href="/wp-content/uploads/2016/12/opendream-fav.png" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Opendream" />
    <meta property="og:title" content={title} />
    {description && <meta property="og:description" content={description} />}
    <meta property="og:url" content={site + path} />
    <meta property="og:image" content={site + "/wp-content/uploads/2016/12/opendream-fav.png"} />
    <meta property="og:locale" content={lang === 'th' ? 'th_TH' : 'en_US'} />
    <meta name="twitter:card" content="summary" />
```

- [ ] **Step 4: `src/pages/404.astro`** (simple, in our chrome)
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout title="ไม่พบหน้านี้ — Opendream" lang="th" path="/404">
  <div id="et-main-area"><div class="container"><div id="content-area"><div id="left-area">
    <article class="et_pb_post" style="text-align:center;padding:60px 0;">
      <h1 class="entry-title">404</h1>
      <div class="entry-content">
        <p>ไม่พบหน้าที่คุณค้นหา / The page you’re looking for can’t be found.</p>
        <p><a href="/">กลับหน้าหลัก / Back home</a></p>
      </div>
    </article>
  </div></div></div></div>
</BaseLayout>
```

- [ ] **Step 5: build + smoke**
```bash
cd /Users/keng/Workspaces/odweb/site && docker compose up -d --build web 2>&1 | tail -4
echo "robots: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:4321/robots.txt)  sitemap: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:4321/sitemap-index.xml)  favicon: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:4321/wp-content/uploads/2016/12/opendream-fav.png)  404page: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:4321/404)"
curl -s http://localhost:4321/ | grep -oc 'og:title\|rel="icon"'
```
Expected: robots/sitemap/favicon/404 all 200; OG + icon present in home `<head>`.

- [ ] **Step 6: commit** `feat(seo): robots.txt, 404 page, favicon + Open Graph meta`

---

## Task B: TH↔EN per-page hreflang pairing

**Files:** `scripts/extract-translations.mjs` (new), `src/data/translations.json` (generated), `src/layouts/BaseLayout.astro` (hreflang lookup).

- [ ] **Step 1: `scripts/extract-translations.mjs`** — enumerate our built paths, scrape each live page's alternate hreflang, write `{path: altPath}`:
```js
import { writeFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parse } from 'node-html-parser';

const BASE = process.env.WP_BASE || 'http://localhost:8080';
const ROOT = new URL('..', import.meta.url).pathname;
const strip = (u) => u.replace(/https?:\/\/(?:www\.)?(?:localhost:8080|opendream\.co\.th)/, '').replace(/\/$/, '') || '/';

async function ourPaths() {
  const paths = new Set();
  // markdown collections
  for (const col of ['posts', 'projects', 'policies']) {
    const base = join(ROOT, 'src/content', col);
    const walk = async (d) => { for (const e of await readdir(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith('.md')) { const m = (await readFile(p, 'utf8')).match(/^path:\s*"?([^"\n]+)"?/m); if (m) paths.add(strip(m[1])); }
    }};
    await walk(base).catch(() => {});
  }
  // designed pages manifest
  const man = JSON.parse(await readFile(join(ROOT, 'src/content/pages/manifest.json'), 'utf8'));
  for (const m of man) paths.add(strip(m.path));
  return paths;
}

async function run() {
  const paths = await ourPaths();
  const map = {};
  for (const p of paths) {
    try {
      const html = await (await fetch(BASE + p)).text();
      const root = parse(html);
      for (const l of root.querySelectorAll('link[rel="alternate"][hreflang]')) {
        const hl = l.getAttribute('hreflang'); if (hl === 'x-default') continue;
        const alt = strip(l.getAttribute('href') || '');
        if (alt && alt !== p && paths.has(alt)) map[p] = alt;
      }
    } catch (e) { console.warn(`skip ${p}: ${e.message}`); }
  }
  const out = join(ROOT, 'src/data/translations.json');
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(Object.fromEntries(Object.entries(map).sort()), null, 2) + '\n');
  console.log(`translations: ${Object.keys(map).length} paired / ${paths.size} pages`);
}
run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: run it (Docker — extract-pages service socat tunnel)**
```bash
cd /Users/keng/Workspaces/odweb/site
docker compose --profile tools run --rm extract-pages sh -c "apk add socat -q && socat TCP-LISTEN:8080,fork,reuseaddr TCP:web:80 & npm install --no-save node-html-parser@^6.1.13 >/dev/null 2>&1 && node scripts/extract-translations.mjs"
```
Expected: `translations: N paired / M pages` with N in the ~150+ range (most posts/projects/core pages are paired). Sanity: `node -e "const t=require('./src/data/translations.json'); console.log(t['/blog/innovations-in-public-health'], '|', t['/about-us'])"` → prints EN counterparts.

- [ ] **Step 3: wire `BaseLayout.astro`** — import the map and prefer it over the listing fallback. Add import at top of frontmatter:
```astro
import translations from '../data/translations.json';
```
Change the href derivation to:
```astro
const alt = altPath ?? translations[path];
const enHref = lang === 'en' ? path : (alt ?? '/en/blogs');
const thHref = lang === 'th' ? path : (alt ?? '/blog');
```

- [ ] **Step 4: build + smoke**
```bash
cd /Users/keng/Workspaces/odweb/site && docker compose up -d --build web 2>&1 | tail -4
# a TH post's EN switch should point to its translation, not /en/blogs:
curl -s http://localhost:4321/blog/innovations-in-public-health | grep -oE 'hreflang="en" href="[^"]*"' | head -1
curl -s http://localhost:4321/about-us | grep -oE 'hreflang="en" href="[^"]*"' | head -1
```
Expected: hreflang en points to the actual EN translation path (e.g. `/en/...`, `/en/about_en`), and resolves 200.

- [ ] **Step 5: commit** `feat(i18n): per-page TH<->EN hreflang pairing from Polylang alternates`

---

## Task C: Safe CSS purge (controller-run, with visual verification)

**Files:** `package.json` (devDep + build script), `scripts/purge-css.mjs` (new).

- [ ] **Step 1: capture BEFORE screenshots** (controller) of: `/`, `/about-us`, `/projects` (+ after clicking a filter), `/blog`, a post, a project, `/projects/web-application`, a policy.
- [ ] **Step 2:** add `purgecss` devDependency; create `scripts/purge-css.mjs` (programmatic PurgeCSS over `dist/_astro/*.css`, content `dist/**/*.html`, safelist `/^et_/, /^et-/, /^project_category/, /^od-/, /^page-/, active, clearfix, lazyload, et_overlay, et_pb_*`, keyframes + font-face kept). Change `build` to `astro build && node scripts/purge-css.mjs`.
- [ ] **Step 3:** rebuild; capture AFTER screenshots of the same pages.
- [ ] **Step 4:** controller compares before/after. If ANY regression → expand safelist or revert the purge (keep full CSS). Record the byte delta.
- [ ] **Step 5:** commit `perf(css): safe PurgeCSS pass (verified no visual regression)` OR `chore: keep full CSS (purge caused regressions)` per outcome.

---

## Task D: Verification
- [ ] sitemap-index.xml + sitemap-0.xml present + list real URLs; robots 200; 404 page 200 + chrome; favicon 200; OG/icon in head.
- [ ] hreflang: spot-check 5 pages (post/project/designed/policy) — the en/th alternates point to built pages (200), not 404.
- [ ] CSS: every sampled page type visually matches pre-purge (or full CSS kept).
- [ ] All page types 200; `docker compose --profile tools run --rm test` passes; clean build.
- [ ] commit any fixups.

---

## Self-Review
- Covers the 3 approved components + verification. CSS purge is gated on visual diff (controller) — the one risky piece, isolated + reversible. hreflang centralized in BaseLayout (no per-layout threading). robots/sitemap use the prod domain (canonical already opendream.co.th); local-only deploy unaffected.
