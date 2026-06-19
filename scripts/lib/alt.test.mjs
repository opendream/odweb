import { describe, expect, it } from 'vitest';
import { findAltIssues, findHtmlAltIssues, findMarkdownAltIssues } from './alt.mjs';

describe('findMarkdownAltIssues', () => {
  it('reports empty and whitespace-only Markdown image alts', () => {
    const md = 'a ![](/one.png) b ![ ](/two.webp) c ![good](/three.jpg)';
    expect(findMarkdownAltIssues(md, 'x.md')).toEqual([
      { kind: 'markdown-image', reason: 'empty-alt', file: 'x.md', src: '/one.png', line: 1, column: 3 },
      { kind: 'markdown-image', reason: 'empty-alt', file: 'x.md', src: '/two.webp', line: 1, column: 19 },
    ]);
  });

  it('ignores non-image links and keeps line numbers', () => {
    const md = '[x](/one.png)\n![](/two.pdf)\n![](/three.jpg)';
    expect(findMarkdownAltIssues(md, 'x.md')).toEqual([
      { kind: 'markdown-image', reason: 'empty-alt', file: 'x.md', src: '/three.jpg', line: 3, column: 1 },
    ]);
  });
});

describe('findHtmlAltIssues', () => {
  it('reports missing and empty img alts', () => {
    const html = '<img src="/a.png"><img src="/b.png" alt=""><img src="/c.png" alt="Chart">';
    expect(findHtmlAltIssues(html, 'x.astro')).toEqual([
      { kind: 'html-img', reason: 'missing-alt', file: 'x.astro', src: '/a.png', line: 1, column: 1 },
      { kind: 'html-img', reason: 'empty-alt', file: 'x.astro', src: '/b.png', line: 1, column: 19 },
    ]);
  });
});

describe('findAltIssues', () => {
  it('combines Markdown and HTML issues in source order', () => {
    const source = '![](/a.png)\n<img src="/b.png">';
    expect(findAltIssues(source, 'x.md').map((issue) => issue.kind)).toEqual(['markdown-image', 'html-img']);
  });
});
