import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The consumer contract, pinned: the theme comes from @gjuoun/bigface-business-ui, the only
// stylesheet is the package plus the site's fonts and motions, the document carries data-theme /
// data-mode, and no file carries a colour, a retired token or a mode variant of its own.
const PACKAGE = "@gjuoun/bigface-business-ui";
const srcRoot = import.meta.dir;
const stylesDir = join(srcRoot, "styles");
const css = readFileSync(join(stylesDir, "tailwind.css"), "utf8");

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
const allFiles = walk(srcRoot);
const isTest = (file: string) => /\.test\.(tsx?|css)$/.test(file);
const codeFiles = allFiles.filter((file) => /\.(astro|tsx?|css)$/.test(file) && !isTest(file));
const rel = (file: string) => file.slice(srcRoot.length + 1);
const read = (file: string) => readFileSync(file, "utf8");

/** Top-level statements of a stylesheet: imports, @source lines, at-rules with their nested blocks. */
function topLevelStatements(text: string): string[] {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    if (char === "{") {
      if (depth === 0) {
        out.push(current.trim());
        current = "";
        // skip the whole block
        let inner = 1;
        i += 1;
        while (i < clean.length && inner > 0) {
          if (clean[i] === "{") inner += 1;
          else if (clean[i] === "}") inner -= 1;
          i += 1;
        }
        i -= 1;
        continue;
      }
      depth += 1;
    } else if (char === ";") {
      if (depth === 0) {
        out.push(current.trim());
        current = "";
      }
    } else {
      current += char;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out.map((statement) => statement.replace(/\s+/g, " "));
}

const sourceLines = [...css.matchAll(/@source "([^"]+)"/g)].map((match) => match[1] as string);

describe("the stylesheet is the package theme plus the site's fonts and motions", () => {
  test("its top-level statements are exactly the two imports, the @source lines and the theme block", () => {
    expect(topLevelStatements(css)).toEqual([
      '@import "tailwindcss"',
      '@import "@gjuoun/bigface-business-ui/styles.css"',
      '@source "../../../../packages/bigface-business-ui/src/components/ui/button.tsx"',
      '@source "../../../../packages/bigface-business-ui/src/components/ui/badge.tsx"',
      '@source "../../../../packages/bigface-business-ui/src/components/ui/card.tsx"',
      '@source "../../../../packages/bigface-business-ui/src/components/ui/tabs.tsx"',
      "@theme inline",
    ]);
  });

  test("the styles folder holds tailwind.css and the generated font faces, nothing else", () => {
    expect(readdirSync(stylesDir).sort()).toEqual(["qublack-fonts.css", "tailwind.css"]);
  });

  test("no local layer, utility, variant, colour or shadow lives in the stylesheet", () => {
    expect(css).not.toMatch(/@layer|@utility|@custom-variant/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl|oklch)\(/);
    expect(css).not.toContain("--color-");
  });

  test("the @theme block carries fonts and the two site motions only", () => {
    const theme = /@theme inline \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    const keys = [...theme.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]);
    expect(keys.sort()).toEqual([
      "--animate-drift",
      "--animate-hue",
      "--font-display",
      "--font-mono",
      "--font-sans",
    ]);
    expect(theme).toContain("@keyframes bf-hue");
    expect(theme).toContain("@keyframes bf-drift");
  });
});

describe("every @source is real and matches what the site renders", () => {
  test("each @source path resolves from the stylesheet's own directory", () => {
    expect(sourceLines.length).toBe(4);
    for (const line of sourceLines) expect(existsSync(join(stylesDir, line)), line).toBe(true);
  });

  test("the @source list is exactly the stock components the site imports, transitively", () => {
    const uiDir = join(
      srcRoot,
      "../../../packages/bigface-business-ui/src/components/ui",
    );
    const used = new Set<string>();
    for (const file of codeFiles) {
      for (const match of read(file).matchAll(
        new RegExp(PACKAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/components/ui/([\\w-]+)", "g"),
      ))
        used.add(match[1] as string);
    }
    expect(used.size).toBeGreaterThan(0);
    const closure = new Set<string>();
    const queue = [...used];
    while (queue.length) {
      const name = queue.pop() as string;
      if (closure.has(name)) continue;
      closure.add(name);
      for (const match of read(join(uiDir, name + ".tsx")).matchAll(
        /@gjuoun\/bigface-business-ui\/components\/ui\/([\w-]+)/g,
      ))
        queue.push(match[1] as string);
    }
    const pinned = sourceLines.map((line) => (line.split("/").pop() as string).replace(/\.tsx$/, ""));
    expect(pinned.sort()).toEqual([...closure].sort());
  });
});

describe("the app keeps no stock copy and no theme of its own", () => {
  test("there is no local components/ui directory and no import of one", () => {
    expect(existsSync(join(srcRoot, "components/ui"))).toBe(false);
    for (const file of codeFiles) expect(read(file), rel(file)).not.toContain("@/components/ui");
  });

  test("no source file carries a retired palette variable or reads a theme variable directly", () => {
    for (const file of codeFiles) {
      const text = read(file);
      expect(text, rel(file)).not.toContain("--bf-");
      expect(text, rel(file)).not.toContain("var(--theme-");
    }
  });

  test("no source file carries a mode variant: the theme follows data-mode", () => {
    for (const file of codeFiles) expect(read(file), rel(file)).not.toContain("dark:");
  });

  test("the root document carries the theme, the dark default and the pre-paint script", () => {
    const base = read(join(srcRoot, "layouts/Base.astro"));
    expect(base).toContain(PACKAGE + "/lib/themes");
    expect(base).toContain("data-theme={DEFAULT_THEME}");
    expect(base).toContain('data-mode="dark"');
    expect(base).toContain("themeInitScript");
  });

  test("the theme package is a workspace dependency", () => {
    const pkg = JSON.parse(read(join(srcRoot, "../package.json"))) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.[PACKAGE]).toStartWith("workspace:");
  });
});
