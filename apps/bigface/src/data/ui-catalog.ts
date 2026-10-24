// What the /ui/ page documents. Everything that can be read from source is read from source (variant
// keys, props, the text scale), so the page cannot quietly fall behind the components; the rest — a
// one-line purpose, wrapper vs composite, whether the props are final — is written down here and
// checked against the directory by ui-catalog.test.ts.

/** Keys of one cva variant group, e.g. variantKeys(buttonSource, "size") → ["default", "xs", …]. */
export function variantKeys(source: string, group: string): string[] {
  const lines = source.split("\n");
  const start = lines.findIndex((l) => new RegExp(`^(\\s*)${group}: \\{\\s*$`).test(l));
  if (start === -1) return [];
  const indent = (lines[start]?.match(/^\s*/)?.[0].length ?? 0) + 2;
  const keys: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const lead = line.match(/^\s*/)?.[0].length ?? 0;
    if (lead < indent && line.trim().startsWith("}")) break;
    const m = lead === indent ? /^\s*"?([\w-]+)"?:/.exec(line) : null;
    if (m) keys.push(m[1] as string);
  }
  return keys;
}

/** The props declaration of a BG component, straight from its source. */
export function propsOf(file: string, source: string): string {
  if (file.endsWith(".astro")) {
    const m = /interface Props \{[\s\S]*?\n\}/.exec(source);
    return m ? m[0] : "(no props)";
  }
  const blocks = [
    ...source.matchAll(/export interface \w+ \{[\s\S]*?\n\}/g),
    ...source.matchAll(/export type BG\w*Props =[\s\S]*?;\n/g),
  ].map((m) => m[0].trim());
  const fn = /export function (BG\w+)\(([^)]*)\)/.exec(source);
  const signature = fn ? `${fn[1]}(${(fn[2] as string).trim()})` : "";
  // a component typed inline (no exported *Props type) also shows its signature
  if (signature && !blocks.some((b) => /Props =/.test(b))) blocks.push(signature);
  return blocks.length ? blocks.join("\n\n") : "(no props)";
}

