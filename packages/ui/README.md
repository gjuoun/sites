# @gjuoun/bigface-ui

Bigface's component library as one installable package: the 63 shadcn primitives, the Bigface
wrappers (`BGButton`, `BGBadge`, `BGCard`, `BGInstallTabs`), the two registry hooks, `cn`, and the
palette-driven theme. Source distribution — your own Tailwind compiles the classes, so there is no
build step and no prebuilt CSS to fight with.

Dark by design: the palette is a dark theme, and the components' `dark:` variants are the ones meant
for it (`<html class="dark">`).

## Install

```sh
bun add @gjuoun/bigface-ui
```

Required peers (install these yourself):

```sh
bun add react react-dom tailwindcss
```

Optional peers — only the ones whose components you actually import:

| Component(s) | Peer |
|---|---|
| most primitives (Button, Badge, Card, Tabs, Dialog, …) | `radix-ui`, `class-variance-authority`, `lucide-react` |
| Command, Combobox | `cmdk` |
| Drawer | `vaul` |
| Carousel | `embla-carousel-react` |
| Input OTP | `input-otp` |
| Calendar | `react-day-picker` |
| Resizable | `react-resizable-panels` |
| Chart | `recharts` |
| Code Block | `shiki` |
| Sonner (toaster) | `sonner`, `next-themes` |
| Message Scroller, Questionnaire | `@shadcn/react` |
| Trace, Field, Bubble, … | `@base-ui/react` |

## Wire it into Tailwind v4

Your stylesheet (Tailwind v4, CSS-first):

```css
@import "tailwindcss" source("./src");
/* Tailwind cannot see a dependency's sources — point it at the package. */
@source "../node_modules/@gjuoun/bigface-ui/src";
/* Bigface as-is: structural theme + the default palette values. */
@import "@gjuoun/bigface-ui/styles.css";
```

For Next.js also add `transpilePackages: ["@gjuoun/bigface-ui"]` to `next.config.ts`; Vite/Astro
resolve the linked or installed package directly.

## Use your own palette

Swap the values, keep the components. Import the structural theme only and set `--bf-*` yourself:

```css
@import "@gjuoun/bigface-ui/theme.css"; /* token names + mapping, no colour values */

:root {
  --bf-bg: #101418;
  --bf-fg: #e8e8e2;
  --bf-blue: #ff5c5c;
  /* …every colour the components name, see tokens.css for the full list */
  --ink-on-bright: var(--bf-bg);
}
```

`tokens.css` ([the shipped default](src/styles/tokens.css)) is the list: the palette's 20 colours,
the 16 ANSI aliases, and `--ink-on-bright` (the ink used on bright plates). The shadcn semantic
tokens (`--background`, `--primary`, …) are derived from `--bf-*` in `theme.css`, so nothing else
needs touching.

## Imports

```tsx
import { Button } from "@gjuoun/bigface-ui/components/ui/button";
import { Card, CardHeader, CardTitle } from "@gjuoun/bigface-ui/components/ui/card";
import { BGButton } from "@gjuoun/bigface-ui/components/bg/button";
import { useIsMobile } from "@gjuoun/bigface-ui/hooks/use-mobile";
import { cn } from "@gjuoun/bigface-ui/lib/utils";
```

| Specifier | Contents |
|---|---|
| `…/components/ui/<name>` | the 63 shadcn primitives |
| `…/components/bg/<name>` | Bigface wrappers: `button`, `badge`, `card`, `install-tabs` |
| `…/hooks/<name>` | `use-mobile`, `use-highlighted-code`, `use-theme` |
| `…/lib/utils`, `…/lib/highlighter`, `…/lib/themes` | `cn`, the shiki loader, the theme registry + pre-paint script |
| `…/themes/<id>.css` | the three themes, a light and a dark block each (generated) |
| `…/themes/_reset.css` | optional roles back to `initial` inside a theme scope (generated) |
| `…/theme.css` | structural theme: token mapping, `@theme inline`, `font-code` |
| `…/tokens.css` | generated Bigface default values |
| `…/styles.css` | all of the above |

Site-specific page composites (the `.astro` components, `BGAppCard`, `BGHero`, …) are not shipped:
they take page data, not design props.

## Theming

One component set, three themes, two modes. A theme is data: `src/themes/roles.ts` maps a role
(`primary`, `frame`, `surface`, the `gray-100…700` ramp, …) to a **palette colour name**, and
`scripts/gen-tokens.ts` renders both modes of it — the light block against `bigface-light.json`, the
dark block against `bigface.json`. Components name roles (`bg-primary`, `text-heading`,
`bg-success-tint`), never a hue or a hex, so no component is forked per theme.

| Theme | For | `primary` |
|---|---|---|
| `business` | light, simple and elegant: landing pages, product surfaces | blue |
| `console` (default) | minimalist dark workspace for dev tools — the library's original look | blue |
| `game` | reward-forward: game communities, leaderboards | green |

`src/themes/contract.json` is the surface: 22 required keys and the optional ones, each with the
default the mapping falls back to (`color-mix` off a required role). `bun run --cwd packages/ui ui:theme`
checks the five rules — only known keys, both blocks complete, `_reset.css` exactly the optional keys,
and the registry matching `src/themes/<id>.css` one to one. Regenerate with `theme:sync`, verify with
`theme:check` (CI runs it).

### Switching at runtime

Theme and mode are two attributes on `<html>` — `data-theme` and `data-mode`. CSS does the work:

```tsx
import { themeInitScript } from "@gjuoun/bigface-ui/lib/themes"; // inlines before first paint
import { useTheme, useMode } from "@gjuoun/bigface-ui/hooks/use-theme";
import { BGThemeScope } from "@gjuoun/bigface-ui/components/bg/theme-scope";
```

`useTheme()` / `useMode()` read the attributes with `useSyncExternalStore` over a `MutationObserver`,
so every consumer updates whoever changed them (a switcher, the init script, devtools, another tab).
`<BGThemeScope theme="game" mode="light">` gives a subtree its own pair; the mapping is re-declared on
every `[data-theme]`, so a nested scope resolves against its own theme rather than inheriting the outer
one's resolved colours.

### Adding a theme

1. Delete nothing, fork nothing: add an entry to `THEMES` in `src/themes/roles.ts` — a `shared(...)`
   call with that theme's primary/success/danger/info/highlight/charts, radius and muted ink.
2. `bun run --cwd packages/ui theme:sync` writes `src/themes/<id>.css`.
3. `bun run --cwd packages/ui ui:theme` must print `theme-check: ok`; `test` proves contrast.
   The switcher, the init script and `ThemeId` all derive from the registry, so nothing else changes.

## Upgrading components

`components/ui/*` is exactly what the shadcn CLI writes. In this repo an upgrade is
`bunx --bun shadcn add <name> --overwrite`, and `bun run ui:drift` proves every file still matches
the registry. Do not edit those files here — put Bigface variants in `components/bg/` instead.

## License

MIT
