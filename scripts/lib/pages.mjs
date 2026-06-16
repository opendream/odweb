import { parse } from 'node-html-parser';

export function extractBoc(html) {
  const root = parse(html);
  const el = root.querySelector('#et-boc') || root.querySelector('.entry-content');
  return el ? el.outerHTML.trim() : '';
}

const WP_CONTENT_RE = /https?:\/\/[^"')\s]+\/wp-content\/[^"')\s]+/g;
export function collectWpContentUrls(text) {
  return [...new Set(text.match(WP_CONTENT_RE) || [])];
}
