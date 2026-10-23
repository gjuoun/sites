import paletteJson from "@gjuoun/bigface-tokens/palette.json";

export interface Color {
  hex: string;
  source: string;
}
export interface Palette {
  name: string;
  appearance: string;
  colors: Record<string, Color>;
  ansi: Record<string, Color>;
  syntax: Record<string, string>;
}

/** Read at build time, so the site can never drift from the palette. */
export const palette: Palette = paletteJson as Palette;

export const hex = (name: string): string => {
  const c = palette.colors[name];
  if (!c) throw new Error(`unknown colour ${name}`);
  return c.hex;
};
export const syntaxHex = (role: string): string => hex(palette.syntax[role] as string);

/** Where a colour comes from, for display. */
export const sourceLabel = (c: Color): string =>
  c.source.startsWith("alias:")
    ? `→ ${c.source.slice("alias:".length)}`
    : c.source.replace("jetbrains:", "");

/** WCAG relative luminance, used to pick readable ink on top of a swatch. */
const luminance = (hex: string): number => {
  const v = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};

export const contrastRatio = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)];
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * Ink for text sitting on `background`: whichever of the palette's own foreground and background
 * wins on contrast, plus the ratio so the page can print the number instead of guessing.
 */
export const inkOn = (background: string): { ink: string; ratio: number } => {
  const fg = hex("fg");
  const bg = hex("bg");
  const onFg = contrastRatio(fg, background);
  const onBg = contrastRatio(bg, background);
  return onFg >= onBg
    ? { ink: fg, ratio: Math.round(onFg * 10) / 10 }
    : { ink: bg, ratio: Math.round(onBg * 10) / 10 };
};
