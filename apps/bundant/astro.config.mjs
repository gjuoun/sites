import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import rehypeMermaid from 'rehype-mermaid';

// Every site here deploys to the ROOT of its own Cloudflare Pages domain. The /bundant subpath
// existed only for the GitHub Pages project page, which is gone — and a non-root base is not a
// cosmetic difference: it rewrites every /_astro/* reference to /bundant/_astro/*, which 404s on
// bundant.qqntt.com. There is deliberately no env override any more: turbo filters the task
// environment, so a SITE_BASE exported by the workflow never reached this file anyway.

// scripts/sync-docs.mjs writes the sidebar from the docs manifest: Starlight's
// autogenerate skips entries that override `slug`, and every reference page does.
const here = dirname(fileURLToPath(import.meta.url));
const sidebarPath = join(here, 'src/data/sidebar.json');
const docsSidebar = existsSync(sidebarPath) ? JSON.parse(readFileSync(sidebarPath, 'utf8')) : [];

/**
 * Code blocks use the same Shiki pair as the highlighter package (github-light / github-dark);
 * the frame surface and outline come from the theme's roles. The theme switch follows data-mode,
 * not Starlight's data-theme, because data-theme carries the theme id here.
 */
const codeThemes = ['github-light', 'github-dark'];

/** Rewrite relative `*.md` links so they resolve to the generated `/docs/...` pages. */
function rehypeDocLinks() {
  return (tree) => {
    const visit = (node) => {
      if (node.type === 'element' && node.tagName === 'a') {
        const href = node.properties?.href;
        if (typeof href === 'string' && !/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(href)) {
          const [path, hash] = href.split('#');
          if (path.endsWith('.md')) {
            const slug = path.replace(/^\.\//, '').replace(/\.md$/, '');
            node.properties.href = `/docs/${slug}/${hash ? `#${hash}` : ''}`;
          }
        }
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

export default defineConfig({
  site: 'https://bundant.qqntt.com',
  base: '/',
  // The port is part of the theme round's contract; builds and probes never touch the dev
  // server lock, so this only matters when a human opens the site locally.
  server: { port: 4397 },
  trailingSlash: 'ignore',
  integrations: [
    react(),
    starlight({
      title: 'bundant',
      description: 'bundant documentation: a five-chapter tutorial, then the deploy.yml, CLI and operational reference.',
      pagefind: true,
      social: [],
      sidebar: docsSidebar,
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 4 },
      disable404Route: false,
      customCss: ['./src/styles/starlight.css'],
      components: {
        ThemeProvider: './src/components/starlight/ThemeProvider.astro',
        Header: './src/components/starlight/Header.astro',
        Footer: './src/components/starlight/Footer.astro',
        ThemeSelect: './src/components/starlight/ThemeSelect.astro',
        MobileMenuFooter: './src/components/starlight/MobileMenuFooter.astro',
        Head: './src/components/starlight/Head.astro',
      },
      expressiveCode: {
        themes: codeThemes,
        useStarlightDarkModeSwitch: false,
        themeCssSelector: (theme) => `[data-mode="${theme.type}"]`,
        styleOverrides: {
          borderRadius: '0.5rem',
          codeBackground: 'var(--card)',
          codeForeground: 'var(--foreground)',
          borderColor: 'var(--border)',
          codeFontSize: '0.8125rem',
        },
      },
    }),
  ],
  markdown: {
    // Leave the diagram source in the HTML as <pre class="mermaid">; the client
    // renderer (docs pages only) turns it into an SVG. No headless browser at build.
    rehypePlugins: [rehypeDocLinks, [rehypeMermaid, { strategy: 'pre-mermaid' }]],
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  },
});
