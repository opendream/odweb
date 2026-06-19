import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import { createRequire } from 'node:module';
import { createSitemapSerializer, isSitemapIndexable } from './src/lib/sitemap-hreflang.mjs';

const require = createRequire(import.meta.url);
const translations = require('./src/data/translations.json');
const serviceLandings = require('./src/data/service-landings.json');
const site = 'https://opendream.co.th';
const serializeSitemap = createSitemapSerializer({ site, translations, serviceLandings });

export default defineConfig({
  site,
  i18n: {
    defaultLocale: 'th',
    locales: ['th', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      filter: isSitemapIndexable,
      serialize: serializeSitemap,
      namespaces: { xhtml: true, news: false, image: false, video: false },
    }),
    mdx(),
  ],
});
