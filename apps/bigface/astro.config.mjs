import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// One deployment: Cloudflare Pages, served from the root of https://bigface.qqntt.com/
export default defineConfig({
  site: "https://bigface.qqntt.com",
  trailingSlash: "always",
  build: { format: "directory" },
  // The floating dev toolbar overlapped page content in captures and browsing; QA runs on real pages.
  devToolbar: { enabled: false },
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    server: { allowedHosts: ["juns-macbook-pro.tail610df3.ts.net"] },
  },
});
