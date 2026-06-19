# SEO Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three findings from the SEO implementation audit: (1) HTML-entity-encoded frontmatter titles that render garbled and pollute metadata, (2) the EN-home trailing-slash mismatch between canonical and sitemap, and (3) two minor schema.org nits (telephone format, SVG logo).

**Architecture:** A pure, unit-tested `decodeEntities` helper plus a one-off runner clean the affected source frontmatter (root-cause fix — repairs the visible `<h1>`/`<title>` *and* all derived `og:`/`twitter:`/JSON-LD metadata at once). A handful of exact string edits align the EN-home URL to the no-trailing-slash convention that `translations.json` and the sitemap already use. Two trivial data edits address the nits.

**Tech Stack:** Node ESM helpers under `scripts/lib/` (Vitest, in Docker), Astro 5 build for verification. No new dependencies.

**Branch:** Work on the existing `seo-improvements` branch (continues the audited work).

**How to run things (no Node on host — everything is Docker):**
- Unit tests: `docker compose --profile tools run --rm test`
- One-off Node scripts: `docker compose --profile tools run --rm --entrypoint node test <script>`
- Build `dist/`: `make rebuild`
- Inspect built HTML/XML: read/grep files under `dist/`

**Context — why these are the right fixes:**
- The entities (`&#8216;`, `&#038;`, `&#8217;`, …) are literal text in the source `title:` frontmatter, a WordPress-extraction artifact. They were confirmed to live only in frontmatter; body markdown renders entities fine (the markdown→HTML→browser path decodes them), so the body is intentionally left untouched.
- `translations.json` already pairs the home as `"/": "/en"` and `"/en": "/"` (no trailing slash), and the sitemap serializer emits `/en`. Only the page `path` (`/en/`) and five sibling references disagree. Aligning them to `/en` is the minimal, consistent fix.

---

## File Structure

**Create:**
- `scripts/lib/entities.mjs` — pure HTML-entity decoder.
- `scripts/lib/entities.test.mjs` — Vitest unit tests.
- `scripts/fix-frontmatter-entities.mjs` — runner that decodes entities within each content file's frontmatter block only.

**Modify (Task 1 runner rewrites these — 11 content files with entity titles):**
- `src/content/posts/th/creative-citizen-opendream.md`, `src/content/posts/th/bbc-news.md`, `src/content/posts/th/corrupt-awards-th.md`, `src/content/posts/th/the-matter-corrupt-game-interview.md`, `src/content/posts/th/klaikong-waitayakarn-open-data.md`, `src/content/posts/th/creativemove-interview.md`, `src/content/posts/th/27-jan-digital-media-standards-for-services-in-the-age-of-knowledge-society-seminar.md`, `src/content/posts/en/dialogue-matter-game-corrupt.md`, `src/content/posts/en/bbc-news-en.md`, `src/content/posts/en/opendream-demonstrated-smart-phone-application-dv-consult-royal-highness-princess-maha-chakri-sirindhorn.md`, `src/content/projects/en/tanah-en.md`

**Modify (Task 2 — EN-home URL alignment):**
- `src/pages/en/index.astro`, `src/pages/index.astro`, `src/components/Header.astro`, `src/layouts/ProjectLayout.astro`, `src/layouts/PostLayout.astro`, `src/layouts/BaseLayout.astro`

**Modify (Task 3 — telephone nit):**
- `src/data/org.json`

**Optional (Task 4 — logo nit):**
- `src/data/org.json`, plus a new raster `public/media/od_logo.png`

---

## Task 1: Decode entity-encoded frontmatter titles — TDD

**Files:**
- Create: `scripts/lib/entities.mjs`
- Test: `scripts/lib/entities.test.mjs`
- Create: `scripts/fix-frontmatter-entities.mjs`
- Modify: the 11 content files listed above (rewritten by the runner)

