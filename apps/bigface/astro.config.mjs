import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// One deployment: Cloudflare Pages, served from the root of https://bigface.qqntt.com/
export default defineConfig({
  site: "https://bigface.qqntt.com",
  trailingSlash: "always",
  build: { format: "directory" },
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
  },
});
