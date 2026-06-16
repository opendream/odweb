import TurndownService from 'turndown';

const UPLOADS_RE = /https?:\/\/[^"')\s]+\/wp-content\/uploads\/([^"')\s]+)/g;

export function urlToPath(link) {
  const { pathname } = new URL(link);
  const p = pathname.replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

export function stripDiviCruft(html) {
  return html
    .replace(/\sclass="[^"]*et_pb_[^"]*"/g, '')
    .replace(/\sdata-[a-z-]+="[^"]*"/g, '')
    .replace(/\[\/?et_pb_[^\]]*\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });

export function htmlToMarkdown(html) {
  return turndown.turndown(html).trim();
}

export function extractImageUrls(html) {
  return [...html.matchAll(UPLOADS_RE)].map(m => m[0]);
}

export function rewriteMediaUrls(html) {
  return html.replace(UPLOADS_RE, (_m, tail) => `/media/${tail}`);
}

const WP_ORIGINS = /https?:\/\/(?:www\.)?(?:localhost:8080|opendream\.co\.th)/g;
export function toSiteRelative(text) {
  return text.replace(WP_ORIGINS, '');
}

function yamlValue(v) {
  if (Array.isArray(v)) return v.length ? '\n' + v.map(x => `  - ${x}`).join('\n') : ' []';
  if (v instanceof Date) return ` ${v.toISOString()}`;
  const s = String(v);
  // Quote if contains YAML-special chars: colon, hash, quote, newline,
  // square brackets (would parse as flow sequences), percent (URL-encoded slugs)
  return /[:#"'\n[\]%]/.test(s) ? ` "${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : ` ${s}`;
}

export function toFrontmatter(data, body) {
  const lines = Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}:${yamlValue(v)}`);
  return `---\n${lines.join('\n')}\n---\n\n${body}\n`;
}
