import { parse } from 'node-html-parser';

export function extractBoc(html) {
  const root = parse(html);
  const el = root.querySelector('#et-boc') || root.querySelector('.entry-content');
  return el ? el.outerHTML.trim() : '';
}

// Matches absolute (http://host/wp-content/...) AND root-relative (/wp-content/...) refs.
const WP_CONTENT_RE = /(?:https?:\/\/[^"')\s]+)?\/wp-content\/[^"')\s]+/g;
export function collectWpContentUrls(text) {
  return [...new Set(text.match(WP_CONTENT_RE) || [])];
}

// Divi/lazysizes lazy-loads images: real src is in data-src, the src is a 1x1 placeholder.
// For a static (no-JS) site, promote data-src -> src and drop the lazyload markers so images show.
export function unlazy(html) {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const ds = tag.match(/\sdata-src="([^"]*)"/i);
    if (!ds) return tag;
    let t = /\ssrc="[^"]*"/i.test(tag)
      ? tag.replace(/\ssrc="[^"]*"/i, ` src="${ds[1]}"`)
      : tag.replace(/<img/i, `<img src="${ds[1]}"`);
    t = t.replace(/\sdata-src="[^"]*"/i, '').replace(/\blazyload\b/g, '');
    return t;
  });
}
