# gjuoun — Jun's blog

Static Astro site on the bigface business theme (light by default, dark via the toggle). Pages
project `jun-blog`. Routes: home (portfolio, resume, latest lessons), `/projects/` (titled Portfolio), posts
(each series listed under its title), lessons, resume, 404, RSS, sitemap.

## Layout

```text
src/pages/       routes (.astro): load content, pick a view, wrap it in the document shell
src/layouts/     Base.astro: <html>, <head>, the pre-paint mode script, header and footer
src/views/       one React view per page (HomePage, PostPage, ...), each inside <Page> (<main> with prose)
src/components/  shared React parts: Page, Markdown, Link, ButtonLink, LessonNav, PostList, ProjectGrid, ...
src/lib/         content helpers (posts, collections, seo, content rules)
src/data/        hand-written facts (about, resume)
src/styles/      tailwind.css, the only stylesheet
```

Views and components are React, rendered to static HTML by `@astrojs/react` with no `client:*` directive, so no
React runtime ships; the only client JS is the theme toggle's inline script (`ThemeToggle.tsx`). Post
bodies are Astro's rendered Markdown (`entry.rendered.html`), shown through `Markdown`. The portfolio cards, chips
and buttons are the theme package's stock `Card`, `Badge` and `Button` (`@gjuoun/bigface-shadcn-ui`).

`src/styles/tailwind.css` holds Tailwind, the business theme, the typography plugin, the font, and `@source` for the
three stock components used; every other rule is a Tailwind utility in a component.

## Commands

```sh
bun run dev        # local dev server
bun run build      # static output in dist/
bun run preview    # serves dist/ on port 4321
bun run smoke      # rendered-DOM check in Chrome: nav, card grid, resume facts, focus, phone absence (needs CHROME_PATH or the macOS default)
bun run typecheck  # astro check
bun run lint       # biome check src scripts
bun run test       # bun test src scripts
bun run check:snippets   # every ts block in the posts typechecks against effect 4.0.4
bun run check:links      # internal links and fragments resolve in dist/
bun run check:budget     # HTML, CSS, and inline plus _astro js sizes, zero third-party requests
bun run check:origin     # one origin (astro.config.mjs) in every self-referencing url; no other host but the declared external ones; no "gqntt"
```

## Add a post

1. Create `src/content/posts/<series-or-folder>/<nn>-<slug>.md`.
2. Frontmatter: `title`, `slug`, `summary` (160 characters at most), `date`, `tags`, and
   `starter`. For a numbered series, also set `series` (the series title, as readers see it) and `order`
   (1..n, no gaps).
3. Keep one idea per post, with one `ts` block. `bun run check:snippets` must stay green.

## Add a series

Give its posts the same `series` title and an `order` each. There is no series file: the title in the
posts is the series, `/posts/` lists it under that title, and each lesson's kicker reads it.

## Clear the starter flag

Starter copy is marked `starter: true` in each post. Once Jun has rewritten an entry, set its flag to
`false` (or remove the field). A small note in the footer shows while any entry on the page is still
starter. It is never in the content flow, and the resume page never shows it.

The resume (`src/data/resume.ts`) holds only facts from Jun's resume (`notebook: Private/resume/jun-guo-2025.md`).
The home page and `/resume/` render the same facts (`src/components/ResumeFacts.tsx`), and smoke checks that they match.
The phone number is never in the content and smoke scans the built output for it.

## Notes

- Only `var(--theme-*)` values in `src/styles/site.css`; no hand-picked colours (`src/lib/theme.test.ts` checks this).
- The only client JS is the theme toggle, inline in `ThemeToggle.tsx`. The card grid adds none.
- The site URL in `astro.config.mjs` is the only origin. Canonical links, sitemap, RSS, robots and the resume contact line read it. It is `https://jun-blog.qqntt.com` until the cutover, which flips it to `https://jun.qqntt.com`.
