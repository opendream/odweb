import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { urlToPath, stripDiviCruft, htmlToMarkdown, extractImageUrls, rewriteMediaUrls, toFrontmatter, toSiteRelative } from './lib/convert.mjs';

const BASE = process.env.WP_BASE || 'http://localhost:8080';
const API = `${BASE}/wp-json/wp/v2`;
const ROOT = new URL('..', import.meta.url).pathname;

// Featured images whose attachment is REST-forbidden (attachment's post_parent is a
// draft → inherit-status attachment is hidden from anonymous REST, so _embed yields an
// error object instead of source_url). Maps attachment ID → uploads-relative path so
// extraction still recovers the cover. Discovered 2026-06-18 (judies/parkrun/infographic).
const FORBIDDEN_FEATURED = {
  26829: '2017/06/judies_main@2x.png',        // จูดี้ (Judies) — th & en
  28557: '2017/02/parkrun-thumbnail@2x.jpg',  // TMB Parkrun 2018 — en
  26227: '2017/02/infographic@2x.jpg',        // INFOGRAHPIC (NBCT) — en
};

async function fetchAll(type) {
  const out = [];
  for (let page = 1; ; page++) {
    const url = `${API}/${type}?per_page=100&page=${page}&_embed=1`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (r.status === 400) break;
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    const batch = await r.json();
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

// Normalize a media URL so it always points to WP_BASE (handles localhost:8080 vs host.docker.internal)
function normalizeMediaUrl(absUrl) {
  try {
    const u = new URL(absUrl);
    const base = new URL(BASE);
    u.hostname = base.hostname;
    u.port = base.port;
    u.protocol = base.protocol;
    return u.toString();
  } catch {
    return absUrl;
  }
}

async function downloadMedia(absUrl) {
  const rel = rewriteMediaUrls(`"${absUrl}"`).slice(1, -1);
  const dest = join(ROOT, 'public', rel);
  if (existsSync(dest)) return rel;
  const fetchUrl = normalizeMediaUrl(absUrl);
  const r = await fetch(fetchUrl);
  if (!r.ok) { console.warn(`media ${r.status}: ${fetchUrl}`); return rel; }
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
  return rel;
}

// Decode percent-encoded URI components safely (for slugs/paths that may contain Thai)
function decodeSafe(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// Strip markdown escape sequences that are invalid in YAML double-quoted strings
// Turndown may produce \[...\] for linked text in excerpts — strip the backslashes
function cleanExcerpt(s) {
  return s.replace(/\\([[\]()#*_`])/g, '$1');
}

async function extractType({ type, dir, catTaxonomy }) {
  const items = await fetchAll(type);
  const counts = { th: 0, en: 0 };

  for (const p of items) {
    // Detect language from path: EN items live under /en/
    const rawPath = urlToPath(p.link);
    const lang = rawPath.startsWith('/en/') ? 'en' : 'th';

    const html = p.content?.rendered || '';
    for (const img of extractImageUrls(html)) await downloadMedia(img);
    let cover;
    const feat = p._embedded?.['wp:featuredmedia']?.[0]?.source_url;
    if (feat) {
      cover = await downloadMedia(feat);
    } else if (p.featured_media) {
      // The post has a featured image, but its source_url didn't resolve via _embed.
      // Known cause: the attachment's post_parent is a draft, so an *inherit*-status
      // attachment is rest_forbidden to anonymous REST (the embed returns an error
      // object, not the media). The front-end still renders it (no permission check),
      // so the cover exists — we just can't read it over REST. Recover via a small
      // override map of attachment ID → uploads path; warn for any other unresolved id.
      const known = FORBIDDEN_FEATURED[p.featured_media];
      if (known) {
        cover = await downloadMedia(`${BASE}/wp-content/uploads/${known}`);
      } else {
        console.warn(`featured media ${p.featured_media} unresolved for ${p.slug} (REST-forbidden? add to FORBIDDEN_FEATURED) — no cover`);
      }
    }
    const cleaned = rewriteMediaUrls(stripDiviCruft(html));
    // Also rewrite relative /wp-content/uploads/ paths left after HTML→MD conversion
    const body = toSiteRelative(htmlToMarkdown(cleaned)).replace(/\/wp-content\/uploads\//g, '/media/');
    const terms = (p._embedded?.['wp:term'] || []).flat();

    // Decode slug and path: WP may return percent-encoded Thai characters
    const slug = decodeSafe(p.slug);
    const path = decodeSafe(rawPath);

    const rawExcerpt = toSiteRelative(htmlToMarkdown(stripDiviCruft(rewriteMediaUrls(p.excerpt?.rendered || '')))).replace(/\n/g, ' ').trim();
    const excerpt = rawExcerpt ? cleanExcerpt(rawExcerpt) : undefined;

    // Decode title HTML entities and strip remaining HTML
    const title = p.title.rendered
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/<[^>]+>/g, '');

    const categories = terms.filter(t => t.taxonomy === catTaxonomy).map(t => t.name);
    // posts keep post_tag behavior; projects have no tags
    const tags = catTaxonomy === 'category'
      ? terms.filter(t => t.taxonomy === 'post_tag').map(t => t.name)
      : [];

    const data = {
      title,
      date: new Date(p.date),
      modified: new Date(p.modified),
      lang,
      slug,
      path,
      categories,
      tags,
      cover,
      excerpt,
    };
    // Use original (URL-safe, percent-encoded) slug as filename so it round-trips correctly
    const safeSlug = p.slug;
    const file = join(ROOT, 'src/content', dir, lang, `${safeSlug}.md`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, toFrontmatter(data, body));
    counts[lang]++;
  }

  console.log(`${type}[th]: ${counts.th}`);
  console.log(`${type}[en]: ${counts.en}`);
  console.log(`TOTAL ${type} written: ${counts.th + counts.en}`);
}

async function run() {
  await extractType({ type: 'posts',   dir: 'posts',    catTaxonomy: 'category' });
  await extractType({ type: 'project', dir: 'projects', catTaxonomy: 'project_category' });
}
run().catch(e => { console.error(e); process.exit(1); });