- [ ] **Step 1: Write the failing test** — create `scripts/lib/entities.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { decodeEntities } from './entities.mjs';

describe('decodeEntities', () => {
  it('decodes decimal numeric entities', () => {
    expect(decodeEntities('&#8216;x&#8217;')).toBe('‘x’');
  });
  it('decodes &#038; to an ampersand', () => {
    expect(decodeEntities('A &#038; B')).toBe('A & B');
  });
  it('decodes hex numeric entities', () => {
    expect(decodeEntities('&#x2014;')).toBe('—');
  });
  it('decodes common named entities', () => {
    expect(decodeEntities('a &amp; b &quot;c&quot;')).toBe('a & b "c"');
  });
  it('leaves unknown entities untouched', () => {
    expect(decodeEntities('&unknownentity; &foo;')).toBe('&unknownentity; &foo;');
  });
  it('handles double-encoded input by looping to a stable result', () => {
    expect(decodeEntities('&amp;#8217;')).toBe('’');
  });
  it('returns plain text unchanged', () => {
    expect(decodeEntities('plain text')).toBe('plain text');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `docker compose --profile tools run --rm test`
Expected: FAIL — cannot resolve `./entities.mjs`.

- [ ] **Step 3: Create `scripts/lib/entities.mjs`**

```js
// Decode HTML entities (numeric decimal/hex + a small named set) to real Unicode.
// Loops until stable so double-encoded input (e.g. "&amp;#8217;") is fully decoded.
// Unknown named entities are left untouched.
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

export function decodeEntities(str = '') {
  let out = String(str);
  let prev;
  do {
    prev = out;
    out = out
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
      .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => (name in NAMED ? NAMED[name] : m));
  } while (out !== prev);
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `docker compose --profile tools run --rm test`
Expected: PASS — `entities.test.mjs` green; all other test files still pass.

- [ ] **Step 5: Create the runner `scripts/fix-frontmatter-entities.mjs`**

```js
// Decode HTML entities within the YAML frontmatter block of each content file only.
// Body markdown is intentionally left untouched (entities there render correctly via HTML).
// Usage: node scripts/fix-frontmatter-entities.mjs
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { decodeEntities } from './lib/entities.mjs';

const ROOT = 'src/content';
// Capture group 1 = the full frontmatter block including the fences; group 2 = the rest.
const FM = /^(---\r?\n[\s\S]*?\r?\n---)([\s\S]*)$/;

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (['.md', '.mdx'].includes(extname(e.name))) out.push(p);
  }
  return out;
}

const files = await walk(ROOT);
let changed = 0;
for (const f of files) {
  const text = await readFile(f, 'utf8');
  const m = text.match(FM);
  if (!m) continue;
  const decoded = decodeEntities(m[1]);
  if (decoded !== m[1]) {
    await writeFile(f, decoded + m[2]);
    changed++;
    console.log(`fixed: ${f}`);
  }
}
console.log(`\n${changed} file(s) updated.`);
```

- [ ] **Step 6: Run the runner**

Run: `docker compose --profile tools run --rm --entrypoint node test scripts/fix-frontmatter-entities.mjs`
Expected: it lists the affected files (≈11) and prints the count. Review the diff with `git diff src/content` and confirm each change is a sensible decode (e.g. `&#8216;` → `'`, `&#038;` → `&`), not corruption.

- [ ] **Step 7: Verify no entities remain in frontmatter**

Run: `grep -rn '&#[0-9]' src/content/posts src/content/projects`
Expected: no matches on any `title:`/`excerpt:` frontmatter line. (If any matches remain, they must be in body content — acceptable. If a frontmatter line still matches, re-run Step 6 or hand-fix that value.)

- [ ] **Step 8: Build and verify rendered output is clean**

Run: `make rebuild`
Expected: build succeeds. (If the build fails on a YAML parse error, an unquoted frontmatter value started with a now-decoded `&` — wrap that one value in double quotes and rebuild.)

Then verify the previously-garbled post renders clean (no `&amp;#` / `&#38;#`):
```bash
grep -o '<title>[^<]*</title>' dist/blog/creative-citizen-opendream/index.html
grep -o '<meta property="og:title" content="[^"]*"' dist/blog/creative-citizen-opendream/index.html
```
Expected: real characters (e.g. `'แมค & โบจัง'`), no `&amp;#8216;` or `&#38;#8216;`.

And confirm the JSON-LD headline is clean:
```bash
grep -o '"headline":"[^"]*"' dist/blog/creative-citizen-opendream/index.html
```
Expected: decoded characters, no `&#` sequences.

- [ ] **Step 9: Commit**

```bash
git add scripts/lib/entities.mjs scripts/lib/entities.test.mjs scripts/fix-frontmatter-entities.mjs src/content
git commit -m "fix(seo): decode HTML-entity frontmatter titles (repairs headings + metadata)"
```

---

## Task 2: Align EN-home URL to the no-trailing-slash convention

