import { defineConfig } from "astro/config";

// One deployment: Cloudflare Pages, served from the root of the site origin.
// Origin is jun-blog.qqntt.com until Question 4 cutover (see README).
export default defineConfig({
  site: "https://jun.qqntt.com",
  trailingSlash: "always",
  build: { format: "directory" },
});
