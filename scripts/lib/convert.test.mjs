import { describe, it, expect } from 'vitest';
import { urlToPath, stripDiviCruft, htmlToMarkdown, extractImageUrls, rewriteMediaUrls, toFrontmatter, toSiteRelative } from './convert.mjs';

describe('urlToPath', () => {
  it('strips host and trailing slash', () => {
    expect(urlToPath('http://localhost:8080/en/public/innovations-2/')).toBe('/en/public/innovations-2');
  });
  it('keeps root as /', () => {
    expect(urlToPath('http://localhost:8080/')).toBe('/');
  });
});

describe('stripDiviCruft', () => {
  it('removes empty Divi builder wrapper divs but keeps inner content', () => {
    const html = '<div class="et_pb_section"><p>Hello</p></div>';
    expect(stripDiviCruft(html)).toContain('<p>Hello</p>');
    expect(stripDiviCruft(html)).not.toContain('et_pb_section');
  });
  it('preserves non-Divi divs balanced (does not delete closing tags)', () => {
    const html = '<div class="wp-caption"><img src="/m/a.jpg" alt=""><p>cap</p></div>';
    const out = stripDiviCruft(html);
    expect(out).toContain('cap');
    expect((out.match(/<div/g) || []).length).toBe((out.match(/<\/div>/g) || []).length);
  });
  it('removes Divi shortcode tags', () => {
    expect(stripDiviCruft('[et_pb_section fb_built="1"]<p>Hi</p>[/et_pb_section]')).toBe('<p>Hi</p>');
  });
});

describe('toSiteRelative', () => {
  it('strips the WP origin from internal links', () => {
    expect(toSiteRelative('[x](http://localhost:8080/project/podd)')).toBe('[x](/project/podd)');
    expect(toSiteRelative('http://www.opendream.co.th/about')).toBe('/about');
  });
});

describe('htmlToMarkdown', () => {
  it('converts headings, paragraphs and links', () => {
    const md = htmlToMarkdown('<h2>Title</h2><p>Hi <a href="/x">link</a></p>');
    expect(md).toContain('## Title');
    expect(md).toContain('[link](/x)');
  });
  it('preserves images as markdown', () => {
    expect(htmlToMarkdown('<img src="/media/a.jpg" alt="A">')).toContain('![A](/media/a.jpg)');
  });
});

describe('extractImageUrls', () => {
  it('finds absolute upload URLs', () => {
    const html = '<img src="http://localhost:8080/wp-content/uploads/2018/09/a.jpg">';
    expect(extractImageUrls(html)).toEqual(['http://localhost:8080/wp-content/uploads/2018/09/a.jpg']);
  });
});

describe('rewriteMediaUrls', () => {
  it('rewrites upload URLs to site-relative /media paths', () => {
    const html = '<img src="http://localhost:8080/wp-content/uploads/2018/09/a.jpg">';
    expect(rewriteMediaUrls(html)).toContain('src="/media/2018/09/a.jpg"');
  });
});

describe('toFrontmatter', () => {
  it('serializes a YAML frontmatter block + body', () => {
    const out = toFrontmatter({ title: 'A: B', lang: 'th', categories: ['x'] }, 'BODY');
    expect(out).toMatch(/^---\n/);
    expect(out).toContain('title: "A: B"');
    expect(out).toContain('lang: th');
    expect(out).toContain('categories:\n  - x');
    expect(out.trim().endsWith('BODY')).toBe(true);
  });
});
