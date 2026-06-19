import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { findAltIssues } from './lib/alt.mjs';

const DEFAULT_ROOTS = ['src/content'];
const EXTENSIONS = new Set(['.astro', '.md', '.mdx']);

async function collectFiles(target) {
  const info = await stat(target);
  if (info.isFile()) {
    return EXTENSIONS.has(path.extname(target)) ? [target] : [];
  }

  const entries = await readdir(target, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

const roots = process.argv.slice(2);
const targets = roots.length ? roots : DEFAULT_ROOTS;
const files = (await Promise.all(targets.map(collectFiles))).flat().sort();
const issues = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  issues.push(...findAltIssues(source, file));
}

for (const issue of issues) {
  console.log(`${issue.file}:${issue.line}:${issue.column} ${issue.reason} ${issue.src}`);
}

if (issues.length) {
  console.error(`Found ${issues.length} image alt issue(s).`);
  process.exitCode = 1;
} else {
  console.log('No image alt issues found.');
}
