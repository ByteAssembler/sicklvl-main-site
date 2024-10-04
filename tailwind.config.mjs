const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
    theme: {
        fontFamily: {
            inconsolata: ["Inconsolata", ...defaultTheme.fontFamily.mono],
            august: ["August", ...defaultTheme.fontFamily.serif],
        },
        screens: {
            "2XL": { max: "1535px" },
            XL: { max: "1279px" },
            LG: { max: "1023px" },
            MD: { max: "767px" },
            SM: { max: "639px" },
            ...defaultTheme.screens,
        },
        extend: {},
    },
    plugins: [],
};
