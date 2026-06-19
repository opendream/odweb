import { describe, expect, it } from 'vitest';
import {
  buildAlternatePathMap,
  createSitemapSerializer,
  isSitemapIndexable,
  normalizeSitemapPath,
  sitemapAlternateLinks,
  withSitemapHreflang,
} from './sitemap-hreflang.mjs';

const SITE = 'https://opendream.co.th';
const translations = {
  '/': '/en',
  '/about-us': '/en/about_en',
  '/en/about_en': '/about-us',
};
const serviceLandings = {
  th: [
    { slug: 'chatbot', title: 'Chatbot', altPath: '/en/projects_en/chatbot' },
    { slug: 'e-commerce', title: 'E-commerce' },
  ],
  en: [{ slug: 'mobile-application', title: 'Mobile application', altPath: '/projects/mobileapplication' }],
};

describe('normalizeSitemapPath', () => {
  it('normalizes absolute URLs and removes trailing slashes except root', () => {
    expect(normalizeSitemapPath('https://opendream.co.th/about-us/')).toBe('/about-us');
    expect(normalizeSitemapPath('https://opendream.co.th/')).toBe('/');
    expect(normalizeSitemapPath('/en/about_en/')).toBe('/en/about_en');
  });
});

describe('buildAlternatePathMap', () => {
  it('combines translation pairs and service landing pairs', () => {
    const map = buildAlternatePathMap(translations, serviceLandings);
    expect(map.get('/about-us')).toBe('/en/about_en');
    expect(map.get('/en/about_en')).toBe('/about-us');
    expect(map.get('/projects/chatbot')).toBe('/en/projects_en/chatbot');
    expect(map.get('/en/projects_en/mobile-application')).toBe('/projects/mobileapplication');
    expect(map.has('/projects/e-commerce')).toBe(false);
  });
});

describe('sitemapAlternateLinks', () => {
  it('returns th, en, and x-default links for a real translated pair', () => {
    expect(sitemapAlternateLinks(SITE, '/about-us/', translations, serviceLandings)).toEqual([
      { lang: 'th', url: 'https://opendream.co.th/about-us' },
      { lang: 'en', url: 'https://opendream.co.th/en/about_en' },
      { lang: 'x-default', url: 'https://opendream.co.th/about-us' },
    ]);
  });

  it('returns the same paired links from the English URL', () => {
    expect(sitemapAlternateLinks(SITE, '/en/about_en/', translations, serviceLandings)).toEqual([
      { lang: 'th', url: 'https://opendream.co.th/about-us' },
      { lang: 'en', url: 'https://opendream.co.th/en/about_en' },
      { lang: 'x-default', url: 'https://opendream.co.th/about-us' },
    ]);
  });

  it('omits links for unpaired pages', () => {
    expect(sitemapAlternateLinks(SITE, '/projects/e-commerce', translations, serviceLandings)).toEqual([]);
  });
});

describe('withSitemapHreflang', () => {
  it('normalizes the loc URL and adds alternate links when present', () => {
    const item = withSitemapHreflang(
      { url: 'https://opendream.co.th/en/about_en/' },
      { site: SITE, translations, serviceLandings },
    );
    expect(item.url).toBe('https://opendream.co.th/en/about_en');
    expect(item.links).toHaveLength(3);
  });

  it('leaves unpaired pages without sitemap links', () => {
    const item = withSitemapHreflang({ url: 'https://opendream.co.th/news' }, { site: SITE, translations, serviceLandings });
    expect(item.url).toBe('https://opendream.co.th/news');
    expect(item.links).toBeUndefined();
  });
});

describe('createSitemapSerializer', () => {
  it('drops duplicates created by canonical URL normalization', () => {
    const serialize = createSitemapSerializer({ site: SITE, translations, serviceLandings });
    expect(serialize({ url: 'https://opendream.co.th/about-us/' })?.url).toBe('https://opendream.co.th/about-us');
    expect(serialize({ url: 'https://opendream.co.th/about-us' })).toBeUndefined();
  });
});

describe('isSitemapIndexable', () => {
  it('excludes noindex utility pages', () => {
    expect(isSitemapIndexable('https://opendream.co.th/styleguide/')).toBe(false);
    expect(isSitemapIndexable('/404')).toBe(false);
    expect(isSitemapIndexable('/about-us')).toBe(true);
  });
});
