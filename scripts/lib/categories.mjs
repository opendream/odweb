// Maps project frontmatter category labels (TH + EN) to the 4 sector slugs used by the
// live /projects filterable-portfolio filter. Type labels (e.g. "Web Application") are not
// sectors and map to nothing. SECTORS is the ordered filter list (all + 4 sectors).
const SECTOR_BY_LABEL = {
  'การศึกษา': 'education',   Education: 'education',
  'ความเป็นอยู่': 'livelihood', Livelihood: 'livelihood',
  'สุขภาพ': 'health',        Health: 'health',
  'อื่น ๆ': 'other',         Other: 'other',
};

export function sectorSlugs(categories = []) {
  const out = [];
  for (const c of categories) {
    const slug = SECTOR_BY_LABEL[c];
    if (slug && !out.includes(slug)) out.push(slug);
  }
  return out;
}

export const SECTORS = [
  { slug: 'all',        th: 'ทั้งหมด',     en: 'All' },
  { slug: 'education',  th: 'การศึกษา',    en: 'Education' },
  { slug: 'livelihood', th: 'ความเป็นอยู่', en: 'Livelihood' },
  { slug: 'health',     th: 'สุขภาพ',      en: 'Health' },
  { slug: 'other',      th: 'อื่น ๆ',      en: 'Other' },
];
