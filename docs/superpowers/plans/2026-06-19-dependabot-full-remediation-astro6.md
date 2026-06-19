# Dependabot Full Remediation (Astro 5→6 + vitest 2→3 + Node 22) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear all 11 open Dependabot alerts by upgrading the build/dev toolchain: **Astro 5→6** (+ matching `@astrojs/mdx` & `@astrojs/sitemap`, which clears the 5 astro + 3 vite + 2 esbuild alerts) and **vitest 2→3** (clears the 1 critical), pinning **Node 22** everywhere Astro 6 now requires it. Then add a `.github/dependabot.yml` to keep the alert list quiet going forward.

**Context (why):** All 11 alerts are in **build-time/dev dependencies** — the deployed site is static HTML, so none run in production (live-site risk ≈ nil). This is toolchain hygiene + a clean Security tab. The astro advisories are patched only in 6.x (ranges `< 6.x.y`, no 5.x backport), and `vite`/`esbuild` are astro's transitives — so the only way to *clear* (vs dismiss) them is the Astro 6 major upgrade. The user chose full remediation.

**Hard prerequisite:** **Astro 6 requires Node ≥ 22.12.0** (it dropped Node 18/20; depends on Vite 7). This repo currently builds on Node 20 (Dockerfile + docker-compose). Node 22 must be in place *before* the Astro upgrade or every build fails. Cloudflare Pages already builds on Node 22.16, but pin it explicitly.

**Architecture:** No app-architecture change — the site stays **static** (no adapter, output `dist/`). This is a dependency/toolchain upgrade. The risk surface is Astro 6 breaking changes at our integration points: the content-collection glob loader (`src/content.config.ts`), the catch-all router (`src/pages/[...path].astro`), the **custom `@astrojs/sitemap` `serialize` hook** (`src/lib/sitemap-hreflang.mjs` + `astro.config.mjs`), the `i18n` config, MDX rendering, and `BaseLayout`/`SEO` head output.

**Tech Stack:** Astro 6, `@astrojs/mdx`, `@astrojs/sitemap`, Vitest 3, Node 22, Docker. Upgrade driven by Astro's official `npx @astrojs/upgrade` (it picks mutually-compatible astro + `@astrojs/*` versions, so we don't hand-pin majors).

**Branch & release:** Branch off `main` (experimental). PR → `main`. After merge + verification, promote with `make release` (fast-forwards `production`; Cloudflare Pages deploys). `main` is never production.

**How to run things (no Node on host — everything is Docker):**
- Unit tests: `docker compose --profile tools run --rm test`
- Clean-room build (mimics Cloudflare; **use Node 22**): `git archive <branch> | tar -x -C <tmp>` then `docker run --rm -v <tmp>:/app -w /app node:22-alpine sh -c 'npm ci && npm run build'`
- Local serve: `make up` → http://localhost:4321 (after the Docker images are bumped to node:22)

**The 11 alerts being cleared:** critical vitest `<3.2.6`; high astro `<6.4.6`/`<6.3.3`, vite `<=6.4.2`; medium astro `<6.4.6`/`<6.1.6`, vite ×2, esbuild `<=0.24.2`; low astro `<6.1.10`, esbuild `0.27.3–0.28.1`. Expectation: Astro 6 (with Vite 7 / patched esbuild) + vitest 3 supersede all vulnerable ranges; Dependabot auto-closes them on the next scan of the updated lockfile.

---

## File Structure

**Create:**
- `.nvmrc` — pins Node `22` for Cloudflare Pages + local tooling.
- `.github/dependabot.yml` — grouped, weekly, ignore majors.

**Modify:**
- `Dockerfile` — builder base `node:20-alpine` → `node:22-alpine`.
- `docker-compose.yml` — `extract` + `test` service `image: node:20-alpine` → `node:22-alpine`; bump the `test` command's `vitest@^2.1.0` pin → `vitest@^3.2.6`.
- `package.json` — `astro`, `@astrojs/mdx`, `@astrojs/sitemap` to Astro-6-compatible versions (via `@astrojs/upgrade`); `vitest` `^2.1.0` → `^3.2.6`.
- `package-lock.json` — regenerated.
- `astro.config.mjs` and/or `src/lib/sitemap-hreflang.mjs` — **only if** Astro 6 / `@astrojs/sitemap` v-next changes the `serialize`/`i18n` API (discovered during the build).
- Possibly `src/content.config.ts`, `src/pages/[...path].astro`, layouts/components — **only if** Astro 6 breaking changes require it (discovered during the build; consult the migration guide).

---

