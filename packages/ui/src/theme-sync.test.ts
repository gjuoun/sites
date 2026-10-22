import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import paletteJson from "../../bigface-tokens/palette/bigface.json";
import { renderTokens, tokensPath } from "../scripts/gen-tokens.ts";

// tokens.css is generated, committed output — the same rule this repo already applies to themes/:
// the committed file must equal a fresh render, and CI runs theme:sync then git diff --exit-code.
const palette = paletteJson as {
  colors: Record<string, { hex: string }>;
  ansi: Record<string, { hex: string }>;
};

test("committed tokens.css equals a fresh render (run `bun run theme:sync` after editing the palette)", () => {
  expect(readFileSync(tokensPath, "utf8")).toBe(renderTokens(palette));
});

test("control: the render is driven by the palette, not hand-written", () => {
  const changed = {
    ...palette,
    colors: { ...palette.colors, bg: { hex: "#010203" } },
  };
  expect(renderTokens(changed)).toContain("--bf-bg: #010203;");
  expect(renderTokens(changed)).not.toBe(renderTokens(palette));
});

test("every palette colour and ANSI slot becomes a variable, and the ink follows the background", () => {
  const css = renderTokens(palette);
  for (const name of Object.keys(palette.colors)) {
    const kebab = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    expect(css, name).toContain(`--bf-${kebab}: `);
  }
  for (const name of Object.keys(palette.ansi)) {
    const kebab = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    expect(css, name).toContain(`--bf-ansi-${kebab}: `);
  }
  expect(css).toContain("--ink-on-bright: var(--bf-bg);");
});
