// Post-build: purge unused CSS from the bundled Astro stylesheet(s). The global CSS is the
// full Divi theme (~850KB); most of it (woocommerce, unused modules, admin) is never used.
// PurgeCSS scans the built HTML and drops rules whose classes/ids don't appear. A safelist
// keeps JS-toggled / pseudo-state classes that static scanning can't see. Per-page inline
// <style> (et-core-unified) is left untouched. Visual parity is verified separately.
import { PurgeCSS } from 'purgecss';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const cssDir = join(ROOT, 'dist/_astro');
const cssFiles = (await readdir(cssDir)).filter((f) => f.endsWith('.css')).map((f) => join(cssDir, f));

let before = 0;
for (const f of cssFiles) before += (await readFile(f)).length;

const results = await new PurgeCSS().purge({
  content: [join(ROOT, 'dist/**/*.html')],
  css: cssFiles,
  safelist: {
    standard: ['active', 'lazyload', 'clearfix'],
    // JS-toggled / animation / overlay states that static HTML scanning may not surface
    greedy: [/et_pb_animation/, /et_overlay/, /et-waypoint/, /et_animated/, /et-fixed-header/],
    keyframes: true,
    fontFace: true,
    variables: true,
  },
});

let after = 0;
for (const r of results) { await writeFile(r.file, r.css); after += r.css.length; }
console.log(`purgecss: ${before} -> ${after} bytes (${Math.round((1 - after / before) * 100)}% smaller) across ${results.length} file(s)`);
