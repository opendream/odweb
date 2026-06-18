// Augment each project .md frontmatter with the 4 metadata fields parsed from the live
// project page's #project-sidebar (<h3>label</h3> + following <p>/<ul>). Appends the managed
// fields (issues/type/year/partners), stripping any prior values first — idempotent, and never
// touches other frontmatter.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'node-html-parser';

const BASE = process.env.WP_BASE || 'http://localhost:8080';
const ROOT = new URL('..', import.meta.url).pathname;
const DIRS = ['src/content/projects/th', 'src/content/projects/en'];
const MANAGED = ['issues', 'type', 'year', 'partners'];

const LABELS = [
  ['issues', ['ประเด็น', 'issue']],
  ['type', ['ประเภท', 'type']],
  ['year', ['ปีที่พัฒนา', 'year', 'develop']],
  ['partners', ['ร่วมกับองค์กร', 'partner', 'collaborat']],
];
const classify = (label) => {
  const l = label.toLowerCase().trim();
  for (const [k, pats] of LABELS) if (pats.some((p) => l.includes(p))) return k;
  return null;
};
const yaml = (s) => (/[:#"'\n[\]%]/.test(s) ? `"${String(s).replace(/"/g, '\\"')}"` : String(s));

function stripManaged(fm) {
  const out = []; let skipping = false;
  for (const line of fm.split('\n')) {
    const kv = line.match(/^([A-Za-z_]\w*):/);
    if (kv) { skipping = MANAGED.includes(kv[1]); if (!skipping) out.push(line); continue; }
    if (skipping && /^\s+-\s/.test(line)) continue;
    skipping = false; out.push(line);
  }
  return out.join('\n');
}

async function fetchMeta(path) {
  const r = await fetch(BASE + path);
  if (!r.ok) return null;
  const sb = parse(await r.text()).querySelector('#project-sidebar');
  if (!sb) return null;
  const meta = {};
  for (const h3 of sb.querySelectorAll('h3')) {
    const key = classify(h3.text);
    if (!key) continue;
    let el = h3.nextElementSibling;
    while (el && !['p', 'ul', 'ol'].includes((el.tagName || '').toLowerCase())) el = el.nextElementSibling;
    if (!el) continue;
    const tag = (el.tagName || '').toLowerCase();
    const clean = (s) => s.replace(/\s+/g, ' ').trim(); // collapse internal newlines/spaces (YAML-safe)
    if (tag === 'ul' || tag === 'ol') meta[key] = el.querySelectorAll('li').map((li) => clean(li.text)).filter(Boolean);
    else meta[key] = clean(el.text);
  }
  return meta;
}

async function run() {
  let n = 0; const counts = { issues: 0, type: 0, year: 0, partners: 0 };
  for (const dir of DIRS) {
    let files; try { files = await readdir(join(ROOT, dir)); } catch { continue; }
    for (const f of files.filter((f) => f.endsWith('.md'))) {
      const fp = join(ROOT, dir, f);
      const md = await readFile(fp, 'utf8');
      const m = md.match(/^(---\n)([\s\S]*?)(\n---\n?)([\s\S]*)$/);
      if (!m) continue;
      const pathM = m[2].match(/^path:\s*"?([^"\n]+)"?/m);
      if (!pathM) continue;
      const meta = (await fetchMeta(pathM[1])) || {};
      const toArr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
      const lines = [];
      const issues = toArr(meta.issues).flatMap((s) => s.split(/[\/,|]/)).map((s) => s.trim()).filter(Boolean);
      if (issues.length) { lines.push('issues:', ...issues.map((s) => `  - ${yaml(s)}`)); counts.issues++; }
      if (meta.type) { lines.push(`type: ${yaml(Array.isArray(meta.type) ? meta.type.join(', ') : meta.type)}`); counts.type++; }
      if (meta.year) { lines.push(`year: ${yaml(String(Array.isArray(meta.year) ? meta.year[0] : meta.year))}`); counts.year++; }
      const partners = toArr(meta.partners).filter(Boolean);
      if (partners.length) { lines.push('partners:', ...partners.map((s) => `  - ${yaml(s)}`)); counts.partners++; }
      const fm = stripManaged(m[2]).replace(/\n+$/, '') + (lines.length ? '\n' + lines.join('\n') : '');
      await writeFile(fp, m[1] + fm + m[3] + m[4]);
      n++;
    }
  }
  console.log(`updated ${n} projects; fields populated:`, counts);
}
run().catch((e) => { console.error(e); process.exit(1); });
