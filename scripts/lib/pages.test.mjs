import { describe, it, expect } from 'vitest';
import { extractBoc, collectWpContentUrls, unlazy } from './pages.mjs';

describe('extractBoc', () => {
  it('returns the #et-boc element outerHTML', () => {
    const html = '<body><div id="main-content"><div id="et-boc" class="et-l"><section>X</section></div></div></body>';
    const out = extractBoc(html);
    expect(out).toContain('id="et-boc"');
    expect(out).toContain('<section>X</section>');
  });
  it('falls back to .entry-content when no #et-boc', () => {
    const html = '<div class="entry-content"><p>Y</p></div>';
    expect(extractBoc(html)).toContain('<p>Y</p>');
  });
  it('returns empty string when neither present', () => {
    expect(extractBoc('<div>nope</div>')).toBe('');
  });
});

describe('collectWpContentUrls', () => {
  it('collects unique absolute wp-content URLs from text', () => {
    const text = 'a url(http://localhost:8080/wp-content/themes/Divi/x.woff) b "http://localhost:8080/wp-content/uploads/1.jpg" http://localhost:8080/wp-content/uploads/1.jpg';
    expect(collectWpContentUrls(text).sort()).toEqual([
      'http://localhost:8080/wp-content/themes/Divi/x.woff',
      'http://localhost:8080/wp-content/uploads/1.jpg',
    ]);
  });
  it('also collects root-relative /wp-content refs', () => {
    const text = 'src="/wp-content/uploads/a.png" url(/wp-content/themes/x.woff)';
    expect(collectWpContentUrls(text).sort()).toEqual([
      '/wp-content/themes/x.woff',
      '/wp-content/uploads/a.png',
    ]);
  });
});

describe('unlazy', () => {
  it('promotes data-src to src and drops the placeholder + lazyload class', () => {
    const html = '<img src="data:image/gif;base64,R0lGOD" data-src="/wp-content/uploads/x.png" class="lazyload">';
    const out = unlazy(html);
    expect(out).toContain('src="/wp-content/uploads/x.png"');
    expect(out).not.toContain('data:image');
    expect(out).not.toContain('data-src');
    expect(out).not.toContain('lazyload');
  });
  it('promotes data-srcset and drops placeholder srcset', () => {
    const html = '<img src="/wp-content/uploads/c.png" srcset="data:image/gif;base64,R0=" data-srcset="/wp-content/uploads/c.png 1x, /wp-content/uploads/c-2x.png 2x">';
    const out = unlazy(html);
    expect(out).toContain('srcset="/wp-content/uploads/c.png 1x, /wp-content/uploads/c-2x.png 2x"');
    expect(out).not.toContain('data:image');
    expect(out).not.toContain('data-srcset');
  });
  it('leaves non-lazy images untouched', () => {
    const html = '<img src="/media/y.jpg" alt="y">';
    expect(unlazy(html)).toBe(html);
  });
});
