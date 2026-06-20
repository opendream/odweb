import { describe, expect, it } from 'vitest';
import rehypeMediaWebp from './rehype-media-webp.mjs';

function run(tree) {
  rehypeMediaWebp()(tree);
  return tree;
}

function img(src = '/media/2016/12/corrupt@2x.png') {
  return {
    type: 'element',
    tagName: 'img',
    properties: { src, alt: 'Image' },
    children: [],
  };
}

describe('rehypeMediaWebp', () => {
  it('wraps eligible local raster images in picture', () => {
    const tree = run({
      type: 'root',
      children: [{ type: 'element', tagName: 'p', properties: {}, children: [img()] }],
    });

    const picture = tree.children[0].children[0];
    expect(picture.tagName).toBe('picture');
    expect(picture.children[0].tagName).toBe('source');
    expect(picture.children[0].properties).toEqual({
      srcSet: '/media/2016/12/corrupt@2x.png.webp',
      type: 'image/webp',
    });
    expect(picture.children[1].tagName).toBe('img');
  });

  it('leaves images alone when the webp sibling is missing or not beneficial', () => {
    const tree = run({
      type: 'root',
      children: [
        { type: 'element', tagName: 'p', properties: {}, children: [img('/media/logo_foot.png')] },
        { type: 'element', tagName: 'p', properties: {}, children: [img('https://example.com/x.jpg')] },
      ],
    });

    expect(tree.children[0].children[0].tagName).toBe('img');
    expect(tree.children[1].children[0].tagName).toBe('img');
  });

  it('does not double-wrap images already inside picture', () => {
    const tree = run({
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'picture',
          properties: {},
          children: [img()],
        },
      ],
    });

    expect(tree.children[0].tagName).toBe('picture');
    expect(tree.children[0].children[0].tagName).toBe('img');
  });
});