## Task 1: Branch + pin Node 22 (prerequisite for Astro 6)

**Files:** Create `.nvmrc`; Modify `Dockerfile`, `docker-compose.yml`.

- [ ] **Step 1: Branch off main**

```bash
git switch main && git pull --ff-only origin main
git switch -c deps/full-remediation-astro6
```

- [ ] **Step 2: Create `.nvmrc`** (pins Cloudflare Pages + local Node managers to 22)

```
22
```

- [ ] **Step 3: Bump the Dockerfile builder to Node 22.** In `Dockerfile`, replace:

```
FROM node:20-alpine AS builder
```

with:

```
FROM node:22-alpine AS builder
```

- [ ] **Step 4: Bump the docker-compose tool images to Node 22.** In `docker-compose.yml`, change both the `extract` and `test` services' `image: node:20-alpine` to `image: node:22-alpine`. (There are two occurrences.)

- [ ] **Step 5: Verify the toolchain still builds on Node 22 BEFORE upgrading Astro** (isolates the Node bump from the Astro bump):

```bash
docker compose --profile tools run --rm test
```
Expected: the existing 59 tests still pass on Node 22 (astro 5 + vitest 2 both run on Node 22 fine). If green, the Node bump is safe in isolation.

- [ ] **Step 6: Commit**

```bash
git add .nvmrc Dockerfile docker-compose.yml
git commit -m "build: require Node 22 (nvmrc + Docker images) ahead of Astro 6"
```

---

## Task 2: vitest 2 → 3 (clears the critical alert)

**Files:** Modify `package.json`, `package-lock.json`, `docker-compose.yml`.

vitest is dev-only (the test runner). The "critical" advisory is the Vitest **UI server** RCE — we run `vitest run` (no UI), so it never applied; the bump just clears the alert and keeps the runner current. Isolated from Astro.

- [ ] **Step 1: Upgrade vitest in a Node 22 container** (writes package.json + lockfile on the host via the repo bind-mount):

```bash
docker run --rm -v "$PWD":/app -w /app node:22-alpine \
  sh -c "npm install -D vitest@^3.2.6"
```

- [ ] **Step 2: Update the `test` service command pin in `docker-compose.yml`.** Replace the `vitest@^2.1.0` token in the `test` service `command` with `vitest@^3.2.6` (it currently reads `npm install --no-save turndown@^7.2.0 vitest@^2.1.0 node-html-parser@^6.1.13 ...`).

- [ ] **Step 3: Run the tests on vitest 3**

