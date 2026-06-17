# Static Migration Phase 3d Implementation Plan — Policy pages → markdown

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the 15 remaining privacy/policy pages at their preserved `/<slug>` URLs by converting their plain `.entry-content` to markdown and rendering it as prose inside our chrome.

**Architecture:** A new tested `extractEntryContent` lib helper + a render-scrape script convert each page's `article .entry-content` to markdown (reusing the tested turndown/convert lib) into a new `policies` collection. A minimal `PageLayout` renders the markdown inside the live plain-page structure (`.container > #left-area > article > .entry-content`) so the global `divi-parent.css` styles it. `[...path].astro` routes them.

**Tech Stack:** Astro 5, `scripts/lib/{convert,pages}.mjs` (turndown + node-html-parser), Docker, Vitest.

**Spec:** `docs/2026-06-17-static-migration-phase3d-spec.md`. **Git:** `site/` repo, branch `main`, commit per task.

**Preconditions:** local WP up (`curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/doctorme-privacy-policy` → 200).

---

## File Structure
```
site/
  scripts/lib/pages.mjs                 # MODIFY: add extractEntryContent
  scripts/lib/pages.test.mjs            # MODIFY: add test
  scripts/extract-content-pages.mjs     # NEW: scrape 15 policy pages -> markdown
  src/content/policies/*.md             # NEW (generated, 15 files)
  src/content.config.ts                 # MODIFY: add `policies` collection
  src/layouts/PageLayout.astro          # NEW: minimal content layout
  src/pages/[...path].astro             # MODIFY: route `policies` (kind 'policy')
  public/wp-content/…                   # NEW (any mirrored policy images)
```

---

## Task 1: `extractEntryContent` lib helper (TDD)

**Files:** Modify `scripts/lib/pages.mjs`, `scripts/lib/pages.test.mjs`.

