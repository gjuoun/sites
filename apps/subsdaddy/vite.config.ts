import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// TanStack Start's vite plugin requires vite >= 8: on vite 7 it degrades to a
// client-only build that dies on a missing index.html. Pin it in package.json.
// Plugin order matters — tanstackStart() must come before the react plugin.
export default defineConfig({
  plugins: [
    tanstackStart({ prerender: { enabled: true, crawlLinks: true } }),
    viteReact(),
    tailwindcss(),
  ],
});
