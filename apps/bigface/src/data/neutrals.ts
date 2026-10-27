// The colour roles each mode shows (Jun, 2026-10-26): six neutrals, and the ten accents as their own group. Paper is retired,
// so there is no duplicate or alias row. Each mode sorts its neutrals by its own lightness, lightest first: light reads
// bg, panel, border, highlight, fgDim, fg; dark reads fg, fgDim, highlight, border, panel, bg.
import { luminance } from "@gjuoun/bigface-tokens/contrast-math";
import lightPaletteJson from "@gjuoun/bigface-tokens/palette-light.json";
import { type Palette } from "./palette.ts";

export const NEUTRAL_NAMES = ["bg", "panel", "fg", "fgDim", "border", "highlight"] as const;
export const ACCENT_NAMES = [
  "blue",
  "lightBlue",
  "paleBlue",
  "cyan",
  "green",
  "lime",
  "yellow",
  "brightYellow",
  "burntOrange",
  "purple",
] as const;

export const lightPalette = lightPaletteJson as Palette;

// The business theme's own vocabulary: the five neutrals and seven accents its roles carry. The palette holds
// more (a sixth neutral and three accents — lightBlue, paleBlue and the dim yellow) that no component paints,
// so the colour page documents the theme, not the raw palette.
export const THEME_NEUTRALS = ["bg", "panel", "fg", "fgDim", "border"] as const;

/** A mode's six palette neutrals, lightest first. */
export function neutralsLightToDark(p: { colors: Record<string, { hex: string }> }): string[] {
  const hexOf = (name: string) => (p.colors[name] as { hex: string }).hex;
  return [...NEUTRAL_NAMES].sort((a, b) => luminance(hexOf(b)) - luminance(hexOf(a)));
}

/** The theme's five neutrals, lightest first, in a given palette. */
export function themeNeutralsLightToDark(p: { colors: Record<string, { hex: string }> }): string[] {
  const hexOf = (name: string) => (p.colors[name] as { hex: string }).hex;
  return [...THEME_NEUTRALS].sort((a, b) => luminance(hexOf(b)) - luminance(hexOf(a)));
}
