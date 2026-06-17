import { describe, it, expect } from 'vitest';
import { sectorSlugs, SECTORS } from './categories.mjs';

describe('sectorSlugs', () => {
  it('maps a TH sector label and ignores non-sector (type) labels', () => {
    expect(sectorSlugs(['การศึกษา', 'Web Application'])).toEqual(['education']);
  });
  it('maps EN sector labels', () => {
    expect(sectorSlugs(['Health', 'Other'])).toEqual(['health', 'other']);
  });
  it('dedupes labels that map to the same slug', () => {
    expect(sectorSlugs(['อื่น ๆ', 'Other', 'Mobile Game'])).toEqual(['other']);
  });
  it('returns [] for empty or undefined input', () => {
    expect(sectorSlugs()).toEqual([]);
    expect(sectorSlugs([])).toEqual([]);
  });
});

describe('SECTORS', () => {
  it('lists all + the 4 sectors in the live filter order', () => {
    expect(SECTORS.map((s) => s.slug)).toEqual(['all', 'education', 'livelihood', 'health', 'other']);
  });
  it('carries TH and EN labels for each', () => {
    const edu = SECTORS.find((s) => s.slug === 'education');
    expect(edu.th).toBe('การศึกษา');
    expect(edu.en).toBe('Education');
  });
});