```bash
docker compose --profile tools run --rm test
```
Expected: all 59 tests pass. Vitest 3's `vitest run` API is compatible with our simple unit tests; if any test helper API changed, fix per the [Vitest 3 migration guide](https://vitest.dev/guide/migration). Do **not** proceed until green.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json docker-compose.yml
git commit -m "test: upgrade vitest 2 -> 3 (clears critical Dependabot alert)"
```

---

## Task 3: Astro 5 → 6 upgrade (clears the astro + vite + esbuild alerts)

**Files:** Modify `package.json`, `package-lock.json`; `astro.config.mjs` / `src/lib/sitemap-hreflang.mjs` / `src/content.config.ts` / `src/pages/[...path].astro` / layouts **only if** breaking changes require it.

This is the major migration. Drive it with Astro's official upgrade tool so astro + every `@astrojs/*` integration land on mutually-compatible versions (no hand-picking majors).

- [ ] **Step 1: Read the breaking-change guide first.** Open the [Astro 6 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v6/) and the [Astro 6.0 release notes](https://astro.build/blog/astro-6/). Note any changes touching: **content collections / loaders**, **i18n routing**, **`@astrojs/sitemap` `serialize`/`i18n` options**, **MDX**, and **HTML/attribute escaping** (several alerts were XSS-in-output fixes — confirm our trusted-content output is unaffected).

- [ ] **Step 2: Run the official upgrade** (Node 22 container; updates astro + `@astrojs/mdx` + `@astrojs/sitemap` together):

```bash
docker run --rm -v "$PWD":/app -w /app node:22-alpine \
  sh -c "npx --yes @astrojs/upgrade"
```
Then confirm `package.json` now lists `astro` at `^6.x`, `@astrojs/mdx` and `@astrojs/sitemap` at their Astro-6-compatible majors.

- [ ] **Step 3: First build attempt — surface breakages** (clean-room, Node 22):

```bash
SP=$(mktemp -d); git stash -u >/dev/null 2>&1 || true
docker run --rm -v "$PWD":/app -w /app node:22-alpine \
  sh -c "npm install && npm run build 2>&1 | tail -40"
```
Expected outcomes and fixes (apply, then rebuild until it completes "Complete!"):
- **`@astrojs/sitemap` `serialize` signature/option change** → adjust `astro.config.mjs` (the `serialize`/`filter`/`i18n` usage) and/or `src/lib/sitemap-hreflang.mjs` to the v-next API. This is the highest-risk spot — our custom hreflang serializer depends on this hook. (The `sitemap-hreflang.test.mjs` unit tests are pure functions and stay valid; only the wiring in `astro.config.mjs` may change.)
- **Content collections loader API change** → update `src/content.config.ts` (`glob` loader import/usage) per the guide.
- **`i18n` config shape change** → update the `i18n` block in `astro.config.mjs`.
- **MDX/component API change** → update affected components under `src/components/content/` or `src/pages/[...path].astro`.

- [ ] **Step 4: Full clean-room build passes**

```bash
docker run --rm -v "$PWD":/app -w /app node:22-alpine \
  sh -c "npm ci && npm run build 2>&1 | tail -8"
```
Expected: `astro build` completes, **215 pages built**, no errors, and `dist/` contains **no `_worker.js`** (still static — confirm: `[ -e dist/_worker.js ] && echo SSR-LEAK || echo static-ok`).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json astro.config.mjs src
git commit -m "feat: upgrade Astro 5 -> 6 (clears astro/vite/esbuild Dependabot alerts)"
```

---

## Task 4: Verify the site is intact on Astro 6 (no regressions)

**Files:** none (verification). Build a clean-room `dist/` (Node 22) from the branch and assert the SEO + cosmetic + structural behavior we shipped still holds.

- [ ] **Step 1: Build the branch clean-room**

```bash
SP=$(mktemp -d); git archive deps/full-remediation-astro6 | tar -x -C "$SP"
docker run --rm -v "$SP":/app -w /app node:22-alpine sh -c "npm ci && npm run build" 2>&1 | tail -3
D="$SP/dist"
```

- [ ] **Step 2: Assert no regressions** (these all passed pre-upgrade; they must still pass):

```bash
echo -n "pages: "; find "$D" -name index.html | wc -l            # expect 215
echo -n "sitemap hreflang links: "; grep -o "xhtml:link" "$D/sitemap-0.xml" | wc -l   # expect ~396
echo -n "styleguide excluded from sitemap: "; grep -c styleguide "$D/sitemap-0.xml"   # expect 0
echo -n "home Organization JSON-LD: "; grep -c '"Organization"' "$D/index.html"      # expect >=1
echo -n "BlogPosting across posts: "; grep -rl '"BlogPosting"' "$D" | wc -l           # expect 60
echo -n "favicon-as-og (regression guard): "; grep -rl 'og:image" content="[^"]*opendream-fav' "$D" | wc -l  # expect 0
echo -n "coverless post gradient cover: "; grep -oc 'od-article__cover--ph' "$D/blog/election-2554-mps-per-province/index.html"  # expect 1
echo -n "noindex pages: "; grep -rl 'name="robots" content="noindex' "$D"             # expect 404 + styleguide only
echo -n "entity-encoded titles (regression guard): "; grep -rl '<title>[^<]*&amp;#[0-9]' "$D" | wc -l  # expect 0
```
Validate JSON-LD still parses on home/post/project (reuse the python parse check from prior audits). Fix any Astro-6 output change before proceeding.

- [ ] **Step 3: Unit tests green on the final branch**

```bash
docker compose --profile tools run --rm test
```
Expected: all tests pass (Astro 6 + vitest 3, Node 22).

---

## Task 5: Confirm the Dependabot alerts cleared + dismiss any residual

**Files:** none (GitHub state). Requires the branch pushed so Dependabot can re-scan the updated `package-lock.json` (it scans the default branch on merge, and PRs for preview).

- [ ] **Step 1: Push the branch and open a PR to `main`**

```bash
git push -u origin deps/full-remediation-astro6
gh pr create --base main --head deps/full-remediation-astro6 \
  --title "deps: clear all Dependabot alerts (Astro 6 + vitest 3 + Node 22)" \
  --body "Upgrades the build/dev toolchain to clear all 11 build-time Dependabot alerts. Node pinned to 22 (Astro 6 requirement). Site stays static; verified 215 pages, sitemap hreflang, SEO JSON-LD, gradient covers, no regressions. See docs/superpowers/plans/2026-06-19-dependabot-full-remediation-astro6.md."
```

- [ ] **Step 2: After merge to `main`, re-check alerts** (Dependabot re-scans `main`'s lockfile within minutes):

```bash
gh api repos/opendream/odweb/dependabot/alerts --paginate \
  --jq '[.[] | select(.state=="open")] | length'
```
Expected: `0`. If any remain open, inspect them:
```bash
gh api repos/opendream/odweb/dependabot/alerts --paginate \
  --jq '.[] | select(.state=="open") | "\(.security_advisory.severity) \(.dependency.package.name) fixed:\(.security_vulnerability.first_patched_version.identifier)"'
```
For any genuinely un-fixable transitive (no compatible fixed version exists) that is **dev/build-only and not reachable in our static build**, dismiss with a documented reason:
```bash
gh api -X PATCH repos/opendream/odweb/dependabot/alerts/<NUMBER> \
  -f state=dismissed -f dismissed_reason=tolerable_risk \
  -f dismissed_comment="Build-time/dev dependency only; deployed site is static HTML with no Node runtime, and the vulnerable feature (dev server / UI server / SSR) is not used. Tracked in docs/superpowers/plans/2026-06-19-dependabot-full-remediation-astro6.md."
```
(`dismissed_reason` ∈ `fix_started|inaccurate|no_bandwidth|not_used|tolerable_risk`.)

---

## Task 6: Future Dependabot hygiene config

**Files:** Create `.github/dependabot.yml`.

- [ ] **Step 1: Create `.github/dependabot.yml`** (grouped, weekly, ignore routine majors so future major bumps like Astro 7 / vitest 4 don't auto-nag; security alerts still surface in the Security tab regardless):

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
    groups:
      astro:
        patterns:
          - "astro"
          - "@astrojs/*"
      dev-tooling:
        patterns:
          - "vitest"
          - "vite"
          - "esbuild"
          - "turndown"
          - "node-html-parser"
    ignore:
      # Routine version-bump PRs skip majors (review/perform majors deliberately,
      # like this Astro 6 upgrade). Security advisories still appear in the Security tab.
      - dependency-name: "*"
        update-types: ["version-update:semver-major"]
```

- [ ] **Step 2: Commit (on `main` after the deps PR merges, or include in the same PR)**

```bash
git add .github/dependabot.yml
git commit -m "ci: add grouped/weekly Dependabot config, ignore routine majors"
```

---

## Task 7: Release to production + verify Cloudflare Pages on Node 22

**Files:** none (deploy). Only after `main` is green and alerts are clear.

- [ ] **Step 1: Confirm Cloudflare Pages uses Node 22.** The `.nvmrc` (`22`) is read by Pages automatically; additionally confirm/set the `NODE_VERSION` build env var to `22` in the Pages project settings as a belt-and-suspenders. (Astro 6 fails on Node < 22.12.)

- [ ] **Step 2: Promote main → production**

```bash
make release
```
Expected: production fast-forwards and pushes; Cloudflare Pages builds on Node 22 and deploys the static `dist/`.

- [ ] **Step 3: Verify the production (or preview) deployment** builds green on Cloudflare and the live pages render (titles correct, covers/gradients present, no console errors). If Cloudflare's build fails on Node, re-check the `.nvmrc`/`NODE_VERSION` pin (Task 7 Step 1).

---

## Self-Review (completed by plan author)

**Alert coverage:** vitest critical → Task 2. astro ×5 → Task 3 (Astro 6). vite ×3 + esbuild ×2 → Task 3 (Astro 6 brings Vite 7 + patched esbuild). Residual handling → Task 5 (dismiss-with-justification fallback). Future noise → Task 6. ✓

**Hard prerequisite ordering:** Node 22 (Task 1) precedes the Astro 6 upgrade (Task 3) — Astro 6 fails on Node < 22.12. vitest (Task 2) is isolated and could run before or after, but is sequenced before the big migration so a failure is easy to attribute. ✓

**No false-precision:** Astro-6 breaking-change *fixes* can't be pre-written (they depend on what the build surfaces); the plan instead (a) names the exact high-risk integration points to check, (b) routes through the official `@astrojs/upgrade` tool and the migration guide, and (c) gates on a green clean-room build + the full no-regression assertion list. Version numbers are resolved by `@astrojs/upgrade`, not guessed.

**Risk notes:** Highest risk is the custom `@astrojs/sitemap` `serialize` hook in `astro.config.mjs` if the integration's API changed across the major — Task 3 Step 3 calls it out first. The site stays static (no adapter) — Task 4 Step 2 asserts no `_worker.js` leaks in. Deployed-site security impact of these alerts is ≈ nil (static output); this work is hygiene + a clean Security tab.
```
