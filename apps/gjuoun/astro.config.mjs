import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Code blocks use Jun's own bigface editor theme (the VS Code export from the bigface-theme repo), copied
// verbatim into src/themes/bigface-code.json so the site builds without reaching outside the app.
const bigfaceCode = JSON.parse(
  readFileSync(new URL("./src/themes/bigface-code.json", import.meta.url), "utf8"),
);

// One deployment: Cloudflare Pages, served from the root of the site origin.
// The single source of the origin for canonical URLs, RSS, sitemap and the resume contact line.
export default defineConfig({
  site: "https://jun.qqntt.com",
  trailingSlash: "always",
  build: { format: "directory" },
  markdown: {
    shikiConfig: { theme: bigfaceCode, wrap: false },
  },
  // No framework integration: the theme's React components render to static HTML at build time (src/components/ProjectGrid.tsx).
  vite: { plugins: [tailwindcss()] },
});
