# @gjuoun/bigface-business-ui

The shadcn components, as the CLI ships them, in the Bigface **business** colours. The package is a Tailwind/shadcn
theme and nothing else: every size, radius, shadow, font and motion value is shadcn's own, and the colours come from
the Bigface palettes, light and dark. Syntax highlighting lives in `@gjuoun/bigface-highlighter`.

Private for now: nothing is published, and the version is 0.1.0.

## What is in it

| Path | What |
|---|---|
| `src/components/ui/*` | the 63 shadcn components, byte for byte what `shadcn add` writes, so `shadcn add <name> --overwrite` upgrades them in place |
| `src/themes/roles.ts` | the colour role map: each role names a palette colour, in the palette's own words |
| `src/themes/business.css` | the business colours, generated: a light block (`:root, [data-mode="light"]`) and a dark block (`[data-mode="dark"]`) |
| `src/styles/styles.css` | the only stylesheet: shadcn's default theme with the palette in place of its neutrals |
| `src/hooks/use-theme.ts`, `src/lib/themes.ts` | `useMode`, the mode storage key and the pre-paint script |
| `src/hooks/use-mobile.ts`, `src/lib/utils.ts` | shadcn's own helpers for the components |

## How the stylesheet is layered

`styles.css` is shadcn's "Default Theme CSS" (https://ui.shadcn.com/docs/theming), with two substitutions: the palette
in place of shadcn's neutral values, and `data-mode` in place of the `.dark` class (so it works with `data-theme`).

1. **palette**: `themes/business.css` (generated) sets the 12 `--theme-*` colours, light block then dark block.
2. **imports**: `shadcn/tailwind.css`, shadcn's own variants and utilities.
3. **dark variant**: `@custom-variant dark (&:where([data-mode="dark"], [data-mode="dark"] *));`, so the stock `dark:` classes follow `data-mode`.
4. **keys**: `@theme inline` maps exactly shadcn's colour tokens (`--color-x: var(--x)`) and its radius scale.
5. **roles**: the `:root, [data-theme], [data-mode]` block declares every shadcn role once, each reading one palette colour, plus `--radius`. It sits on every scope element, so a light panel inside a dark page resolves light.
6. **base**: shadcn's two rules (`border-border outline-ring/50`, `bg-background text-foreground`).

Nothing else: no alias, no formula colour, no shadow, font or `color-scheme` override. `src/themes/shadcn-theme.test.ts`
holds the file to that shape.

A `dark:` class inside a light panel that sits inside a dark page still applies: the variant matches any dark
ancestor. Roles (colours) do follow the nearest scope.

## Use it

In the consumer's Tailwind entry: Tailwind, then the theme, then an `@source` for each component the app renders
(Tailwind does not scan `node_modules`):

    @import "tailwindcss";
    @import "@gjuoun/bigface-business-ui/styles.css";
    @source "../node_modules/@gjuoun/bigface-business-ui/src/components/ui/button.tsx";

Mark the page root with the mode. The default mode is light:

    <html data-theme="business" data-mode="light">

## The colour rulings this package holds

Asserted by `src/themes/themes.test.ts`:

- light surfaces are paper (`#f8f8f0`) and the dark canvas is `#252925`; pure white is never used
- the primary fill is bigface's native blue `#00b0ff` in both modes, and the ink on it is the canvas colour in both modes (ruling 2026-10-27)
- overlays, shadows and the slider thumb are shadcn's own (`bg-black/10`, Tailwind shadows, `bg-white`): the theme does not restyle them

## Maintain it

    bun run --cwd packages/bigface-business-ui test         # theme shape, generated file, rulings, declared imports
    bun run --cwd packages/bigface-business-ui theme:sync   # regenerate business.css from the palettes
    bun run --cwd packages/bigface-business-ui theme:check  # fail when business.css is stale
    bun run --cwd packages/bigface-business-ui ui:drift     # the 63 components against `shadcn add`, byte for byte (network, a few minutes)

`ui:drift` runs `shadcn add` against this package's own `components.json` and `styles.css`, so its output is what an
upgrade would write here (the CLI drops `font-heading`, for one, because the theme declares no heading font).
