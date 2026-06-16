# Static Migration Phase 2 Implementation Plan — Projects

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the 92 WordPress `project` items (52 TH / 40 EN) into a static Astro `projects` collection rendered at their original `/project/<slug>` URLs, plus a navigable projects listing with a client-side category filter.

**Architecture:** Reuse Phase 1 end-to-end. Extend `scripts/extract.mjs` to also pull the `project` type → markdown in `src/content/projects/{th,en}/`. Add a `projects` content collection, a `ProjectLayout` + `ProjectCard`, fold projects into the path-preserving `[...path].astro` route, and build the `/projects` + `/en/projects_en` listings with a small vanilla-JS category filter. Build + serve stay Dockerized.

**Tech Stack:** Astro 5, Turndown (via existing `scripts/lib/convert.mjs`), Vitest, Docker (Node build → nginx). Node runs only in containers.

**Spec:** `docs/2026-06-16-static-migration-phase2-spec.md`. Phase 1 reference: `docs/2026-06-16-static-migration-phase1-spec.md` + `-plan.md`.

**Git:** `site/` is a git repo (branch `main`). Commit after each task (`git add -A && git commit`).

**Preconditions:** local WP stack running (`cd ../local && docker compose ps` healthy; `curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/` → 200). Run all Node via Docker per `README.md`.

---

## File Structure

```
site/
  src/content.config.ts          # MODIFY: add `projects` collection (shared schema)
  src/content/projects/{th,en}/  # NEW (generated): project markdown
  scripts/extract.mjs            # MODIFY: generalize to extract posts + project
  src/layouts/ProjectLayout.astro    # NEW
  src/components/ProjectCard.astro    # NEW
  src/pages/[...path].astro      # MODIFY: include projects (PostLayout|ProjectLayout)
  src/pages/projects/index.astro          # NEW: TH listing + category filter
  src/pages/en/projects_en/index.astro    # NEW: EN listing + category filter
  public/media/…                 # NEW (generated): project media
```

---

## Task 1: Add the `projects` content collection

**Files:**
- Modify: `site/src/content.config.ts`

- [ ] **Step 1: Replace `src/content.config.ts` with a shared schema + both collections**

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const baseSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  modified: z.coerce.date().optional(),
  lang: z.enum(['th', 'en']),
  slug: z.string(),
  path: z.string(),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  cover: z.string().optional(),
  excerpt: z.string().optional(),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: baseSchema,
});
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: baseSchema,
});

