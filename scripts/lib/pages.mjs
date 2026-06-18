import { parse } from 'node-html-parser';

// Matches absolute (http://host/wp-content/...) AND root-relative (/wp-content/...) refs.
const WP_CONTENT_RE = /(?:https?:\/\/[^"')\s]+)?\/wp-content\/[^"')\s]+/g;
export function collectWpContentUrls(text) {
  return [...new Set(text.match(WP_CONTENT_RE) || [])];
}

// Inner HTML of the first article's .entry-content (scoped to <article> so a footer/widget
// .entry-content is never matched). Used to convert plain WordPress pages to markdown.
export function extractEntryContent(html) {
  const root = parse(html);
  const scope = root.querySelector('article') || root;
  const el = scope.querySelector('.entry-content');
  return el ? el.innerHTML.trim() : '';
}

// Divi/lazysizes lazy-loads images: real src is in data-src, the src is a 1x1 placeholder.
// For a static (no-JS) site, promote data-src -> src and drop the lazyload markers so images show.
export function unlazy(html) {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    let t = tag;
    const ds = t.match(/\sdata-src="([^"]*)"/i);
    if (ds) {
      t = /\ssrc="[^"]*"/i.test(t)
        ? t.replace(/\ssrc="[^"]*"/i, ` src="${ds[1]}"`)
        : t.replace(/<img/i, `<img src="${ds[1]}"`);
      t = t.replace(/\sdata-src="[^"]*"/i, '');
    }
    const dss = t.match(/\sdata-srcset="([^"]*)"/i);
    if (dss) {
      t = /\ssrcset="[^"]*"/i.test(t)
        ? t.replace(/\ssrcset="[^"]*"/i, ` srcset="${dss[1]}"`)
        : t.replace(/<img/i, `<img srcset="${dss[1]}"`);
      t = t.replace(/\sdata-srcset="[^"]*"/i, '');
    } else {
      t = t.replace(/\ssrcset="data:[^"]*"/i, ''); // drop placeholder srcset so real src wins
    }
    if (ds || dss) t = t.replace(/\blazyload\b/g, '');
    return t;
  });
}
