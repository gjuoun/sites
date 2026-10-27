import { expect, test } from "bun:test";
import { ACCENT_NAMES, lightPalette, NEUTRAL_NAMES, neutralsLightToDark } from "./neutrals.ts";
import { palette } from "./palette.ts";

test("each palette has exactly the six neutrals and the ten accents: no paper, no alias row", () => {
  const expected = [...NEUTRAL_NAMES, ...ACCENT_NAMES].sort();
  expect(Object.keys(palette.colors).sort()).toEqual(expected);
  expect(Object.keys(lightPalette.colors).sort()).toEqual(expected);
  expect(Object.keys(palette.colors)).not.toContain("paper");
});

test("light lists its neutrals lightest first: bg, panel, border, highlight, fgDim, fg", () => {
  expect(neutralsLightToDark(lightPalette)).toEqual(["bg", "panel", "border", "highlight", "fgDim", "fg"]);
});

test("dark lists its neutrals lightest first: fg, fgDim, highlight, border, panel, bg", () => {
  expect(neutralsLightToDark(palette)).toEqual(["fg", "fgDim", "highlight", "border", "panel", "bg"]);
});