export const collections = { posts, projects };
```

- [ ] **Step 2: Verify the build still works (projects empty for now)**

Run: `cd site && docker compose up -d --build web 2>&1 | tail -5`
Expected: clean build; a glob-loader WARN that `src/content/projects` has no files is fine (Task 2 fills it). If you prefer a host check and Node is unavailable, rely on the Docker build.

- [ ] **Step 3: Commit**

```bash
cd site && git add -A && git commit -q -m "feat(content): add projects collection (shared schema)"
```

---

## Task 2: Extend extraction to `project` + run

**Files:**
- Modify: `site/scripts/extract.mjs`
- Output (generated): `site/src/content/projects/{th,en}/*.md`, `site/public/media/**`

- [ ] **Step 1: Read the current `scripts/extract.mjs`**

It currently extracts `posts` for each language, converting `content.rendered` to markdown with the existing helpers (`stripDiviCruft`, `toSiteRelative`, `htmlToMarkdown`, media download, frontmatter) and assigns language by `urlToPath(link).startsWith('/en/')`. **Preserve all of those helpers and behaviors.**

- [ ] **Step 2: Refactor the per-type logic into a reusable function and add a projects pass**

Generalize the existing post-extraction into `extractType({ type, dir, catTaxonomy })`, keeping every existing transform. The ONLY per-type differences are: the REST endpoint (`/wp-json/wp/v2/${type}`), the output directory (`src/content/${dir}`), and which embedded taxonomy supplies `categories`. Concretely:
- For each post object, build `categories` from the embedded terms filtered by `catTaxonomy`:
  ```js
  const terms = (p._embedded?.['wp:term'] || []).flat();
  const categories = terms.filter(t => t.taxonomy === catTaxonomy).map(t => t.name);
  ```
- Keep `tags` as before for posts (taxonomy `post_tag`); for projects there are no tags — set `tags: []`.
- Write to `src/content/${dir}/<lang>/<slug>.md`.

Then replace the single posts run with two calls:
```js
await extractType({ type: 'posts',   dir: 'posts',    catTaxonomy: 'category' });
await extractType({ type: 'project', dir: 'projects', catTaxonomy: 'project_category' });
```
Do not change media handling, `toSiteRelative`, excerpt cleaning, slug/path decoding, or frontmatter serialization.

- [ ] **Step 3: Enable REST on local, run extraction, re-block REST**

```bash
(cd ../local && docker compose --profile tools run --rm -T wpcli wp plugin deactivate disable-json-api)
docker compose --profile tools run --rm extract
(cd ../local && docker compose --profile tools run --rm -T wpcli wp plugin activate disable-json-api)
```
Expected console: `posts[th]: 49`, `posts[en]: 11`, `project[th]: 52`, `project[en]: 40` (or equivalent), and files under `src/content/projects/{th,en}/`.

- [ ] **Step 4: Verify counts against the DB**

```bash
echo "projects th=$(find src/content/projects/th -name '*.md' | wc -l | tr -d ' ') en=$(find src/content/projects/en -name '*.md' | wc -l | tr -d ' ')"
(cd ../local && docker compose --profile tools run --rm -T wpcli wp db query "SELECT pll.name, COUNT(*) FROM wp_posts p JOIN wp_term_relationships tr ON tr.object_id=p.ID JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id=tr.term_taxonomy_id AND tt.taxonomy='language' JOIN wp_terms pll ON pll.term_id=tt.term_id WHERE p.post_type='project' AND p.post_status='publish' GROUP BY pll.name;" --skip-column-names)
```
Expected: **th=52, en=40**, matching the DB. Also confirm posts still 49/11 (regression check).

- [ ] **Step 5: Confirm no dev-URL leaks + a sane sample**

```bash
grep -rl "localhost:8080\|wp-content/uploads" src/content/projects || echo NONE
head -20 "$(find src/content/projects/en -name '*.md' | head -1)"
```
Expected: `NONE`; sample shows valid frontmatter (title/date/lang/slug/path/categories/cover/excerpt) with `path` like `/en/project/...` and a markdown body.

- [ ] **Step 6: Verify the collection builds + commit**

```bash
docker compose up -d --build web 2>&1 | tail -5
git add -A && git commit -q -m "feat(content): extract projects (th/en) + media"
```
Expected: clean build, no schema errors.

---

## Task 3: ProjectCard + ProjectLayout

**Files:**
- Create: `site/src/components/ProjectCard.astro`
- Create: `site/src/layouts/ProjectLayout.astro`

- [ ] **Step 1: Create `src/components/ProjectCard.astro`**

```astro
---
interface Props { title: string; href: string; cover?: string; categories?: string[]; }
const { title, href, cover, categories = [] } = Astro.props;
---
<article class="project-card" data-categories={categories.join('|')}>
  <a href={href} class="project-card__link">
    {cover && <img class="project-card__cover" src={cover} alt={title} loading="lazy" />}
    <h3 class="project-card__title">{title}</h3>
  </a>
  {categories.length > 0 && (
    <p class="project-card__cats">{categories.map((c) => <span class="project-card__cat">{c}</span>)}</p>
  )}
</article>
```

- [ ] **Step 2: Create `src/layouts/ProjectLayout.astro`**

```astro
---
import BaseLayout from './BaseLayout.astro';
interface Props { title: string; lang: 'th' | 'en'; path: string; cover?: string; categories?: string[]; description?: string; }
const { title, lang, path, cover, categories = [], description } = Astro.props;
---
<BaseLayout title={`${title} — Opendream`} description={description} lang={lang} path={path}>
  <article class="single-project">
    <h1>{title}</h1>
    {categories.length > 0 && (
      <p class="single-project__cats">{categories.map((c) => <span class="single-project__cat">{c}</span>)}</p>
    )}
    {cover && <img class="single-project__cover" src={cover} alt={title} />}
    <div class="project-body"><slot /></div>
  </article>
</BaseLayout>
```

- [ ] **Step 3: Compile-check via a temp page, then remove it**

Create `src/pages/_p2check.astro`:
```astro
---
import ProjectLayout from '../layouts/ProjectLayout.astro';
import ProjectCard from '../components/ProjectCard.astro';
---
<ProjectLayout title="C" lang="th" path="/project/c" cover="/media/x.jpg" categories={["Web Application"]}>
  <p>body</p>
  <ProjectCard title="C" href="/project/c" cover="/media/x.jpg" categories={["Web Application"]} />
</ProjectLayout>
```
Run `docker compose up -d --build web 2>&1 | tail -5` (compiles the temp page). Confirm no errors, then `rm src/pages/_p2check.astro`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -q -m "feat(projects): ProjectCard + ProjectLayout"
```

---

## Task 4: Routes — detail (both collections) + listings with filter

**Files:**
- Modify: `site/src/pages/[...path].astro`
- Create: `site/src/pages/projects/index.astro`
- Create: `site/src/pages/en/projects_en/index.astro`

- [ ] **Step 1: Replace `src/pages/[...path].astro` to render both collections**

```astro
---
import { getCollection, render } from 'astro:content';
import PostLayout from '../layouts/PostLayout.astro';
import ProjectLayout from '../layouts/ProjectLayout.astro';

export async function getStaticPaths() {
  const posts = await getCollection('posts');
  const projects = await getCollection('projects');
  const mk = (entry, kind) => ({ params: { path: entry.data.path.replace(/^\//, '') }, props: { entry, kind } });
  return [...posts.map((e) => mk(e, 'post')), ...projects.map((e) => mk(e, 'project'))];
}
const { entry, kind } = Astro.props;
const { Content } = await render(entry);
const d = entry.data;
---
{kind === 'project' ? (
  <ProjectLayout title={d.title} lang={d.lang} path={d.path} cover={d.cover} categories={d.categories} description={d.excerpt}>
    <Content />
  </ProjectLayout>
) : (
  <PostLayout title={d.title} date={d.date} lang={d.lang} path={d.path} cover={d.cover} description={d.excerpt}>
    <Content />
  </PostLayout>
)}
```

- [ ] **Step 2: Create `src/pages/projects/index.astro` (TH listing + filter)**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import ProjectCard from '../../components/ProjectCard.astro';
const items = (await getCollection('projects', (p) => p.data.lang === 'th'))
  .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
const cats = [...new Set(items.flatMap((p) => p.data.categories))].sort();
---
<BaseLayout title="โครงการ — Opendream" lang="th" path="/projects" altPath="/en/projects_en">
  <h1>โครงการ</h1>
  <div class="project-filter">
    <button class="is-active" data-filter="*">ทั้งหมด</button>
    {cats.map((c) => <button data-filter={c}>{c}</button>)}
  </div>
  <div class="project-grid">
    {items.map((p) => <ProjectCard title={p.data.title} href={p.data.path} cover={p.data.cover} categories={p.data.categories} />)}
  </div>
  <script is:inline>
    (() => {
      const root = document.currentScript.closest('main') || document;
      const btns = root.querySelectorAll('.project-filter button');
      const cards = root.querySelectorAll('.project-grid .project-card');
      btns.forEach((b) => b.addEventListener('click', () => {
        const f = b.dataset.filter;
        btns.forEach((x) => x.classList.toggle('is-active', x === b));
        cards.forEach((c) => {
          const cs = (c.dataset.categories || '').split('|');
          c.style.display = (f === '*' || cs.includes(f)) ? '' : 'none';
        });
      }));
    })();
  </script>
</BaseLayout>
```

- [ ] **Step 3: Create `src/pages/en/projects_en/index.astro` (EN listing + filter)**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../../layouts/BaseLayout.astro';
import ProjectCard from '../../../components/ProjectCard.astro';
const items = (await getCollection('projects', (p) => p.data.lang === 'en'))
  .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
const cats = [...new Set(items.flatMap((p) => p.data.categories))].sort();
---
<BaseLayout title="Projects — Opendream" lang="en" path="/en/projects_en" altPath="/projects">
  <h1>Projects</h1>
  <div class="project-filter">
    <button class="is-active" data-filter="*">All</button>
    {cats.map((c) => <button data-filter={c}>{c}</button>)}
  </div>
  <div class="project-grid">
    {items.map((p) => <ProjectCard title={p.data.title} href={p.data.path} cover={p.data.cover} categories={p.data.categories} />)}
  </div>
  <script is:inline>
    (() => {
      const root = document.currentScript.closest('main') || document;
      const btns = root.querySelectorAll('.project-filter button');
      const cards = root.querySelectorAll('.project-grid .project-card');
      btns.forEach((b) => b.addEventListener('click', () => {
        const f = b.dataset.filter;
        btns.forEach((x) => x.classList.toggle('is-active', x === b));
        cards.forEach((c) => {
          const cs = (c.dataset.categories || '').split('|');
          c.style.display = (f === '*' || cs.includes(f)) ? '' : 'none';
        });
      }));
    })();
  </script>
</BaseLayout>
```

- [ ] **Step 4: Add minimal grid/filter styles to `src/styles/global.css`**

Append:
```css
.project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; }
.project-card__cover { width: 100%; aspect-ratio: 16/10; object-fit: cover; }
.project-filter { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0; }
.project-filter button { cursor: pointer; }
.project-filter button.is-active { font-weight: 700; text-decoration: underline; }
.project-card__cat, .single-project__cat { display: inline-block; margin-right: .4rem; font-size: .8em; opacity: .75; }
```

- [ ] **Step 5: Build and confirm routes + listings**

```bash
docker compose up -d --build web 2>&1 | tail -5
```
Then verify in the running container's output (use the verification in Task 5). Expected: build emits one HTML per project at its `/project/<slug>` (and EN) path, plus `/projects/` and `/en/projects_en/`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -q -m "feat(projects): detail routes (both collections) + listings with category filter"
```

---

## Task 5: Dockerized verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm a clean build is serving**

```bash
cd site && docker compose up -d --build web && docker compose ps
curl -s -o /dev/null -w "home %{http_code}\n" http://localhost:4321/
```

- [ ] **Step 2: Counts + listings + a sample project detail**

```bash
echo "project md th/en: $(find src/content/projects/th -name '*.md' | wc -l | tr -d ' ')/$(find src/content/projects/en -name '*.md' | wc -l | tr -d ' ')"   # expect 52/40
curl -s -o /dev/null -w "/projects %{http_code}\n" http://localhost:4321/projects/
curl -s -o /dev/null -w "/en/projects_en %{http_code}\n" http://localhost:4321/en/projects_en/
# pick a real project path from frontmatter and confirm it serves:
P=$(grep -h '^path:' src/content/projects/th/*.md | head -1 | sed 's/^path:[[:space:]]*//; s/"//g')
echo "sample project path: $P"
curl -s -o /dev/null -w "  -> %{http_code}\n" "http://localhost:4321${P%/}/"
```
Expected: 52/40; `/projects` and `/en/projects_en` → 200; the sample project path → 200.

- [ ] **Step 3: Filter present + chrome/cover/body on a project page**

```bash
curl -s http://localhost:4321/projects/ | grep -c 'project-filter\|project-card'   # >0
curl -s "http://localhost:4321${P%/}/" | grep -ciE 'top-menu|main-footer|single-project|project-body'   # each >0
```

- [ ] **Step 4: No dev-URL leaks in the built site; assets resolve**

```bash
grep -rl "localhost:8080\|wp-content/uploads" dist 2>/dev/null || echo NONE
# broken local-asset scan on the sample project page:
curl -s "http://localhost:4321${P%/}/" | grep -oE '(src|href)="/[^"]+"' | grep -oE '/[^"]+' | sort -u | while read u; do
  [ -f "dist$u" ] || [ -f "dist$u/index.html" ] || echo "MISSING $u"; done
