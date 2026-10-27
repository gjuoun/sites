# gjuoun — Jun's blog

Static Astro site on the bigface business theme (light by default, dark via the toggle). Pages
project `jun-blog`. Routes: home (portfolio, resume, latest lessons), `/projects/` (titled Portfolio), posts,
a numbered series page, resume, 404, RSS, sitemap.

## Commands

```sh
bun run dev        # local dev server
bun run build      # static output in dist/
bun run preview    # serves dist/ on port 4321
bun run smoke      # rendered-DOM check in Chrome (needs CHROME_PATH or the macOS default)
bun run typecheck  # astro check
bun run lint       # biome check src scripts
bun run test       # bun test src scripts
bun run check:snippets   # every ts block in the posts typechecks against effect 4.0.4
bun run check:links      # internal links and fragments resolve in dist/
bun run check:budget     # HTML, CSS, and inline plus _astro js sizes, zero third-party requests
```

## Add a post

1. Create `src/content/posts/<series-or-folder>/<nn>-<slug>.md`.
2. Frontmatter: `title`, `slug`, `summary` (160 characters at most), `date`, `tags`, and
   `starter`. For a numbered series, also set `series` (the series slug) and `order` (1..n, no gaps).
3. Keep one idea per post, with one `ts` block. `bun run check:snippets` must stay green.

## Add a series

Create `src/content/series/<slug>.md` with `title`, `slug`, `summary`, and `order`. Its posts
point at it with `series: <slug>`.

## Clear the starter flag

Starter copy is marked `starter: true` in each post. Once Jun has rewritten an entry, set its flag to
`false` (or remove the field). A small note in the footer shows while any entry on the page is still
starter. It is never in the content flow, and the resume page never shows it.

The resume (`src/data/resume.ts`) has no flag. Its bullets are tagged `starter` on the page, and a fact
that no source gives is a `[...]` value, rendered as a marked placeholder. Replace each placeholder, then
remove its brackets.

## Notes

- Only `var(--theme-*)` values in `src/styles/site.css`; no hand-picked colours (`src/lib/theme.test.ts` checks this).
- The only client JS is the theme toggle, inline in `ThemeToggle.astro`.
- The site URL in `astro.config.mjs` is the origin used for canonical links and the sitemap.
