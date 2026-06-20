import { describe, it, expect } from 'vitest';
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

describe('webpFor', () => {
  it('returns an existing smaller webp sibling', () => {
    expect(webpFor('/media/2016/12/corrupt@2x.png')).toBe('/media/2016/12/corrupt@2x.png.webp');
  });

  it('returns null when the sibling is missing', () => {
    expect(webpFor('/media/logo_foot.png')).toBeNull();
    expect(webpFor('/media/not-real.jpg')).toBeNull();
  });
});

describe('shouldUseWebp', () => {
  it('only accepts a strictly smaller webp payload', () => {
    expect(shouldUseWebp(100, 99)).toBe(true);
    expect(shouldUseWebp(100, 100)).toBe(false);
    expect(shouldUseWebp(100, 101)).toBe(false);
  });
});
