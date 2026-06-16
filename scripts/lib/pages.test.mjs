import { describe, it, expect } from 'vitest';
import { extractBoc, collectWpContentUrls } from './pages.mjs';

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
});
