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
        // allowedDomains teilt Astro mit, welchen X-Forwarded-Host/Proto-Headern
        // von Coolify/Traefik vertraut werden darf. Ohne diese Einstellung ignoriert
        // Astro v5 die Forwarded-Header und baut die URL intern als http://localhost:3000
        // → Origin-Mismatch mit dem Browser-Origin https://sicklevel.com → 403.
        allowedDomains: [
            { hostname: "sicklevel.com", protocol: "https" },
            // { hostname: "localhost", protocol: "http" },
            // { hostname: "127.0.0.1", protocol: "http" },
            // { hostname: "0.0.0.0", protocol: "http" },
        ],
        checkOrigin: true,
    },

    adapter: node({
        mode: "standalone",
    }),
});
