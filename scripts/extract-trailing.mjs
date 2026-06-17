// Splits the scraped projects-landing HTML: drops the portfolio section (the first
// .et_pb_section, = section_0) and writes the remaining .et-l children (the trailing
// parallax + "Our Clients" sections) to a *-trailing.html partial that the data-driven
// landing renders after its portfolio grid. Re-run after any re-scrape of the landings.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'node-html-parser';

const ROOT = new URL('..', import.meta.url).pathname;
const LANDINGS = [
  { src: 'src/content/pages/th/projects.html',    out: 'src/content/pages/th/projects-trailing.html' },
  { src: 'src/content/pages/en/projects_en.html', out: 'src/content/pages/en/projects_en-trailing.html' },
];

for (const lg of LANDINGS) {
  const html = await readFile(join(ROOT, lg.src), 'utf8');
  const root = parse(html);
  const etl = root.querySelector('.et-l');
  if (!etl) throw new Error(`no .et-l in ${lg.src}`);
  const portfolioSection = etl.querySelector('.et_pb_section'); // first section = portfolio (section_0)
  if (portfolioSection) portfolioSection.remove();
  const trailing = etl.innerHTML.trim();
  await writeFile(join(ROOT, lg.out), trailing + '\n');
  const idx = [...new Set([...trailing.matchAll(/et_pb_section_(\d+)/g)].map((m) => m[1]))];
  console.log(`${lg.out}: ${trailing.length}B, sections=[${idx.join(',')}], portfolio_removed=${!trailing.includes('et_pb_filterable_portfolio')}`);
}
