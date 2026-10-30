# @gjuoun/bigface-tokens

The artifacts the bigface site needs but must not own, synced one-way from
[`gjuoun/bigface-theme`](https://github.com/gjuoun/bigface-theme):

| here | there | why it is needed |
|---|---|---|
| `themes/**` (19 files) | `themes/**` | the download links and the VS Code extension build |
| `src/contrast-math.ts` | `src/contrast-math.ts` | the contrast badges on the palette page |
| `src/installer.ts` | `src/installer.ts` | `public/install.sh`, the one-curl installer |

`palette/palette.json` is **owned here**, not synced: one file, fifteen colours in a `light` and a
`dark` mode, plus the `ansi` and `syntax` maps that name those colours. It carries the values the
[theme preview](https://theme-preview.bigface-theme.pages.dev/palette/) renders, and no JetBrains
provenance — the colour names are the contract, the upstream `OPTION#FIELD` labels are not.

`packages/bigface-tokens/src/palette.ts` is also not a copy: it declares the
`Palette` type only, because the generator's `src/palette.ts` infers that type from a zod schema and
the site needs no zod. It mirrors the zod-inferred shape exactly.

## Rule

Never edit `themes/**`, `src/contrast-math.ts` or `src/installer.ts` here: change them in
`bigface-theme`, regenerate its themes, then sync and bump `SYNCED_FROM`. The generator
(palette → 13 editor themes) lives in `bigface-theme` on purpose.

`palette/palette.json` is the exception. It is edited here, and `tokens-check.sh` will report it as
drifted until `bigface-theme` adopts the same one-file shape.

## Checking

```sh
# from the planning kb, with bigface-theme checked out
bash ~/.notebook/project/gjuoun/sites/plan/scripts/tokens-check.sh ~/code/gjuoun/bigface-theme /path/to/sites
# → TOKENS OK files=22 rev=<bigface-theme short sha>
```

CI runs the same comparison against the revision recorded in `SYNCED_FROM`.
