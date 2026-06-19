import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: 'https://opendream.co.th',

  i18n: {
    defaultLocale: 'th',
    locales: ['th', 'en'],
    routing: { prefixDefaultLocale: false },
  },

  integrations: [sitemap(), mdx()],
  adapter: cloudflare()
});