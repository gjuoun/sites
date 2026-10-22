# @gjuoun/bigface-tokens

The artifacts the bigface site needs but must not own, synced one-way from
[`gjuoun/bigface-theme`](https://github.com/gjuoun/bigface-theme):

| here | there | why it is needed |
|---|---|---|
| `palette/bigface.json` | `palette/bigface.json` | the palette page renders every colour from it |
| `themes/**` (19 files) | `themes/**` | the download links and the VS Code extension build |
| `src/contrast-math.ts` | `src/contrast-math.ts` | the contrast badges on the palette page |
| `src/installer.ts` | `src/installer.ts` | `public/install.sh`, the one-curl installer |

`packages/bigface-tokens/src/palette.ts` is the one file that is **not** a copy: it declares the
`Palette` type only, because the generator's `src/palette.ts` infers that type from a zod schema and
the site needs no zod. It mirrors the zod-inferred shape exactly.

## Rule

Never edit these files here. Change the palette in `bigface-theme`, regenerate its themes, then sync
and bump `SYNCED_FROM`. The generator (palette → 13 editor themes) lives in `bigface-theme` on
purpose: this repo consumes its output, it does not produce it.

## Checking

```sh
# from the planning kb, with bigface-theme checked out
bash ~/.notebook/project/gjuoun/sites/plan/scripts/tokens-check.sh ~/code/gjuoun/bigface-theme /path/to/sites
# → TOKENS OK files=22 rev=<bigface-theme short sha>
```

CI runs the same comparison against the revision recorded in `SYNCED_FROM`.