**Files:**
- Modify: `src/pages/en/index.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/components/Header.astro`
- Modify: `src/layouts/ProjectLayout.astro`
- Modify: `src/layouts/PostLayout.astro`
- Modify: `src/layouts/BaseLayout.astro`

Rationale: `translations.json` already uses `"/": "/en"` / `"/en": "/"`, and the sitemap emits `/en`. Only the page `path` and five sibling references still use `/en/`, which makes the EN-home canonical (`/en/`) disagree with its sitemap `<loc>` and hreflang (`/en`). Align everything to `/en`. (`src/lib/sitemap-hreflang.mjs` already accepts both `/en` and `/en/`, so it needs no change.)

- [ ] **Step 1: EN home page** — in `src/pages/en/index.astro`, replace
`<BaseLayout title="Opendream — Open by Design. Build for Impact." description={description} lang="en" path="/en/" altPath="/" jsonLd={jsonLd}>`
with
`<BaseLayout title="Opendream — Open by Design. Build for Impact." description={description} lang="en" path="/en" altPath="/" jsonLd={jsonLd}>`

- [ ] **Step 2: TH home page** — in `src/pages/index.astro`, replace
`<BaseLayout title="Opendream — Open by Design. Build for Impact." description={description} lang="th" path="/" altPath="/en/" jsonLd={jsonLd}>`
with
`<BaseLayout title="Opendream — Open by Design. Build for Impact." description={description} lang="th" path="/" altPath="/en" jsonLd={jsonLd}>`

- [ ] **Step 3: Header logo link** — in `src/components/Header.astro` line 5, replace
`const homeHref = lang === 'en' ? '/en/' : '/';`
with
`const homeHref = lang === 'en' ? '/en' : '/';`

- [ ] **Step 4: Project breadcrumb home** — in `src/layouts/ProjectLayout.astro`, replace
`const homePath = lang === 'en' ? '/en/' : '/';`
with
`const homePath = lang === 'en' ? '/en' : '/';`

- [ ] **Step 5: Post breadcrumb home** — in `src/layouts/PostLayout.astro`, replace
`const homePath = lang === 'en' ? '/en/' : '/';`
with
`const homePath = lang === 'en' ? '/en' : '/';`

- [ ] **Step 6: BaseLayout fallback** — in `src/layouts/BaseLayout.astro` (the `fallbackAlt` block), replace the line
`    return '/en/';`
with
`    return '/en';`

- [ ] **Step 7: Build and verify consistency**

Run: `make rebuild`
Then:
```bash
echo "EN home canonical (expect .../en):"; grep -o '<link rel="canonical" href="[^"]*"' dist/en/index.html
echo "EN home og:url (expect .../en):"; grep -o '<meta property="og:url" content="[^"]*"' dist/en/index.html
echo "stray home-with-trailing-slash refs (expect 0):"; grep -rl 'opendream.co.th/en/"' dist | wc -l
echo "sitemap bare /en loc (expect PRESENT):"; grep -oq "<loc>https://opendream.co.th/en</loc>" dist/sitemap-0.xml && echo PRESENT || echo MISSING
```
Expected: canonical and og:url both `https://opendream.co.th/en`; stray-ref count `0`; sitemap `<loc>` PRESENT. (Longer EN URLs like `/en/blogs` are unaffected — the `/en/"` pattern with a closing quote matches only the home.)

- [ ] **Step 8: Commit**

```bash
git add src/pages/en/index.astro src/pages/index.astro src/components/Header.astro src/layouts/ProjectLayout.astro src/layouts/PostLayout.astro src/layouts/BaseLayout.astro
git commit -m "fix(seo): align EN-home URL to /en (canonical, hreflang, breadcrumb, nav)"
```

---

## Task 3: Telephone in E.164 format (nit)

**Files:**
- Modify: `src/data/org.json`

- [ ] **Step 1: Edit `src/data/org.json`** — replace
`  "telephone": "+66.90.559.8288",`
with
`  "telephone": "+66905598288",`

- [ ] **Step 2: Build and verify**

Run: `make rebuild`
Run: `grep -o '"telephone":"[^"]*"' dist/index.html`
Expected: `"telephone":"+66905598288"`.

- [ ] **Step 3: Commit**

```bash
git add src/data/org.json
git commit -m "fix(seo): use E.164 telephone format in Organization schema"
```

---

## Task 4 (OPTIONAL): Raster Organization logo

Google's Organization/Article logo guidance prefers a raster image (PNG/JPG) over SVG. Low impact — do this only if a raster logo is readily available. `sips` does not convert SVG reliably, so this needs a real raster asset.

