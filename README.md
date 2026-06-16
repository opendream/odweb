# odweb — Astro static site (Dockerized)

Faithful static rebuild of opendream.co.th (Phase 1: posts). **Built and served entirely in
Docker — the host needs only Docker** (no Node / `node_modules` on the host).

- **SSG:** Astro 5 · **Serve:** nginx (static) · **i18n:** TH at `/`, EN at `/en/`
- **Content source:** the local WordPress Docker stack in `../local` (http://localhost:8080)

## Run (build + serve)

```bash
docker compose up -d --build      # build dist/ in Docker, serve at http://localhost:4321
docker compose down               # stop
docker compose up -d --build web  # rebuild after content/code changes
```

Open **http://localhost:4321** (compare against the WordPress source at http://localhost:8080).

## Regenerate content from the local WordPress

Extraction reads the WP REST API, which the `disable-json-api` plugin blocks — toggle it on the
local stack (it's a disposable copy; never touch prod):

```bash
# 1) enable REST on the local WP
(cd ../local && docker compose --profile tools run --rm -T wpcli wp plugin deactivate disable-json-api)

# 2) extract posts → src/content/posts/{th,en} + media → public/media  (Node runs in a container)
docker compose --profile tools run --rm extract

# 3) re-block REST on the local WP
(cd ../local && docker compose --profile tools run --rm -T wpcli wp plugin activate disable-json-api)

# 4) rebuild the static site with the new content
docker compose up -d --build web
```

Nav menus (`src/data/nav.{th,en}.json`) are exported separately via wp-cli — see the Phase 1 plan.

## Pipeline unit tests

```bash
docker compose --profile tools run --rm test   # Vitest tests for scripts/lib/convert.mjs
```

## Layout

- `Dockerfile` — multi-stage: Node builds `dist/`, nginx serves it.
- `nginx.conf` — pretty-URL static serving for Astro's output.
- `scripts/extract.mjs` + `scripts/lib/convert.mjs` — WP→markdown extraction (tested).
- `src/content/posts/{th,en}/*.md` — generated content. `src/{layouts,components,pages,styles}` — the site.
- `public/media`, `public/fonts` — assets.

## Notes

- `node_modules`/`dist`/`.astro` are intentionally **not** on the host (see `.dockerignore`);
  the build creates them inside the image. The `extract`/`test` containers keep their deps in the
  `extract_modules` named volume.
- Cloudflare Pages deploy is **deferred** until the whole site (projects + pages) is migrated.
