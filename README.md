# sites

Jun's sites in one place: bun workspaces for the packages, turborepo for the tasks, one
Cloudflare Pages deploy per site.

```
apps/
  bigface/      # bigface.qqntt.com   — the theme specimen site (Astro); also hosts the
                #                        unlisted /ui/business/ component catalogue
  bundant/      # bundant.qqntt.com   — the bundant docs site (Astro + Starlight)
  qublack/      # qublack.qqntt.com   — the QuBlack font specimen (Astro)
  gjuoun/       # jun-blog (Pages project)  — Jun's blog: posts, projects, resume (Astro)
  jun-hermes/   # jun-hermes.qqntt.com — the OAuth verification site (static)
  blackboard/   # blackboard.qqntt.com — the landing page (Astro, en at / and zh at /zh/);
                #                        the review app itself lives in gjuoun/blackboard
packages/
  bigface-shadcn-ui/  # @gjuoun/bigface-shadcn-ui — the 63 stock shadcn components and the
                        #   business theme (colour only, generated from the Bigface palettes)
  bigface-tokens/   # @gjuoun/bigface-tokens — synced copies of bigface's palette, themes,
                    #   contrast math and installer, so this repo builds on its own
```

## Commands

```sh
bun install
bun run build                                  # every app
bunx turbo run build --filter=@sites/bigface... # one app and its workspace deps
bun run check                                  # typecheck + lint + test + build
```

Every app exposes the same three task names — `typecheck`, `lint`, `test` — plus `build`
producing `dist/`, which is what each deploy uploads.

## Where the truth lives

The palette→themes generator stays in [`gjuoun/bigface-theme`](https://github.com/gjuoun/bigface-theme);
`packages/bigface-tokens/` holds **synced copies** of what the bigface site cannot build without
(`SYNCED_FROM` records the source revision). `bun run ../../scripts/tokens-check.sh` in the planning
kb proves the copies are current, and CI runs the same comparison against the pinned revision.

## Deploys

Cloudflare Pages is the only deploy surface. One workflow per site under `.github/workflows/`,
each building with `turbo run build --filter=@sites/<site>...` and deploying with wrangler.
`gjuoun` deploys to the `jun-blog` Pages project, on a preview branch until the production cutover is approved.
