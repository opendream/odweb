import { describe, expect, it } from 'vitest';
import { decodeEntities } from './entities.mjs';

describe('decodeEntities', () => {
  it('decodes decimal numeric entities', () => {
    expect(decodeEntities('&#8216;x&#8217;')).toBe('\u2018x\u2019');
  });

  it('decodes &#038; to an ampersand', () => {
    expect(decodeEntities('A &#038; B')).toBe('A & B');
  });

  it('decodes hex numeric entities', () => {
    expect(decodeEntities('&#x2014;')).toBe('\u2014');
  });

  it('decodes common named entities', () => {
    expect(decodeEntities('a &amp; b &quot;c&quot;')).toBe('a & b "c"');
  });

  it('leaves unknown entities untouched', () => {
    expect(decodeEntities('&unknownentity; &foo;')).toBe('&unknownentity; &foo;');
  });

  it('handles double-encoded input by looping to a stable result', () => {
    expect(decodeEntities('&amp;#8217;')).toBe('\u2019');
  });

  it('returns plain text unchanged', () => {
    expect(decodeEntities('plain text')).toBe('plain text');
  });
});
