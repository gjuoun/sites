// Pure WCAG maths. No runtime imports, so the site can use it too.
import type { Palette } from "./palette.ts";

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** WCAG 2.x contrast ratio between two `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export interface ContrastRow {
  group: "text" | "accent" | "syntax" | "ansi";
  name: string;
  hex: string;
  ratio: number;
}

/** Contrast of every foreground token against `bg`. Informational only: never alters the palette. */
export function contrastReport(p: Palette): ContrastRow[] {
  const bg = p.colors.bg.hex;
  const row = (group: ContrastRow["group"], name: string, hex: string): ContrastRow => ({
    group,
    name,
    hex,
    ratio: Math.round(contrastRatio(hex, bg) * 10) / 10,
  });
  const text = ["fg", "fgDim"] as const;
  const accents = [
    "blue",
    "lightBlue",
    "paleBlue",
    "cyan",
    "green",
    "lime",
    "yellow",
    "burntOrange",
    "purple",
  ] as const;
  return [
    ...text.map((n) => row("text", n, p.colors[n].hex)),
    ...accents.map((n) => row("accent", n, p.colors[n].hex)),
    ...(Object.keys(p.ansi) as (keyof Palette["ansi"])[]).map((n) =>
      row("ansi", `ansi.${n}`, p.ansi[n].hex),
    ),
  ];
}
