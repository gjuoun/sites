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
    // The business catalogue (/ui/business/) is a React island that imports these two only when it loads. Vite
    // would otherwise pre-bundle them mid-session: the browser keeps the old hash and the island stops hydrating
    // (504 Outdated Optimize Dep), so the page's toggles do nothing. Pre-bundling them at startup avoids that.
    optimizeDeps: { include: ["recharts", "sonner"] },
    server: { allowedHosts: ["juns-macbook-pro.tail610df3.ts.net"] },
  },
});
