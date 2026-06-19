import { describe, it, expect } from 'vitest';
import {
  DEFAULT_OG_IMAGE,
  absUrl,
  blogPostingLd,
  breadcrumbLd,
  clampDescription,
  creativeWorkLd,
  metaDescription,
  organizationLd,
  organizationRef,
  resolveOgImage,
  stripMarkdown,
  websiteLd,
} from './seo.mjs';

const SITE = 'https://opendream.co.th';

describe('absUrl', () => {
  it('passes through absolute URLs', () => {
    expect(absUrl(SITE, 'https://x.com/opendream')).toBe('https://x.com/opendream');
  });

  it('joins a site-relative path without doubling slashes', () => {
    expect(absUrl(SITE, '/media/a.png')).toBe('https://opendream.co.th/media/a.png');
    expect(absUrl(SITE + '/', '/media/a.png')).toBe('https://opendream.co.th/media/a.png');
    expect(absUrl(SITE, 'media/a.png')).toBe('https://opendream.co.th/media/a.png');
  });
});

describe('resolveOgImage', () => {
  it('prefers explicit image, then cover, then the default', () => {
    expect(resolveOgImage(SITE, { image: '/a.png', cover: '/b.png' })).toBe('https://opendream.co.th/a.png');
    expect(resolveOgImage(SITE, { cover: '/b.png' })).toBe('https://opendream.co.th/b.png');
    expect(resolveOgImage(SITE, {})).toBe('https://opendream.co.th' + DEFAULT_OG_IMAGE);
  });
});

describe('stripMarkdown', () => {
  it('removes images, keeps link text, drops syntax', () => {
    const md = '# Title\n\nSome **bold** and a [link](https://x.com) plus ![alt](/i.png).';
    expect(stripMarkdown(md)).toBe('Title Some bold and a link plus .');
  });
});

describe('clampDescription', () => {
  it('returns short text unchanged', () => {
    expect(clampDescription('hello world', 160)).toBe('hello world');
  });

  it('truncates at a word boundary and adds an ellipsis', () => {
    const out = clampDescription('a'.repeat(50) + ' ' + 'b'.repeat(200), 60);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith('...')).toBe(true);
  });
});

describe('metaDescription', () => {
  it('prefers description, then excerpt, then stripped body', () => {
    expect(metaDescription({ description: 'D', excerpt: 'E', body: 'B' })).toBe('D');
    expect(metaDescription({ excerpt: 'E', body: 'B' })).toBe('E');
    expect(metaDescription({ body: '# B body' })).toBe('B body');
    expect(metaDescription({})).toBeUndefined();
  });

  it('uses a 155 character default limit', () => {
    expect(metaDescription({ body: 'word '.repeat(80) }).length).toBeLessThanOrEqual(155);
  });
});

describe('organizationLd', () => {
  it('builds an Organization with full org facts and absolute logo', () => {
    const ld = organizationLd(SITE);
    expect(ld['@type']).toBe('Organization');
    expect(ld['@id']).toBe('https://opendream.co.th/#organization');
    expect(ld.name).toBe('Opendream Co., Ltd.');
    expect(ld.alternateName).toBe('บริษัท โอเพ่นดรีม จำกัด');
    expect(ld.logo).toBe('https://opendream.co.th/media/od_logo.png');
    expect(ld.sameAs).toContain('https://x.com/opendream');
    expect(ld.address['@type']).toBe('PostalAddress');
    expect(ld.address.addressCountry).toBe('TH');
    expect(ld.geo['@type']).toBe('GeoCoordinates');
    expect(ld.geo.latitude).toBe(13.8097085);
  });
});

describe('organizationRef', () => {
  it('builds a compact self-contained Organization reference', () => {
    const ref = organizationRef(SITE);
    expect(ref['@type']).toBe('Organization');
    expect(ref['@id']).toBe('https://opendream.co.th/#organization');
    expect(ref.name).toBe('Opendream Co., Ltd.');
    expect(ref.logo).toBe('https://opendream.co.th/media/od_logo.png');
  });
});

describe('websiteLd', () => {
  it('references the organization as publisher and sets inLanguage', () => {
    const ld = websiteLd(SITE, 'en');
    expect(ld['@type']).toBe('WebSite');
    expect(ld.inLanguage).toBe('en');
    expect(ld.publisher['@id']).toBe('https://opendream.co.th/#organization');
    expect(ld.potentialAction).toBeUndefined();
  });
});

describe('blogPostingLd', () => {
  it('builds a BlogPosting with absolute image and org author/publisher', () => {
    const ld = blogPostingLd(SITE, {
      path: '/blog/x',
      title: 'X',
      description: 'D',
      image: '/c.png',
      datePublished: '2020-01-01T00:00:00.000Z',
      lang: 'th',
      section: 'News',
    });
    expect(ld['@type']).toBe('BlogPosting');
    expect(ld.headline).toBe('X');
    expect(ld.image).toBe('https://opendream.co.th/c.png');
    expect(ld.datePublished).toBe('2020-01-01T00:00:00.000Z');
    expect(ld.author['@id']).toBe('https://opendream.co.th/#organization');
    expect(ld.publisher.logo).toBe('https://opendream.co.th/media/od_logo.png');
    expect(ld.articleSection).toBe('News');
    expect(ld.inLanguage).toBe('th');
  });

  it('omits image when none provided', () => {
    const ld = blogPostingLd(SITE, { path: '/blog/x', title: 'X', datePublished: 'd', lang: 'th' });
    expect(ld.image).toBeUndefined();
  });
});

describe('creativeWorkLd', () => {
  it('builds a CreativeWork with creator ref and about[] from issues and type', () => {
    const ld = creativeWorkLd(SITE, {
      path: '/project/y',
      title: 'Y',
      image: '/d.png',
      issues: ['health'],
      type: ['Mobile Application'],
      lang: 'en',
    });
    expect(ld['@type']).toBe('CreativeWork');
    expect(ld.creator['@id']).toBe('https://opendream.co.th/#organization');
    expect(ld.about).toEqual(['health', 'Mobile Application']);
    expect(ld.url).toBe('https://opendream.co.th/project/y');
  });
});

describe('breadcrumbLd', () => {
  it('numbers positions from 1 and builds absolute item URLs', () => {
    const ld = breadcrumbLd(SITE, [{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }]);
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement[0].position).toBe(1);
    expect(ld.itemListElement[1].item).toBe('https://opendream.co.th/blog');
  });
});
