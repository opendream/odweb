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
    // Strip <noscript> fallback images: unlazy already promoted data-src on the real <img>,
    // so the <noscript><img></noscript> copy is redundant — and turndown would render it as a
    // second, duplicate image in the markdown.
    let content = unlazy(extractEntryContent(dom.toString())).replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
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
