import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// TanStack Start's vite plugin requires vite >= 8: on vite 7 it degrades to a
// client-only build that dies on a missing index.html. Pin it in package.json.
// Plugin order matters — tanstackStart() must come before the react plugin.
// The `@/*` alias must be declared here too: tsconfig `paths` alone makes the
// production build resolve but leaves `vite dev` failing with
// ERR_MODULE_NOT_FOUND on every `@/...` import.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(rootDir, "src") },
  },
  plugins: [
    tanstackStart({ prerender: { enabled: true, crawlLinks: true } }),
    viteReact(),
    tailwindcss(),
  ],
});