**Files:**
- Create: `public/media/od_logo.png` (square-ish, ≥112px on the short side, transparent or white background)
- Modify: `src/data/org.json`

- [ ] **Step 1: Obtain a raster logo** — either use a designer-provided PNG, or convert the existing SVG with a tool that handles SVG (e.g. `rsvg-convert -w 512 public/media/od_logo.svg -o public/media/od_logo.png`, or `cairosvg`). Place it at `public/media/od_logo.png`. Verify: `sips -g pixelWidth -g pixelHeight -g format public/media/od_logo.png` reports `png` and a width ≥112.

- [ ] **Step 2: Point the schema at it** — in `src/data/org.json`, replace
`  "logo": "/media/od_logo.svg",`
with
`  "logo": "/media/od_logo.png",`

- [ ] **Step 3: Build and verify**

Run: `make rebuild`
Run: `grep -o '"logo":"[^"]*"' dist/index.html`
Expected: `"logo":"https://opendream.co.th/media/od_logo.png"`.

- [ ] **Step 4: Commit**

```bash
git add public/media/od_logo.png src/data/org.json
git commit -m "fix(seo): use raster Organization logo for structured data"
```

---

## Task 5: Final regression verification

**Files:** none (verification)

- [ ] **Step 1: Run the full unit suite**

Run: `docker compose --profile tools run --rm test`
Expected: all tests pass (existing + the new `entities.test.mjs`).

- [ ] **Step 2: Clean build**

Run: `make rebuild`
Expected: succeeds, no errors.

- [ ] **Step 3: Re-run the audit regression sweep** (confirm no fix introduced a regression):

```bash
echo "favicon-as-og (expect 0):"; grep -rl 'og:image" content="[^"]*opendream-fav' dist | wc -l
echo "noindex pages (expect 404 + styleguide only):"; grep -rl 'name="robots" content="noindex' dist
echo "styleguide in sitemap (expect 0):"; grep -c "styleguide" dist/sitemap-0.xml
echo "BlogPosting count (expect 60):"; grep -rl '"BlogPosting"' dist | wc -l
echo "CreativeWork count (expect 92):"; grep -rl '"CreativeWork"' dist | wc -l
echo "entity sequences in built titles (expect 0):"; grep -rl '<title>[^<]*&amp;#[0-9]' dist | wc -l
```
Expected: favicon-as-og `0`; noindex exactly `dist/404.html` + `dist/styleguide/index.html`; styleguide-in-sitemap `0`; BlogPosting `60`; CreativeWork `92`; entity-in-title `0`.

- [ ] **Step 4: Validate JSON-LD still parses** on a sample of pages:

```bash
python3 - <<'EOF'
import re,json,glob,sys
def check(p):
    for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', open(p,encoding='utf-8').read(), re.S):
        json.loads(b)
for p in ['dist/index.html','dist/en/index.html',
          sorted(glob.glob('dist/blog/*/index.html'))[0],
          sorted(glob.glob('dist/project/*/index.html'))[0]]:
    check(p)
print("all sampled JSON-LD valid")
EOF
```
Expected: `all sampled JSON-LD valid`.

---

## Self-Review (completed by plan author)

**Finding coverage:**
- Finding 1 (entity titles) → Task 1 (decode helper + runner + verification that `<title>`/`og:title`/JSON-LD render clean) ✓
- Finding 2 (EN-home trailing slash) → Task 2 (six exact edits; verification that canonical, og:url, and sitemap loc all agree on `/en`) ✓
- Finding 3 (nits) → Task 3 telephone E.164 ✓; Task 4 raster logo (optional, gated on having a raster asset) ✓

**Placeholder scan:** No "TBD"/vague steps. Every code step has complete code; every edit gives the exact before/after string. The only deliberately open item is Task 4's raster asset source (designer file vs SVG conversion), which is correctly flagged optional because it depends on an asset outside the repo.

**Type/string consistency:** All six Task-2 edits change the same `/en/` → `/en` token; `translations.json` already uses `/en` so it is intentionally not edited, and `sitemap-hreflang.mjs:langForPath` already accepts both forms. The `decodeEntities` signature used in the test matches the runner import. Verification greps use discriminating patterns (`/en/"` with a closing quote matches only the home, not `/en/blogs`).

**Scope:** Body-markdown entities are intentionally out of scope (they render correctly); only frontmatter is decoded. No unrelated refactoring.
