# @gjuoun/bigface-business-ui

The Bigface **business** theme as its own shadcn-style package: 63 shadcn primitives, the business
wrappers, and one theme with a light and a dark block. Built for a different site than the one that
consumes `@gjuoun/bigface-ui` (the console theme). Three copies are maintained on purpose.

Private for now: nothing is published, and the version is 0.1.0.

## What is in it

| Path | What |
|---|---|
| `src/components/ui/*` | the 63 shadcn primitives, byte-identical to `@gjuoun/bigface-ui` except the import prefix; `bun run biz:drift` proves each still matches the registry |
| `src/components/bg/*` | the business wrappers: `BGButton`, `BGBadge`, `BGCard`, `BGThemeScope` |
| `src/themes/business.css` | the business theme, generated from `src/themes/roles.ts` against the Bigface palettes |
| `src/themes/{_reset,_light}.css`, `src/styles/tokens.css` | the reset of optional roles, the light palette names, the dark palette names |
| `src/styles/theme.css`, `src/styles/styles.css` | the structural mapping and the one stylesheet a consumer imports |

## Use it

Two lines in the consumer's Tailwind entry, plus one import:

```css
@import "tailwindcss" source(none);
@source "../node_modules/@gjuoun/bigface-business-ui/src";
@import "@gjuoun/bigface-business-ui/styles.css";
```

Mark the page's root (or a subtree) with the theme and mode:

```html
<html data-theme="business" data-mode="light">
```

`data-mode` is `light` or `dark`. The business theme is the only theme in this package; `data-theme`
is the same contract as the wiki's shadcn-theme pattern, so a second theme can be added later without
changing a consumer.

## Standing business decisions

These hold in both modes and are asserted by `src/themes/themes.test.ts`:

- controls and cards are **6px** (`--theme-radius: 0.375rem`)
- the primary **fill** is bigface's native blue `#00b0ff`, with dark ink `#252925` on top
- the primary **text and links** are the readable blue `#007aa6` in light mode
- a light plate carries **no shadow** (`--theme-primary-shadow: none`)
- light surfaces are paper (`#f8f8f0`), never pure white

## Maintain it

```sh
bun run --cwd packages/bigface-business-ui test        # contract, decisions, contrast
bun run --cwd packages/bigface-business-ui theme:sync  # regenerate the theme files
bun run --cwd packages/bigface-business-ui theme:check # fail when they are stale
bun run --cwd packages/bigface-business-ui ui:theme    # the five cross-file rules
bun run --cwd packages/bigface-business-ui biz:drift   # the 63 primitives against the shadcn registry (network)
```

Three copies are a decision, not an accident: a shadcn upgrade has to be applied to each package.
`biz:drift` catches registry drift per package; it does not catch the two copies drifting from each other.
