import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// One deployment: Cloudflare Pages, served from the root of the site origin.
// The single source of the origin for canonical URLs, RSS, sitemap and the resume contact line.
export default defineConfig({
  site: "https://jun.qqntt.com",
  trailingSlash: "always",
  build: { format: "directory" },
  // No framework integration: the theme's React components render to static HTML at build time (src/components/ProjectGrid.tsx).
  vite: { plugins: [tailwindcss()] },
});
