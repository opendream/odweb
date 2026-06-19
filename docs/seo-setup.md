# SEO Measurement Setup

This repo is public-safe by default. Measurement identifiers stay blank in
`src/data/site.json`, and production values should be supplied as build-time
environment variables.

## Environment Variables

Set these in Cloudflare Pages under project settings, not in git:

```bash
GOOGLE_SITE_VERIFICATION=...
CLOUDFLARE_WEB_ANALYTICS_TOKEN=...
```

`GOOGLE_SITE_VERIFICATION` is the `content` value from the Google Search Console
HTML meta tag.

`CLOUDFLARE_WEB_ANALYTICS_TOKEN` is the token value Cloudflare shows in its Web
Analytics beacon snippet.

Both values are public identifiers once deployed because they are emitted into
the built HTML. They are not API secrets, but they should still not be committed
to this open-source repository.

## Source-Control Rule

Keep this file blank in committed source:

```json
{
  "cfBeaconToken": "",
  "googleSiteVerification": ""
}
```

Do not replace those blanks with production identifiers in a commit. If a local
test needs real values, pass them through environment variables for that command
only.

## Cloudflare Pages

Use the existing Pages build settings:

```bash
npm run build
```

Build output directory:

```bash
dist
```

Then set the two environment variables above in the Cloudflare Pages dashboard.
After the next deploy, view source on the deployed home page and confirm:

```html
<meta name="google-site-verification" content="...">
<script defer src="https://static.cloudflareinsights.com/beacon.min.js" ...>
```

If either environment variable is absent or blank, the corresponding tag is
omitted.

## Local Verification

Use a one-off Docker build command when checking measurement tags locally:

```bash
docker compose --profile tools run --rm \
  -e GOOGLE_SITE_VERIFICATION=test-google-verification \
  -e CLOUDFLARE_WEB_ANALYTICS_TOKEN=test-cloudflare-token \
  --entrypoint sh test \
  -lc 'npm install >/dev/null 2>&1 && npm run build && grep -q "google-site-verification" dist/index.html && grep -q "static.cloudflareinsights.com" dist/index.html'
```

The normal local rebuild keeps the committed blanks:

```bash
make rebuild
```

That should produce no Search Console or Cloudflare Web Analytics tags unless
the build environment explicitly provides the variables.
