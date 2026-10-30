import paletteJson from "@gjuoun/bigface-tokens/palette.json";

// The site reads one palette file: fifteen colours in a `light` and a `dark` mode, plus the `ansi` and
// `syntax` maps that name those colours. `paletteFor` turns one mode into the shape the pages were written
// against — `{ colors, ansi, syntax }` with a `source` label per colour — so a page never sees a raw hex.
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

/** One mode of palette/palette.json. */
interface ModeData {
  colors: Record<string, string>;
  ansi: Record<string, string>;
}
interface PaletteFile {
  name: string;
  modes: Record<"light" | "dark", ModeData>;
  syntax: Record<string, string>;
}

const file = paletteJson as PaletteFile;

/** The two modes, in file order. */
export const PALETTE_MODES = Object.keys(file.modes) as ("light" | "dark")[];

/** One mode as the palette object the pages render: every colour, and its ANSI slots resolved. */
export const paletteFor = (mode: "light" | "dark"): Palette => {
  const m = file.modes[mode];
  const colors = Object.fromEntries(
    Object.entries(m.colors).map(([name, hex]) => [name, { hex: hex.toLowerCase(), source: "bigface" }]),
  );
  const ansi = Object.fromEntries(
    Object.entries(m.ansi).map(([slot, name]) => {
      const hex = m.colors[name];
      if (!hex) throw new Error(`palette: ${mode} ${slot} aliases an unknown colour, ${name}`);
      return [slot, { hex: hex.toLowerCase(), source: "alias:" + name }];
    }),
  );
  return {
    name: mode === "light" ? file.name + " Light" : file.name,
    appearance: mode,
    colors,
    ansi,
    syntax: file.syntax,
  };
};

/** The dark mode: the site's own default surface, and the palette the page leads with. */
export const palette: Palette = paletteFor("dark");
/** The light mode. */
export const lightPalette: Palette = paletteFor("light");

export const hex = (name: string): string => {
  const c = palette.colors[name];
  if (!c) throw new Error(`unknown colour ${name}`);
  return c.hex;
};
export const syntaxHex = (role: string): string => hex(palette.syntax[role] as string);

/** Where a colour comes from, for display: an alias target, and nothing for a palette colour. */
export const sourceLabel = (c: Color): string =>
  c.source.startsWith("alias:") ? `→ ${c.source.slice("alias:".length)}` : "";

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