- [ ] **Step 1: Write the failing test** — append to `scripts/lib/pages.test.mjs`:
```js
import { extractEntryContent } from './pages.mjs';

describe('extractEntryContent', () => {
  it('returns the article .entry-content inner HTML, not a footer copy', () => {
    const html = `<html><body>
      <article class="post"><div class="entry-content"><h2>Policy</h2><p>Body text</p></div></article>
      <footer><div class="entry-content">FOOTER WIDGET</div></footer>
    </body></html>`;
    const out = extractEntryContent(html);
    expect(out).toContain('<h2>Policy</h2>');
    expect(out).toContain('Body text');
    expect(out).not.toContain('FOOTER WIDGET');
  });
  it('returns "" when there is no entry-content', () => {
    expect(extractEntryContent('<html><body><p>x</p></body></html>')).toBe('');
  });
});
```
(If `pages.test.mjs` lacks a `describe`/`it`/`expect` import, add `import { describe, it, expect } from 'vitest';` at the top — match the existing style in the file.)

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd /Users/keng/Workspaces/odweb/site && docker compose --profile tools run --rm test 2>&1 | tail -15`
Expected: FAIL — `extractEntryContent` is not exported.

- [ ] **Step 3: Implement** — add to `scripts/lib/pages.mjs` (it already imports `parse` from `node-html-parser` at the top):
```js
// Inner HTML of the first article's .entry-content (scoped to <article> so a footer/widget
// .entry-content is never matched). Used to convert plain WordPress pages to markdown.
export function extractEntryContent(html) {
  const root = parse(html);
  const scope = root.querySelector('article') || root;
  const el = scope.querySelector('.entry-content');
  return el ? el.innerHTML.trim() : '';
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `cd /Users/keng/Workspaces/odweb/site && docker compose --profile tools run --rm test 2>&1 | grep -E 'Tests|passed|failed'`
Expected: all pass (prior 25 + the 2 new).

- [ ] **Step 5: Commit**
```bash
cd /Users/keng/Workspaces/odweb/site
git add scripts/lib/pages.mjs scripts/lib/pages.test.mjs
git commit -q -m "feat(lib): extractEntryContent helper for plain-content pages"
```

---

## Task 2: Extract the 15 policy pages → markdown

**Files:** Create `scripts/extract-content-pages.mjs`.

- [ ] **Step 1: Create the script** — `scripts/extract-content-pages.mjs`:
```js
// Render-scrape the plain WordPress policy pages -> markdown in the `policies` collection.
// Reads each page's article .entry-content, un-lazies images, strips the WP origin, mirrors
// /wp-content assets, converts to markdown (turndown), and writes a frontmatter'd .md.
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'node-html-parser';
import { extractEntryContent, collectWpContentUrls, unlazy } from './lib/pages.mjs';
import { htmlToMarkdown, stripDiviCruft, toSiteRelative, toFrontmatter } from './lib/convert.mjs';

const BASE = process.env.WP_BASE || 'http://localhost:8080';
const ROOT = new URL('..', import.meta.url).pathname;
const SLUGS = [
  '606-privacy-policy', 'buddy-homecare-privacy-policy', 'buddy-homecare-privacy-policy-2',
  'corrupt-privacy-policy', 'doctorme-privacy-policy', 'judies-privacy-policy',
  'judies-privacy-policy-1', 'mor-huangyai-privacy-policy', 'new-horizons-policy',
  'privacy-policy-youthpoll-th', 'sabaidee-community-privacy-policy', 'sabaidee-privacy-policy',
  'sabaidee-privacy-policy-1', 'small-world-privacy-policy', 'vrt-vr-game-privacy-policy',
];

async function fetchText(url) {
  const r = await fetch(url, { headers: { Accept: 'text/html,*/*' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}
async function mirrorAsset(ref) {
  const p = ref.startsWith('http') ? new URL(ref).pathname : ref;
  const abs = ref.startsWith('http') ? ref : BASE + ref;
  let diskPath; try { diskPath = decodeURIComponent(p); } catch { diskPath = p; }
  const dest = join(ROOT, 'public', diskPath);
  if (existsSync(dest)) return;
  const r = await fetch(abs);
  if (!r.ok) { console.warn(`asset ${r.status}: ${abs}`); return; }
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
}

async function run() {
  for (const slug of SLUGS) {
    const dom = parse(await fetchText(`${BASE}/${slug}`));
    const langAttr = (dom.querySelector('html')?.getAttribute('lang') || 'th').toLowerCase();
    const lang = langAttr.startsWith('th') ? 'th' : 'en';
    const title = (dom.querySelector('title')?.text || slug).replace(/\s*\|\s*Opendream\s*$/i, '').trim();
    let content = unlazy(extractEntryContent(dom.toString()));
    for (const u of collectWpContentUrls(content)) await mirrorAsset(u);
    content = toSiteRelative(content);
    const md = htmlToMarkdown(stripDiviCruft(content));
    const file = join(ROOT, 'src/content/policies', `${slug}.md`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, toFrontmatter({ title, lang, slug, path: `/${slug}` }, md));
    console.log(`policy[${lang}] /${slug}: ${md.length}B md  "${title.slice(0, 40)}"`);
  }
}
run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it (Docker, via the extract-pages service's socat tunnel to the WP)**
```bash
cd /Users/keng/Workspaces/odweb/site
docker compose --profile tools run --rm extract-pages sh -c "apk add socat -q && socat TCP-LISTEN:8080,fork,reuseaddr TCP:web:80 & npm install --no-save node-html-parser@^6.1.13 turndown@^7.2.0 >/dev/null 2>&1 && node scripts/extract-content-pages.mjs"
```
Expected: a `policy[th|en] /<slug>: …B md "Title"` line for each of the 15, each with non-trivial md bytes and the expected lang (th for buddy-homecare/mor-huangyai/youthpoll/sabaidee-community/sabaidee-…-1/small-world; en for the rest).

- [ ] **Step 3: Verify outputs**
```bash
cd /Users/keng/Workspaces/odweb/site
ls src/content/policies/*.md | wc -l   # 15
echo "leaks: $(grep -rl 'localhost:8080\|//opendream.co.th' src/content/policies && echo LEAK || echo none)"
grep -l 'Effective date\|Privacy Policy\|นโยบาย' src/content/policies/*.md | wc -l   # most/all
head -8 src/content/policies/doctorme-privacy-policy.md
```
Expected: 15 files; no origin leaks; policy text present; frontmatter has `title/lang/slug/path`. If a page's md is suspiciously tiny (<200B), note it as DONE_WITH_CONCERNS (the page may be near-empty on the source).

- [ ] **Step 4: Commit**
```bash
cd /Users/keng/Workspaces/odweb/site
git add -A && git commit -q -m "feat(policies): scrape 15 policy pages to markdown"
```

---

## Task 3: `policies` collection + `PageLayout` + routing

**Files:** Modify `src/content.config.ts`, `src/pages/[...path].astro`; create `src/layouts/PageLayout.astro`.

- [ ] **Step 1: Add the `policies` collection** — in `src/content.config.ts`, after the `projects` collection and before `export const collections`:
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
```
Then change the export to:
```ts
export const collections = { posts, projects, policies };
```

- [ ] **Step 2: Create `src/layouts/PageLayout.astro`**
```astro
---
import BaseLayout from './BaseLayout.astro';
interface Props { title: string; lang: 'th' | 'en'; path: string; description?: string; }
const { title, lang, path, description } = Astro.props;
---
<BaseLayout title={`${title} — Opendream`} description={description} lang={lang} path={path}>
  <div id="et-main-area">
    <div class="container">
      <div id="content-area" class="clearfix">
        <div id="left-area">
          <article class="et_pb_post">
            <h1 class="entry-title">{title}</h1>
            <div class="entry-content"><slot /></div>
          </article>
        </div>
      </div>
    </div>
  </div>
</BaseLayout>
```

- [ ] **Step 3: Route the policies in `src/pages/[...path].astro`**

Add the import (with the other layout imports):
```astro
import PageLayout from '../layouts/PageLayout.astro';
```
In `getStaticPaths`, add after the `projects` line:
```js
  const policies = await getCollection('policies');
```
and add `...policies.map((e) => col(e, 'policy'))` to the returned array, so it reads:
```js
  return [
    ...posts.map((e) => col(e, 'post')),
    ...projects.map((e) => col(e, 'project')),
    ...policies.map((e) => col(e, 'policy')),
    ...designed,
  ];
```
(The existing `if (props.kind !== 'page')` block already sets `Content`/`d` for any collection entry, so `policy` is handled there — no change needed.)

In the render ternary, add a `policy` branch before the final `PostLayout` fallback:
```astro
) : props.kind === 'policy' ? (
  <PageLayout title={d.title} lang={d.lang} path={d.path}>
    <Content />
  </PageLayout>
) : (
```
(i.e. the chain becomes page → project → policy → post.)

- [ ] **Step 4: Build**

Run: `cd /Users/keng/Workspaces/odweb/site && docker compose up -d --build web 2>&1 | tail -6`
Expected: clean build, no duplicate-route error.

- [ ] **Step 5: Smoke-check the policy routes**
```bash
cd /Users/keng/Workspaces/odweb/site
for s in 606-privacy-policy buddy-homecare-privacy-policy doctorme-privacy-policy mor-huangyai-privacy-policy sabaidee-privacy-policy-1 vrt-vr-game-privacy-policy; do
  H=$(curl -sL "http://localhost:4321/$s")
  echo "/$s -> $(curl -s -o /dev/null -w '%{http_code}' -L "http://localhost:4321/$s") entry=$(printf '%s' "$H" | grep -oc 'entry-content') chrome=$(printf '%s' "$H" | grep -oE 'top-menu|main-footer' | sort -u | tr -d '\n') lang=$(printf '%s' "$H" | grep -oE '<html lang="[^"]*"' | head -1)"
done
```
Expected: all 200; `entry-content` present; chrome present; `<html lang>` th/en per the page.

- [ ] **Step 6: Commit**
```bash
cd /Users/keng/Workspaces/odweb/site
git add -A && git commit -q -m "feat(policies): PageLayout + route policy pages"
```

---

## Task 4: Verification

**Files:** none (fixups only).

- [ ] **Step 1: All 15 policy URLs 200 + chrome + content + lang**
```bash
cd /Users/keng/Workspaces/odweb/site
SLUGS="606-privacy-policy buddy-homecare-privacy-policy buddy-homecare-privacy-policy-2 corrupt-privacy-policy doctorme-privacy-policy judies-privacy-policy judies-privacy-policy-1 mor-huangyai-privacy-policy new-horizons-policy privacy-policy-youthpoll-th sabaidee-community-privacy-policy sabaidee-privacy-policy sabaidee-privacy-policy-1 small-world-privacy-policy vrt-vr-game-privacy-policy"
for s in $SLUGS; do
  H=$(curl -sL "http://localhost:4321/$s")
  echo "/$s code=$(curl -s -o /dev/null -w '%{http_code}' -L "http://localhost:4321/$s") entry=$(printf '%s' "$H"|grep -oc entry-content) bodychars=$(printf '%s' "$H" | grep -oE 'entry-content.*main-footer' | wc -c)"
done
```
Expected: all 200; `entry-content` present on each.

- [ ] **Step 2: Images + leaks**
```bash
cd /Users/keng/Workspaces/odweb/site
for s in doctorme-privacy-policy sabaidee-privacy-policy; do
  curl -sL "http://localhost:4321/$s" | grep -oE 'src="/[^"]+\.(jpg|jpeg|png|svg|webp|gif)"' | grep -oE '/[^"]+' | sort -u | while read u; do
    c=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:4321$u"); [ "$c" = 200 ] || echo "MISSING /$s $u"; done; done
grep -rl 'localhost:8080\|http://opendream' dist 2>/dev/null && echo LEAK || echo "no dist leaks"
```
Expected: no MISSING local images; no leaks.

- [ ] **Step 3: Pipeline tests + clean build**
```bash
cd /Users/keng/Workspaces/odweb/site
docker compose --profile tools run --rm test 2>&1 | grep -E 'Tests|passed|failed'   # all pass
docker compose up -d --build web 2>&1 | tail -3
```

- [ ] **Step 4: Note duplicates / thin pages for the human gate**

If `judies-privacy-policy` and `judies-privacy-policy-1` (or any pair) are byte-identical, note it (don't drop — faithful URL coverage). Note any page whose markdown is suspiciously thin. The human visual check (a sample of policy pages on localhost:4321 vs localhost:8080) is the final gate.

- [ ] **Step 5: Commit any fixups**
```bash
cd /Users/keng/Workspaces/odweb/site
git add -A && git commit -q -m "test(policies): phase 3d verification" || echo "nothing to commit"
```

---

## Self-Review (plan author)
- **Spec coverage:** 15 policy pages scraped → markdown (T2) ✓; `extractEntryContent` tested (T1) ✓;
  `policies` collection + `PageLayout` + routing (T3) ✓; lang detected from `<html lang>` (T2) ✓;
  verification incl. URLs/chrome/content/lang/images/leaks/tests (T4) ✓. `blueflagshops` excluded ✓.
- **Placeholder scan:** every code step is complete; commands have expected output; no TBD.
- **Type/name consistency:** `extractEntryContent` defined (T1) and imported (T2); `policies` collection
  name matches `getCollection('policies')` (T3); `col(entry, 'policy')` → render branch `kind==='policy'`
  → `PageLayout` (title/lang/path from `d`); `toFrontmatter` fields (`title,lang,slug,path`) match the
  `policies` schema. The `if (props.kind !== 'page')` guard already covers `policy` (it's a collection
  entry with `Content`).
```
