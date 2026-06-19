const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);

function lineColumnAt(source, index) {
  const before = source.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function imagePathFromMarkdownTarget(target = '') {
  const src = target.trim().split(/\s+/)[0] ?? '';
  return src.replace(/^<|>$/g, '');
}

function isImagePath(src = '') {
  if (!src) return false;
  const path = src.split(/[?#]/)[0].toLowerCase();
  const ext = path.includes('.') ? path.slice(path.lastIndexOf('.')) : '';
  return IMAGE_EXTENSIONS.has(ext);
}

export function findMarkdownAltIssues(source, file = '') {
  const issues = [];
  const imagePattern = /!\[([^\]]*)\]\(([^)]*)\)/g;

  for (const match of source.matchAll(imagePattern)) {
    const alt = match[1] ?? '';
    const src = imagePathFromMarkdownTarget(match[2]);
    if (!isImagePath(src) || alt.trim()) continue;
    issues.push({
      kind: 'markdown-image',
      reason: 'empty-alt',
      file,
      src,
      ...lineColumnAt(source, match.index ?? 0),
    });
  }

  return issues;
}

export function findHtmlAltIssues(source, file = '') {
  const issues = [];
  const tagPattern = /<img\b[^>]*>/gi;

  for (const match of source.matchAll(tagPattern)) {
    const tag = match[0];
    const src = tag.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|\{["']([^"']*)["']\})/i);
    const alt = tag.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|\{["']([^"']*)["']\})/i);
    const value = alt?.[1] ?? alt?.[2] ?? alt?.[3];
    const imageSrc = src?.[1] ?? src?.[2] ?? src?.[3] ?? '';

    if (value !== undefined && value.trim()) continue;
    issues.push({
      kind: 'html-img',
      reason: value === undefined ? 'missing-alt' : 'empty-alt',
      file,
      src: imageSrc,
      ...lineColumnAt(source, match.index ?? 0),
    });
  }

  return issues;
}

export function findAltIssues(source, file = '') {
  return [...findMarkdownAltIssues(source, file), ...findHtmlAltIssues(source, file)].sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return a.column - b.column;
  });
}
