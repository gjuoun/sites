import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Every colour on the site is a theme token from @gjuoun/bigface-business-ui. A colour literal, a
// retired palette variable, or a Tailwind default-palette name in a colour utility means someone
// bypassed the theme. The generated font faces (qublack-fonts.css) are the one exempt file: they are
// cutter output and have their own consistency guard.
const srcRoot = import.meta.dir;
const EXEMPT = new Set(["styles/qublack-fonts.css"]);

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });

const files = walk(srcRoot)
  .filter((file) => /\.(astro|tsx?|css)$/.test(file) && !/\.test\.(tsx?|css)$/.test(file))
  .map((file) => ({ path: file, rel: file.slice(srcRoot.length + 1) }))
  .filter((file) => !EXEMPT.has(file.rel));

// Tailwind's own palette: with the theme in charge, none of these names is a colour on the page.
// The one exception is the theme's own yellow role (palette #ffeb3b), which happens to share Tailwind's
// scale name; it is a theme token, so it stays allowed.
const THEME_TOKENS = new Set(["yellow"]);
const DEFAULT_PALETTE = new Set([
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky",
  "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
  "slate", "gray", "zinc", "neutral", "stone", "white", "black",
]);
const COLOUR_UTILITY = /\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|placeholder|marker)-([a-z]+)(?:-\d{2,3})?(?:\/\d+)?\b/g;

describe("no colour literals", () => {
  test("no source file paints with a hex, rgb(), hsl() or oklch() value", () => {
    for (const file of files) {
      const text = readFileSync(file.path, "utf8");
      expect(text, file.rel).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, file.rel).not.toMatch(/\b(rgb|hsl|oklch)\(/);
    }
  });

  test("no source file reads a palette or theme variable directly", () => {
    for (const file of files) {
      const text = readFileSync(file.path, "utf8");
      expect(text, file.rel).not.toContain("--bf-");
      expect(text, file.rel).not.toContain("var(--theme-");
    }
  });
});

describe("colour utilities speak the theme's names", () => {
  test("no colour utility uses a Tailwind default-palette colour", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file.path, "utf8");
      for (const match of text.matchAll(COLOUR_UTILITY)) {
        const name = match[1] as string;
        if (DEFAULT_PALETTE.has(name) && !THEME_TOKENS.has(name)) offenders.push(file.rel + ": " + match[0]);
      }
    }
    expect(offenders).toEqual([]);
  });
});
