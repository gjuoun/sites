import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Static build, served by the web-tool service at http://127.0.0.1:5010/ui/.
// `base` makes every asset URL absolute under /ui so one Bun client can serve both.
export default defineConfig({
	site: "http://127.0.0.1:5010",
	base: "/ui",
	trailingSlash: "always",
	build: { format: "directory" },
	devToolbar: { enabled: false },
	integrations: [react()],
	vite: { plugins: [tailwindcss()] },
});
