import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { shouldUseWebp, webpFor, webpPathFor } from './img.mjs';

describe('webpPathFor', () => {
  it('maps a local png to its .webp sibling', () => {
    expect(webpPathFor('/media/2016/12/corrupt@2x.png')).toBe('/media/2016/12/corrupt@2x.png.webp');
  });

  it('maps jpg and jpeg', () => {
    expect(webpPathFor('/media/a.jpg')).toBe('/media/a.jpg.webp');
    expect(webpPathFor('/media/a.jpeg')).toBe('/media/a.jpeg.webp');
  });

  it('is case-insensitive on the extension', () => {
    expect(webpPathFor('/media/A.PNG')).toBe('/media/A.PNG.webp');
  });

  it('returns null for svg and gif', () => {
    expect(webpPathFor('/media/od_logo.svg')).toBeNull();
    expect(webpPathFor('/media/anim.gif')).toBeNull();
  });

  it('returns null for non-media or remote paths', () => {
    expect(webpPathFor('/assets/x.png')).toBeNull();
    expect(webpPathFor('https://cdn.example.com/x.png')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(webpPathFor(undefined)).toBeNull();
    expect(webpPathFor(null)).toBeNull();
  });
});

describe('shouldUseWebp', () => {
  it('only accepts a strictly smaller webp payload', () => {
    expect(shouldUseWebp(100, 99)).toBe(true);
    expect(shouldUseWebp(100, 100)).toBe(false);
    expect(shouldUseWebp(100, 101)).toBe(false);
  });

  it('rejects non-finite sizes', () => {
    expect(shouldUseWebp(NaN, 1)).toBe(false);
    expect(shouldUseWebp(1, undefined)).toBe(false);
  });
});

// webpFor reads the filesystem, so drive it against a self-contained fixture tree
// (via the mediaRoot param) instead of the committed public/media library.
describe('webpFor (filesystem-backed)', () => {
  let root;
  const write = (rel, bytes) => {
    const full = path.join(root, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, Buffer.alloc(bytes));
  };

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), 'odweb-img-'));
    write('2016/12/corrupt@2x.png', 1000);          // fallback
    write('2016/12/corrupt@2x.png.webp', 200);       // smaller webp -> use it
    write('logo.png', 500);                           // fallback, no webp sibling
    write('flat.png', 300);                           // fallback
    write('flat.png.webp', 400);                      // larger webp -> omit
  });

  afterAll(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it('returns the webp sibling when it exists and is smaller', () => {
    expect(webpFor('/media/2016/12/corrupt@2x.png', root)).toBe('/media/2016/12/corrupt@2x.png.webp');
  });

  it('returns null when the webp sibling is missing', () => {
    expect(webpFor('/media/logo.png', root)).toBeNull();
  });

  it('returns null when the webp sibling is not smaller than the fallback', () => {
    expect(webpFor('/media/flat.png', root)).toBeNull();
  });

  it('returns null for non-webp-eligible inputs', () => {
    expect(webpFor('/media/logo.svg', root)).toBeNull();
    expect(webpFor('https://cdn.example.com/x.png', root)).toBeNull();
  });
});
