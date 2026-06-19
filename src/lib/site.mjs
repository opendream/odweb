// Single source of truth for the site origin used to build absolute URLs
// (canonical, og:image/og:url, hreflang, JSON-LD, sitemap).
//
// The site is STATIC, so the origin is baked at BUILD time. We derive it from the
// deploy context so previews work without hardcoding:
//   • Production branch (or local builds)  -> the canonical apex.
//   • Any other branch on Cloudflare       -> that branch's preview URL
//     (<branch>-<worker>.<subdomain>.workers.dev), so canonical/OG resolve on previews.
//   • An explicit SITE_URL env var always wins (escape hatch for local/other hosts).
//
// Cloudflare Workers Builds auto-injects WORKERS_CI_BRANCH at build time.

export const PRODUCTION_ORIGIN = 'https://opendream.co.th';

const PRODUCTION_BRANCH = 'production';
const WORKER = 'odweb';
const SUBDOMAIN = 'opendream';

export function resolveSiteOrigin(env = {}) {
  if (env.SITE_URL) return env.SITE_URL.replace(/\/+$/, '');
  const branch = env.WORKERS_CI_BRANCH;
  if (!branch || branch === PRODUCTION_BRANCH) return PRODUCTION_ORIGIN;
  // Cloudflare's branch-preview subdomain: lowercased, non-alphanumerics -> '-', clipped to 63.
  const slug = branch.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);
  return `https://${slug}-${WORKER}.${SUBDOMAIN}.workers.dev`;
}

// A build whose origin isn't the canonical apex is a preview -> must be noindexed.
export const isPreviewOrigin = (origin) => origin !== PRODUCTION_ORIGIN;