```
Expected: `NONE`; no `MISSING` local assets (external http(s):// + the nav links to not-yet-built designed pages like `/about-us` are expected and out of scope).

- [ ] **Step 5: Pipeline unit tests still pass**

```bash
docker compose --profile tools run --rm test 2>&1 | tail -3
```
Expected: all Vitest tests pass.

- [ ] **Step 6: Final commit (if any verification fixups were made)**

```bash
git add -A && git commit -q -m "test(projects): phase 2 verification" || echo "nothing to commit"
```

---

## Self-Review (plan author)

- **Spec coverage:** extraction→project (T2) ✓; projects collection (T1) ✓; markdown bodies via existing convert pipeline (T2) ✓; ProjectLayout/ProjectCard (T3) ✓; path-preserving detail for both collections (T4 S1) ✓; listings `/projects` + `/en/projects_en` with client-side category filter (T4 S2–S4) ✓; no per-category archives (none created) ✓; counts/leaks/assets/tests verification (T5) ✓; Dockerized throughout ✓.
- **Placeholder scan:** all code steps contain complete code; the only "read the existing file then refactor" step (T2 S1–S2) is an existing-codebase modification with concrete diffs and an explicit instruction to preserve current helpers — not a vague TODO.
- **Type consistency:** `baseSchema` fields (T1) match what `extract.mjs` writes (T2) and what `ProjectLayout`/`ProjectCard`/listings consume (T3–T4): `title, date, lang, slug, path, categories[], cover?, excerpt?`. `[...path].astro` props `{ entry, kind }` are produced in `getStaticPaths` and consumed in the same file. `data-categories` is written by `ProjectCard` and read by the listing filter script (`split('|')`).
```