/** Font-size classes used anywhere in the given sources: text-xs…, text-[0.8rem], text-[clamp(…)]. */
export function textScale(sources: string[]): string[] {
  const found = new Set<string>();
  for (const src of sources)
    for (const m of src.matchAll(
      /(?<![\w:-])text-(xs|sm|base|lg|xl|[2-9]xl|\[(?:\d[\d.]*(?:rem|px|em)|clamp\([^\]\s]+\))\])(?![\w/-])/g,
    ))
      found.add(`text-${m[1]}`);
  const size = (c: string) => {
    const named: Record<string, number> = { xs: 0.75, sm: 0.875, base: 1, lg: 1.125, xl: 1.25 };
    const k = c.slice(5);
    if (k in named) return named[k] as number;
    const n = /\[([\d.]+)(rem|em|px)/.exec(k);
    if (n) return Number(n[1]) / (n[2] === "px" ? 16 : 1);
    const c2 = /clamp\(([\d.]+)rem/.exec(k);
    return c2 ? Number(c2[1]) + 100 : 99;
  };
  // Two classes can size to the same rem (text-xs and text-[0.75rem] do). Leaving that tie to
  // scan order made the page's output depend on the directory layout — Vite's glob sorts by
  // absolute path, so packages/ precedes site/ but apps/ precedes packages/. Named scale classes
  // win a tie, then the name itself, so the list is a function of the sources only.
  const named = (c: string): number => (c.includes("[") ? 1 : 0);
  return [...found].sort((a, b) => size(a) - size(b) || named(a) - named(b) || a.localeCompare(b));
}

export type BGKind = "wrapper" | "composite" | "helper";

export interface BGEntry {
  /** File under site/src/components/bg/. */
  file: string;
  /** Exported (or import) name. */
  name: string;
  kind: BGKind;
  /** For wrappers: the shadcn component underneath. */
  wraps?: string;
  purpose: string;
  /** false → the page shows "props not finalised" and why. */
  finalised: boolean;
  why?: string;
  /** Where the live example is: on /ui/ itself, the page chrome, or a page it is specific to. */
  live: "here" | "chrome" | string;
}

export const bgCatalog: BGEntry[] = [
  {
    file: "button.tsx",
    name: "BGButton",
    kind: "wrapper",
    wraps: "Button",
    purpose:
      "Bigface tones (glow, ghost, copy, nav, chip) layered on the shadcn Button; href renders a link.",
    finalised: true,
    live: "here",
  },
  {
    file: "badge.tsx",
    name: "BGBadge",
    kind: "wrapper",
    wraps: "Badge",
    purpose: "Mono uppercase pill, tinted by how far a theme was checked.",
    finalised: true,
    live: "here",
  },
  {
    file: "card.tsx",
    name: "BGCard",
    kind: "wrapper",
    wraps: "Card",
    purpose: "The deep translucent plate with a hairline border; glow adds the blue→lime rim.",
    finalised: true,
    live: "here",
  },
  {
    file: "install-tabs.tsx",
    name: "BGInstallTabs",
    kind: "wrapper",
    wraps: "Tabs",
    purpose:
      "Install / uninstall command switcher: shadcn Tabs in one island, panels force-mounted.",
    finalised: false,
    why: "item shape (bar, command, note) is ad hoc to the install section",
    live: "here",
  },
  {
    file: "theme-scope.tsx",
    name: "BGThemeScope",
    kind: "wrapper",
    purpose:
      "A subtree with its own theme and mode: data-theme + data-mode and the base classes every scope needs.",
    finalised: true,
    live: "here",
  },
  {
    file: "theme-switcher.tsx",
    name: "BGThemeSwitcher",
    kind: "wrapper",
    wraps: "ToggleGroup",
    purpose: "Theme picker over the registry, driven by useTheme; layout is the only prop.",
    finalised: true,
    live: "here",
  },
  {
    file: "mode-switcher.tsx",
    name: "BGModeSwitcher",
    kind: "wrapper",
    wraps: "ToggleGroup",
    purpose: "Light/dark picker over useMode; writes data-mode and the storage key.",
    finalised: true,
    live: "here",
  },
  {
    file: "eyebrow.astro",
    name: "BGEyebrow",
    kind: "composite",
    purpose: "Small mono kicker above a heading, with the blue dot.",
    finalised: true,
    live: "here",
  },
  {
    file: "section-head.astro",
    name: "BGSectionHead",
    kind: "composite",
    purpose: "Numbered section heading: kicker, title, lead.",
    finalised: true,
    live: "here",
  },
  {
    file: "divider.astro",
    name: "BGDivider",
    kind: "composite",
    purpose: "Section break: a hairline fading out at both ends.",
    finalised: true,
    live: "here",
  },
  {
    file: "copy-button.astro",
    name: "BGCopyButton",
    kind: "composite",
    purpose: "The small copy pill wired to the page's copy handler (data-copy).",
    finalised: false,
    why: "aria-label is passed as a raw string prop",
    live: "here",
  },
  {
    file: "command-line.astro",
    name: "BGCommandLine",
    kind: "composite",
    purpose: "Pill-shaped one-line command with a prompt sigil and a copy button.",
    finalised: true,
    live: "here",
  },
  {
    file: "stat.astro",
    name: "BGStat",
    kind: "composite",
    purpose: "Big gradient number over a short label.",
    finalised: true,
    live: "here",
  },
  {
    file: "swatch-chip.astro",
    name: "BGSwatchChip",
    kind: "composite",
    purpose: "One colour of the home strip: grows on hover, copies its hex.",
    finalised: true,
    live: "here",
  },
  {
    file: "swatch.astro",
    name: "BGSwatch",
    kind: "composite",
    purpose: "Palette card: colour plate with its contrast ratio, name and source.",
    finalised: true,
    live: "here",
  },
  {
    file: "marquee.astro",
    name: "BGMarquee",
    kind: "composite",
    purpose: "Endless strip of names, pauses on hover.",
    finalised: true,
    live: "here",
  },
  {
    file: "syntax-preview.astro",
    name: "BGSyntaxPreview",
    kind: "composite",
    purpose: "Fake editor window painted with the syntax roles, optional terminal strip.",
    finalised: true,
    live: "here",
  },
  {
    file: "contrast-table.astro",
    name: "BGContrastTable",
    kind: "composite",
    purpose: "Every palette colour's contrast on the background, with its WCAG band.",
    finalised: true,
    live: "here",
  },
  {
    file: "palette-group.astro",
    name: "BGPaletteGroup",
    kind: "composite",
    purpose: "A palette-page section: heading with a count, then its content.",
    finalised: true,
    live: "here",
  },
  {
    file: "filter-chips.astro",
    name: "BGFilterChips",
    kind: "composite",
    purpose: "App grid filter: chips that hide cards by data-card-kind.",
    finalised: true,
    live: "here",
  },
  {
    file: "app-card.astro",
    name: "BGAppCard",
    kind: "composite",
    purpose: "One app in the home grid, with its check level and the pointer glow.",
    finalised: false,
    why: "takes the raw Target record from data/targets.ts",
    live: "here",
  },
  {
    file: "split.astro",
    name: "BGSplit",
    kind: "composite",
    purpose:
      "Media beside its instructions from 1024px, stacked below; the media stays first in the DOM.",
    finalised: true,
    live: "here",
  },
  {
    file: "breadcrumbs.astro",
    name: "BGBreadcrumbs",
    kind: "composite",
    purpose: "Bigface / Apps / name trail.",
    finalised: true,
    live: "here",
  },
  {
    file: "market-card.astro",
    name: "BGMarketCard",
    kind: "composite",
    purpose: "“Published” strip for targets listed in their app's own gallery.",
    finalised: false,
    why: "label / url / name mirror the Target.market fields one by one",
    live: "here",
  },
  {
    file: "download-card.astro",
    name: "BGDownloadCard",
    kind: "composite",
    purpose: "A download link styled as a small card.",
    finalised: true,
    live: "here",
  },
  {
    file: "manual-steps.astro",
    name: "BGManualSteps",
    kind: "composite",
    purpose: "“Do it by hand” fold with numbered steps.",
    finalised: true,
    live: "here",
  },
  {
    file: "code-card.astro",
    name: "BGCodeCard",
    kind: "composite",
    purpose: "A block of code with its path and a copy button.",
    finalised: true,
    live: "here",
  },
  {
    file: "next-card.astro",
    name: "BGNextCard",
    kind: "composite",
    purpose: "Link card to the next page in a sequence.",
    finalised: true,
    live: "here",
  },
  {
    file: "hero.astro",
    name: "BGHero",
    kind: "composite",
    purpose: "Home hero: pitch, actions, install line and the parallax stage.",
    finalised: false,
    why: "page-specific props (base, repo, ports, command)",
    live: "/",
  },
  {
    file: "app-hero.astro",
    name: "BGAppHero",
    kind: "composite",
    purpose: "App page header: kind, port number, name, tagline, check level.",
    finalised: false,
    why: "takes the raw Target plus a pre-computed label string",
    live: "/apps/pi/",
  },
  {
    file: "site-header.astro",
    name: "BGSiteHeader",
    kind: "composite",
    purpose: "Sticky site header: skip link, brand, main nav.",
    finalised: false,
    why: "base / repo are passed as plain strings on every page",
    live: "chrome",
  },
  {
    file: "site-footer.astro",
    name: "BGSiteFooter",
    kind: "composite",
    purpose: "Site footer: the mark, a one-line pitch, the footer nav.",
    finalised: false,
    why: "base / repo / ports are passed as plain strings",
    live: "chrome",
  },
  {
    file: "toast.astro",
    name: "BGToast",
    kind: "composite",
    purpose: "The copy confirmation (one per page, #toast).",
    finalised: true,
    live: "chrome",
  },
  {
    file: "palette-classes.ts",
    name: "bgTextClass",
    kind: "helper",
    purpose: "Literal text-bf-* class per palette colour, so Tailwind's scanner sees every one.",
    finalised: true,
    live: "here",
  },
];
