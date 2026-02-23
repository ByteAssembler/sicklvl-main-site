// @ts-check
import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

import sitemap from "@astrojs/sitemap";

import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
    integrations: [tailwind(), sitemap()],
    output: "server",

    site: "https://sicklevel.com",
    security: {
        // checkOrigin ist deaktiviert, da die App hinter einem Reverse Proxy (Coolify/Traefik)
        // läuft. Der Container sieht intern http://172.18.x.x, der Browser sendet aber
        // Origin: https://sicklevel.com → Astro würde das als Cross-Site werten → 403.
        checkOrigin: false,
    },

    adapter: node({
        mode: "standalone",
    }),
});
