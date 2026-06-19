const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201c',
  rdquo: '\u201d',
};

function decodeCodePoint(match, raw, radix) {
  const codePoint = Number.parseInt(raw, radix);
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return match;
  }
  return String.fromCodePoint(codePoint);
}

export function decodeEntities(value = '') {
  let out = String(value);
  let previous;

  do {
    previous = out;
    out = out
      .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => decodeCodePoint(match, hex, 16))
      .replace(/&#(\d+);/g, (match, decimal) => decodeCodePoint(match, decimal, 10))
      .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (match, name) => (name in NAMED_ENTITIES ? NAMED_ENTITIES[name] : match));
  } while (out !== previous);

  return out;
}
