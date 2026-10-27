# @gjuoun/bigface-business-ui

The shadcn components, as the CLI ships them, in the Bigface **business** colours. The package carries colour
only: every size, radius, shadow geometry, font and motion value is shadcn's own. A consumer gets the stock
components, and the colours they resolve to come from the Bigface palettes, light and dark.

Private for now: nothing is published, and the version is 0.1.0. It is one of three copies maintained on purpose:
`@gjuoun/bigface-ui` (the console library the site uses) is separate, and so is any future console package.

## What is in it

| Path | What |
|---|---|
| `src/components/ui/*` | the 63 shadcn components, byte-identical to `@gjuoun/bigface-ui` except the import prefix; `bun run biz:drift` proves each still matches the registry |
| `src/themes/roles.ts` | the colour role map: each role names a palette colour, in the palette's own words |
| `src/themes/business.css` | the business colours: ONE block, `light-dark(light, dark)` per neutral, generated |
| `src/themes/accents.ts` | the accent docs table (accent + solved plate), generated data, not theme roles |
| `src/themes/contract.json` | the colour contract: 12 required roles, no optional tier |
| `src/styles/styles.css` | the only stylesheet: palette import, shadcn mapping, formulas, 12 runtime vars, base |
| `src/hooks/use-theme.ts`, `src/lib/themes.ts` | `useMode`, the mode storage key and the pre-paint script |

There are no BG wrappers in this package. Its components are the stock ones.

## Use it

Three lines in the consumer's Tailwind entry, in this order:

    @import "tailwindcss" source(none);
    @source "../node_modules/@gjuoun/bigface-business-ui/src";
    @import "@gjuoun/bigface-business-ui/styles.css";

Mark the page root with the theme and mode. The default mode is light:

    <html data-theme="business" data-mode="light">

`data-mode` is `light` or `dark`, and it is the only switch: the stylesheet turns it into `color-scheme`, and
every mode-dependent colour is a `light-dark()` token. There is no dark block, no optional role and no
`dark:` utility to keep in sync.

## The colour rulings this package holds

These are asserted by `src/themes/themes.test.ts`:

- light surfaces are paper (`#f8f8f0`) and the dark canvas is `#252925`; pure white is never used
- the primary **fill** is bigface's native blue `#00b0ff` in both modes, with the dark ink `#252925` on top (6.08:1)
- the primary **ink** (rings and text) follows the accent blue: `#00b0ff` in both modes (ruling 2026-10-24). It measures 2.27:1 on paper, below AA; a readable light ink is parked for Jun
- the scrim (`bg-scrim/10`) and the slider thumb (`bg-thumb`) are formulas over the two neutral ends of a mode;
there is no black or white token
- shadows keep Tailwind's geometry; only their colour is the palette's
- two browser system colours that a stock component uses (`Canvas`, `CanvasText`) resolve to the business canvas
  and ink, so no colour in the package is outside the palettes

## What was removed when the package went stock

The package was first a themed copy, with feel: a 6px control radius, a spacing unit, a type scale, shadow and
motion tokens, a plate shadow, and BG wrappers. Those were removed so every component renders as the CLI ships it.
The 6px radius ruling is therefore retired: controls are shadcn's default radius (`0.625rem`), and a theme no longer
sets one.

## Maintain it

    bun run --cwd packages/bigface-business-ui test        # colour contract and rulings
    bun run --cwd packages/bigface-business-ui theme:sync  # regenerate business.css and accents.ts
    bun run --cwd packages/bigface-business-ui theme:check # fail when they are stale
    bun run --cwd packages/bigface-business-ui ui:theme    # the five cross-file rules
    bun run --cwd packages/bigface-business-ui biz:drift   # the 63 components against the shadcn registry (network)

Three copies are a decision: a shadcn upgrade is applied to each package. `biz:drift` checks each copy against the
registry, not the copies against each other.

## The accent family and its plates

The theme carries six accents as roles, each the palette's own colour in both modes: blue, light blue (chart-2), pale
blue (chart-3), cyan, green and burnt orange (`--theme-*`). lime, yellow and purple have no CSS variable: they
appear only as accent-docs data in `accents.ts`, each with its solved plate.

A plate is solved, not picked: it is the lightest mix of the accent into the dark ink that still gives the accent 4.5:1
as text (`solvePlate` in `scripts/gen-tokens.ts`, `PLATE_FLOOR`). Two facts follow from the measurements:

- on the paper canvas the accents read at 1.11 to 2.92:1, so as text they are not legible;
- on their own plates each reads at 4.51 to 4.54:1, and the plate is identical in both modes.

Plates are used where an accent is content (the accent chips and the colour section's accent table). The stock components
are not restyled, so a stock badge that uses a tint keeps its own colours.
