import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { decodeEntities } from './lib/entities.mjs';

const ROOT = 'src/content';
const FRONTMATTER = /^(---\r?\n[\s\S]*?\r?\n---)([\s\S]*)$/;
const CONTENT_EXTENSIONS = new Set(['.md', '.mdx']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(path));
    } else if (CONTENT_EXTENSIONS.has(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
}

const files = await walk(ROOT);
let changed = 0;

for (const file of files) {
  const text = await readFile(file, 'utf8');
  const match = text.match(FRONTMATTER);
  if (!match) continue;

  const decodedFrontmatter = decodeEntities(match[1]);
  if (decodedFrontmatter === match[1]) continue;

  await writeFile(file, `${decodedFrontmatter}${match[2]}`);
  changed += 1;
  console.log(`fixed: ${file}`);
}

console.log(`\n${changed} file(s) updated.`);
