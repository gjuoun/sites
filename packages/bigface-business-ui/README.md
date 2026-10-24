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
| `src/themes/roles.ts` | the colour role map: each shadcn role names a palette colour |
| `src/themes/business.css` | the business colours: a light block and a dark block, generated from the two palettes |
| `src/themes/_reset.css` | optional roles back to their defaults, per theme scope |
| `src/themes/_foreground.css` | the comparison: in light, with `data-fg="native"`, the twelve foreground roles take the palette's own hues (`FOREGROUND` in roles.ts). Off by default; a demo affordance |
| `src/themes/contract.json` | the colour contract: 19 required roles and the optional ones |
| `src/styles/theme.css` | the colour mapping of shadcn's tokens, and the palette's black and white |
| `src/styles/styles.css` | the one stylesheet a consumer imports |
| `src/hooks/use-theme.ts`, `src/lib/themes.ts` | `useMode`, the mode storage key and the pre-paint script |

There are no BG wrappers in this package. Its components are the stock ones.

## Use it

Three lines in the consumer's Tailwind entry, in this order:

    @import "tailwindcss" source(none);
    @source "../node_modules/@gjuoun/bigface-business-ui/src";
    @import "@gjuoun/bigface-business-ui/styles.css";

Mark the page root with the theme and mode. The default mode is light:

    <html data-theme="business" data-mode="light">

`data-mode` is `light` or `dark`. A page that wants the palette's reset of optional roles keeps the reset line
above the theme, as the styles file does.

## The colour rulings this package holds

These are asserted by `src/themes/themes.test.ts`:

- light surfaces are paper (`#f8f8f0`) and the dark canvas is `#252925`; pure white is never used
- the primary **fill** is bigface's native blue `#00b0ff` in both modes, with the dark ink `#252925` on top (6.08:1)
- the primary **ink** (rings and text) is the readable blue `#007aa6` in light and `#00b0ff` in dark
- the scrim (`bg-black/10`) and the slider thumb (`bg-white`) resolve through the palette's own black and white
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
    bun run --cwd packages/bigface-business-ui theme:sync  # regenerate business.css and _reset.css
    bun run --cwd packages/bigface-business-ui theme:check # fail when they are stale
    bun run --cwd packages/bigface-business-ui ui:theme    # the five cross-file rules
    bun run --cwd packages/bigface-business-ui biz:drift   # the 63 components against the shadcn registry (network)

Three copies are a decision: a shadcn upgrade is applied to each package. `biz:drift` checks each copy against the
registry, not the copies against each other.
