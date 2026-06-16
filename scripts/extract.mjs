import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { urlToPath, stripDiviCruft, htmlToMarkdown, extractImageUrls, rewriteMediaUrls, toFrontmatter, toSiteRelative } from './lib/convert.mjs';

const BASE = process.env.WP_BASE || 'http://localhost:8080';
const API = `${BASE}/wp-json/wp/v2`;
const ROOT = new URL('..', import.meta.url).pathname;

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

async function downloadMedia(absUrl) {
  const rel = rewriteMediaUrls(`"${absUrl}"`).slice(1, -1);
  const dest = join(ROOT, 'public', rel);
  if (existsSync(dest)) return rel;
  const r = await fetch(absUrl);
  if (!r.ok) { console.warn(`media ${r.status}: ${absUrl}`); return rel; }
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

async function run() {
  const posts = await fetchAll('posts');
  const counts = { th: 0, en: 0 };

  for (const p of posts) {
    // Detect language from path: EN posts live under /en/
    const rawPath = urlToPath(p.link);
    const lang = rawPath.startsWith('/en/') ? 'en' : 'th';

    const html = p.content?.rendered || '';
    for (const img of extractImageUrls(html)) await downloadMedia(img);
    let cover;
    const feat = p._embedded?.['wp:featuredmedia']?.[0]?.source_url;
    if (feat) cover = await downloadMedia(feat);
    const cleaned = rewriteMediaUrls(stripDiviCruft(html));
    const body = toSiteRelative(htmlToMarkdown(cleaned));
    const terms = (p._embedded?.['wp:term'] || []).flat();

    // Decode slug and path: WP may return percent-encoded Thai characters
    const slug = decodeSafe(p.slug);
    const path = decodeSafe(rawPath);

    const rawExcerpt = toSiteRelative(htmlToMarkdown(p.excerpt?.rendered || '')).replace(/\n/g, ' ').trim();
    const excerpt = rawExcerpt ? cleanExcerpt(rawExcerpt) : undefined;

    // Decode title HTML entities and strip remaining HTML
    const title = p.title.rendered
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/<[^>]+>/g, '');

    const data = {
      title,
      date: new Date(p.date),
      modified: new Date(p.modified),
      lang,
      slug,
      path,
      categories: terms.filter(t => t.taxonomy === 'category').map(t => t.name),
      tags: terms.filter(t => t.taxonomy === 'post_tag').map(t => t.name),
      cover,
      excerpt,
    };
    // Use decoded slug as filename too so frontmatter and filename align
    const safeSlug = p.slug; // keep URL-safe filename (percent-encoded)
    const file = join(ROOT, 'src/content/posts', lang, `${safeSlug}.md`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, toFrontmatter(data, body));
    counts[lang]++;
  }

  console.log(`posts[th]: ${counts.th}`);
  console.log(`posts[en]: ${counts.en}`);
  console.log(`TOTAL posts written: ${counts.th + counts.en}`);
}
run().catch(e => { console.error(e); process.exit(1); });
