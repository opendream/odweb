import { describe, it, expect } from 'vitest';
import { webpFor } from './img.mjs';

describe('webpFor', () => {
  it('maps a local png to its .webp sibling', () => {
    expect(webpFor('/media/2016/12/corrupt@2x.png')).toBe('/media/2016/12/corrupt@2x.png.webp');
  });

  it('maps jpg and jpeg', () => {
    expect(webpFor('/media/a.jpg')).toBe('/media/a.jpg.webp');
    expect(webpFor('/media/a.jpeg')).toBe('/media/a.jpeg.webp');
  });

  it('is case-insensitive on the extension', () => {
    expect(webpFor('/media/A.PNG')).toBe('/media/A.PNG.webp');
  });

  it('returns null for svg and gif', () => {
    expect(webpFor('/media/od_logo.svg')).toBeNull();
    expect(webpFor('/media/anim.gif')).toBeNull();
  });

  it('returns null for non-media or remote paths', () => {
    expect(webpFor('/assets/x.png')).toBeNull();
    expect(webpFor('https://cdn.example.com/x.png')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(webpFor(undefined)).toBeNull();
    expect(webpFor(null)).toBeNull();
  });
});
