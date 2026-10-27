import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// One deployment: Cloudflare Pages, served from the root of the site origin.
// The single source of the origin: flips to https://jun.qqntt.com at cutover (see README).
export default defineConfig({
  site: "https://jun-blog.qqntt.com",
  trailingSlash: "always",
  build: { format: "directory" },
  // No framework integration: the theme's React components render to static HTML at build time (src/components/ProjectGrid.tsx).
  vite: { plugins: [tailwindcss()] },
});
