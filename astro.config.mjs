// @ts-check
import { defineConfig } from 'astro/config';

import tailwind from '@astrojs/tailwind';

import sitemap from '@astrojs/sitemap';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), sitemap()],
  output: "server",

  // site: "https://sicklevel.com/",
  // security: {
  //   checkOrigin: import.meta.env.PROD,
  // },

  adapter: node({
    mode: 'standalone'
  })
});