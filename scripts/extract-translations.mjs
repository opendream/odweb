// Build a {path: altPath} map of TH<->EN translations by scraping each built page's
// authoritative Polylang <link rel="alternate" hreflang> tags from the live WP.
import { writeFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parse } from 'node-html-parser';

const BASE = process.env.WP_BASE || 'http://localhost:8080';
const ROOT = new URL('..', import.meta.url).pathname;
const strip = (u) => u.replace(/https?:\/\/(?:www\.)?(?:localhost:8080|opendream\.co\.th)/, '').replace(/\/$/, '') || '/';

async function ourPaths() {
  const paths = new Set();
  for (const col of ['posts', 'projects', 'policies']) {
    const base = join(ROOT, 'src/content', col);
    const walk = async (d) => { for (const e of await readdir(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith('.md')) { const m = (await readFile(p, 'utf8')).match(/^path:\s*"?([^"\n]+)"?/m); if (m) paths.add(strip(m[1])); }
    }};
    await walk(base).catch(() => {});
  }
  const man = JSON.parse(await readFile(join(ROOT, 'src/content/pages/manifest.json'), 'utf8'));
  for (const m of man) paths.add(strip(m.path));
  return paths;
}

async function run() {
  const paths = await ourPaths();
  const map = {};
  let n = 0;
  for (const p of paths) {
    try {
      const html = await (await fetch(BASE + p)).text();
      const root = parse(html);
      for (const l of root.querySelectorAll('link[rel="alternate"][hreflang]')) {
        const hl = l.getAttribute('hreflang'); if (hl === 'x-default') continue;
        const alt = strip(l.getAttribute('href') || '');
        if (alt && alt !== p && paths.has(alt)) map[p] = alt;
      }
    } catch (e) { console.warn(`skip ${p}: ${e.message}`); }
    if (++n % 50 === 0) console.log(`  ...${n}/${paths.size}`);
  }
  const out = join(ROOT, 'src/data/translations.json');
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(Object.fromEntries(Object.entries(map).sort()), null, 2) + '\n');
  console.log(`translations: ${Object.keys(map).length} paired / ${paths.size} pages`);
}
run().catch((e) => { console.error(e); process.exit(1); });
