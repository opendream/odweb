import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'node-html-parser';
import { extractBoc, collectWpContentUrls, unlazy } from './lib/pages.mjs';
import { toSiteRelative } from './lib/convert.mjs';

const BASE = process.env.WP_BASE || 'http://localhost:8080';
const ROOT = new URL('..', import.meta.url).pathname;
const PAGES = [
  { path: '/',    lang: 'th', slug: 'home' },
  { path: '/en/', lang: 'en', slug: 'homepage' },
  { path: '/about-us',       lang: 'th', slug: 'about-us' },
  { path: '/contact',        lang: 'th', slug: 'contact' },
  { path: '/join-us',        lang: 'th', slug: 'join-us' },
  { path: '/announcement',   lang: 'th', slug: 'announcement' },
  { path: '/en/about_en',    lang: 'en', slug: 'about_en' },
  { path: '/en/contact_en',  lang: 'en', slug: 'contact_en' },
  { path: '/en/join-us_en',  lang: 'en', slug: 'join-us_en' },
  // Phase 3c — service pages (children of the projects landing), preserve-HTML
  { path: '/projects/chatbot',                  lang: 'th', slug: 'chatbot' },
  { path: '/projects/crowdfunding',             lang: 'th', slug: 'crowdfunding' },
  { path: '/projects/crowdsourcing',            lang: 'th', slug: 'crowdsourcing' },
  { path: '/projects/e-commerce',               lang: 'th', slug: 'e-commerce' },
  { path: '/projects/graphic-design',           lang: 'th', slug: 'graphic-design' },
  { path: '/projects/interactive-infographic',  lang: 'th', slug: 'interactive-infographic' },
  { path: '/projects/intranet',                 lang: 'th', slug: 'intranet' },
  { path: '/projects/mobileapplication',        lang: 'th', slug: 'mobileapplication' },
  { path: '/projects/mobilegame',               lang: 'th', slug: 'mobilegame' },
  { path: '/projects/online-donation',          lang: 'th', slug: 'online-donation' },
  { path: '/projects/online-payment',           lang: 'th', slug: 'online-payment' },
  { path: '/projects/online-ticketing-system',  lang: 'th', slug: 'online-ticketing-system' },
  { path: '/projects/open-data',                lang: 'th', slug: 'open-data' },
  { path: '/projects/project',                  lang: 'th', slug: 'project' },
  { path: '/projects/web-application',          lang: 'th', slug: 'web-application' },
  { path: '/projects/web-portal',               lang: 'th', slug: 'web-portal' },
  { path: '/projects/website',                  lang: 'th', slug: 'website' },
  { path: '/en/projects_en/chatbot',                 lang: 'en', slug: 'chatbot' },
  { path: '/en/projects_en/crowdfunding',            lang: 'en', slug: 'crowdfunding' },
  { path: '/en/projects_en/crowdsourcing',           lang: 'en', slug: 'crowdsourcing' },
  { path: '/en/projects_en/graphic-design',          lang: 'en', slug: 'graphic-design' },
  { path: '/en/projects_en/interactive-infographic', lang: 'en', slug: 'interactive-infographic' },
  { path: '/en/projects_en/intranet',                lang: 'en', slug: 'intranet' },
  { path: '/en/projects_en/mobile-application',       lang: 'en', slug: 'mobile-application' },
  { path: '/en/projects_en/mobilegame',              lang: 'en', slug: 'mobilegame' },
  { path: '/en/projects_en/online-donation',         lang: 'en', slug: 'online-donation' },
  { path: '/en/projects_en/online-payment',          lang: 'en', slug: 'online-payment' },
  { path: '/en/projects_en/online-ticketing-system', lang: 'en', slug: 'online-ticketing-system' },
  { path: '/en/projects_en/open-data',               lang: 'en', slug: 'open-data' },
  { path: '/en/projects_en/project',                 lang: 'en', slug: 'project' },
  { path: '/en/projects_en/web-application',          lang: 'en', slug: 'web-application' },
  { path: '/en/projects_en/web-portal',              lang: 'en', slug: 'web-portal' },
  { path: '/en/projects_en/website',                 lang: 'en', slug: 'website' },
  // Phase 3c — the two landings, scraped for their per-page CSS + bodyClass only
  // (routing is owned by the index.astro listings; excluded in [...path].astro)
  { path: '/projects',        lang: 'th', slug: 'projects' },
  { path: '/en/projects_en',  lang: 'en', slug: 'projects_en' },
];

async function fetchText(url) {
  const r = await fetch(url, { headers: { Accept: 'text/html,text/css,*/*' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}
async function mirrorAsset(ref) {
  // ref may be absolute (http://host/wp-content/...) or root-relative (/wp-content/...)
  const p = ref.startsWith('http') ? new URL(ref).pathname : ref;   // /wp-content/... (may be %-encoded)
  const abs = ref.startsWith('http') ? ref : BASE + ref;
  // Write under the DECODED path so the on-disk filename matches what nginx resolves a
  // request to (a raw UTF-8 ref like /…/เทใจ@2x-1.jpg). Saving the %-encoded form as a
  // literal filename would 404 the raw reference.
  let diskPath; try { diskPath = decodeURIComponent(p); } catch { diskPath = p; }
  const dest = join(ROOT, 'public', diskPath);
  if (existsSync(dest)) return;
  const r = await fetch(abs);
  if (!r.ok) { console.warn(`asset ${r.status}: ${abs}`); return; }
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
}

async function run() {
  const manifestPath = join(ROOT, 'src/content/pages/manifest.json');
  let manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : [];
  for (const pg of PAGES) {
    const dom = parse(await fetchText(BASE + pg.path));
    let content = unlazy(extractBoc(dom.toString()));
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
