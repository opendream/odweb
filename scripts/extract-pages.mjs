import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'node-html-parser';
import { extractBoc, collectWpContentUrls } from './lib/pages.mjs';
import { toSiteRelative } from './lib/convert.mjs';

const BASE = process.env.WP_BASE || 'http://localhost:8080';
const ROOT = new URL('..', import.meta.url).pathname;
const PAGES = [
  { path: '/',    lang: 'th', slug: 'home' },
  { path: '/en/', lang: 'en', slug: 'homepage' },
];

async function fetchText(url) {
  const r = await fetch(url, { headers: { Accept: 'text/html,text/css,*/*' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}
async function mirrorAsset(absUrl) {
  const p = new URL(absUrl).pathname;            // /wp-content/...
  const dest = join(ROOT, 'public', p);
  if (existsSync(dest)) return;
  const r = await fetch(absUrl);
  if (!r.ok) { console.warn(`asset ${r.status}: ${absUrl}`); return; }
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
}

async function run() {
  const manifestPath = join(ROOT, 'src/content/pages/manifest.json');
  let manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : [];
  for (const pg of PAGES) {
    const dom = parse(await fetchText(BASE + pg.path));
    let content = extractBoc(dom.toString());
    const cssLinks = dom.querySelectorAll('link[rel="stylesheet"]')
      .map((l) => l.getAttribute('href')).filter(Boolean)
      .filter((h) => /et-cache\/\d+\/et-core-unified/.test(h) || /et-divi-customizer-global/.test(h));
    let css = '';
    for (const href of cssLinks) {
      const abs = href.startsWith('http') ? href : BASE + href;
      css += `\n/* ${href} */\n` + await fetchText(abs);
    }
    const title = (dom.querySelector('title')?.text || 'Opendream').trim();
    const description = dom.querySelector('meta[name="description"]')?.getAttribute('content') || undefined;
    const bodyClass = dom.querySelector('body')?.getAttribute('class') || '';
    for (const u of collectWpContentUrls(content + '\n' + css)) await mirrorAsset(u);
    content = toSiteRelative(content);
    css = toSiteRelative(css);
    const htmlRel = `src/content/pages/${pg.lang}/${pg.slug}.html`;
    const cssRel = `src/styles/pages/${pg.lang}-${pg.slug}.css`;
    await mkdir(dirname(join(ROOT, htmlRel)), { recursive: true });
    await mkdir(dirname(join(ROOT, cssRel)), { recursive: true });
    await writeFile(join(ROOT, htmlRel), content + '\n');
    await writeFile(join(ROOT, cssRel), css + '\n');
    manifest = manifest.filter((m) => !(m.path === pg.path && m.lang === pg.lang));
    manifest.push({ path: pg.path, lang: pg.lang, slug: pg.slug, title, description, bodyClass, html: htmlRel, css: cssRel });
    console.log(`page[${pg.lang}] ${pg.path}: ${content.length}B html, ${css.length}B css, bodyClass="${bodyClass.slice(0,40)}…"`);
  }
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
run().catch((e) => { console.error(e); process.exit(1); });
