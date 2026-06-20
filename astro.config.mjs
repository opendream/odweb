import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import { createRequire } from 'node:module';
import { createSitemapSerializer, isSitemapIndexable } from './src/lib/sitemap-hreflang.mjs';
import { resolveSiteOrigin } from './src/lib/site.mjs';
import rehypeMediaWebp from './src/lib/rehype-media-webp.mjs';

const require = createRequire(import.meta.url);
const translations = require('./src/data/translations.json');
const serviceLandings = require('./src/data/service-landings.json');
// Deploy-aware origin: apex on the production branch / local, preview URL on other branches.
const site = resolveSiteOrigin(process.env);
const serializeSitemap = createSitemapSerializer({ site, translations, serviceLandings });

export default defineConfig({
  site,
  // Inline the (single, ~16 KB / ~4 KB gzip) site stylesheet into each page's <head>
  // instead of emitting a render-blocking <link>. Removes the CSS request from the
  // critical path (faster FCP/LCP). The default 'auto' keeps chunks >4 KB external,
  // which left our 4.4 KB bundle render-blocking.
  build: { inlineStylesheets: 'always' },
  // Wrap local /media raster <img> in markdown/MDX bodies with a webp <picture> source.
  markdown: { processor: unified({ rehypePlugins: [rehypeMediaWebp] }) },
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
