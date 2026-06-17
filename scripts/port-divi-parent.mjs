// One-off: port the Divi parent theme stylesheet (themes/Divi/style.css) into the
// vendor CSS chain. This file holds the base Divi grid (.et_pb_row{margin:auto} +
// responsive @media) that the live child theme pulls in via @import — it was dropped
// when theme.css was ported, which left designed pages boxed-left / non-responsive.
// Rewrites relative url() refs to /wp-content/themes/Divi/<path> and mirrors those assets.
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const BASE = process.env.WP_BASE || 'http://localhost:8080';
const ROOT = new URL('..', import.meta.url).pathname;
const SRC = `${BASE}/wp-content/themes/Divi/style.css`;
const PREFIX = '/wp-content/themes/Divi/';

const css = await (await fetch(SRC)).text();

// Collect relative url() targets (to mirror) and rewrite the CSS.
const assets = new Set();
const rewritten = css.replace(/url\((['"]?)([^)'"]+)\1\)/g, (m, q, ref) => {
  if (/^(data:|https?:\/\/|\/)/.test(ref)) {
    // strip the local origin if present; otherwise leave external refs alone
    const local = ref.replace(/^https?:\/\/(?:www\.)?(?:localhost:8080|opendream\.co\.th)/, '');
    return `url(${q}${local}${q})`;
  }
  // relative → root-relative under the Divi theme dir; remember the clean path to mirror
  const clean = ref.split(/[?#]/)[0];
  if (clean) assets.add(clean);
  return `url(${q}${PREFIX}${ref}${q})`;
});

const dest = join(ROOT, 'src/styles/vendor/divi-parent.css');
await mkdir(dirname(dest), { recursive: true });
await writeFile(dest, `/* themes/Divi/style.css (parent grid + responsive) — ported for fidelity */\n${rewritten}`);
console.log(`wrote ${dest} (${rewritten.length}B), ${assets.size} relative assets to mirror`);

for (const rel of assets) {
  const url = `${BASE}${PREFIX}${rel}`;
  const out = join(ROOT, 'public', PREFIX, rel);
  if (existsSync(out)) { console.log(`  skip (exists) ${rel}`); continue; }
  const r = await fetch(url);
  if (!r.ok) { console.warn(`  asset ${r.status}: ${rel}`); continue; }
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, Buffer.from(await r.arrayBuffer()));
  console.log(`  mirrored ${rel}`);
}
