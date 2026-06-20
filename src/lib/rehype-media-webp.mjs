// Rehype plugin: wrap local /media raster <img> produced by markdown/MDX bodies in a
// <picture> with a webp <source> when the generated WebP is smaller, so body images get the
// same modern-format delivery policy as component-rendered covers (see src/components/Picture.astro).
// No external deps — a small manual HAST walk keeps the production build dependency-free.
import { webpFor } from './img.mjs';

export default function rehypeMediaWebp() {
  return (tree) => walk(tree, null, -1);
}

function walk(node, parent, index) {
  if (
    node.type === 'element' &&
    node.tagName === 'img' &&
    parent &&
    parent.tagName !== 'picture'
  ) {
    const webp = webpFor(node.properties?.src);
    if (webp) {
      parent.children[index] = {
        type: 'element',
        tagName: 'picture',
        properties: {},
        children: [
          { type: 'element', tagName: 'source', properties: { srcSet: webp, type: 'image/webp' }, children: [] },
          node,
        ],
      };
      return; // replaced — don't recurse into the moved <img>
    }
  }
  const children = node.children;
  if (children) {
    for (let i = 0; i < children.length; i++) walk(children[i], node, i);
  }
}
