import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The consumer contract, pinned: the theme comes from @gjuoun/bigface-business-ui, the only
// stylesheet is imports + one @source per stock component the app renders + the site font, and no
// app source carries a colour of its own, a dark: variant or a retired token.
const srcRoot = join(import.meta.dir, "..");
const cssPath = join(srcRoot, "styles.css");
const css = readFileSync(cssPath, "utf8");
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

const sourceLines = [...css.matchAll(/@source "([^"]+)"/g)].map((m) => m[1] as string);

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const p = join(dir, entry.name);
    return entry.isDirectory() ? walk(p) : [p];
  });
const allFiles = walk(srcRoot);
const codeFiles = allFiles.filter(
  (f) => /\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f),
);
const rel = (f: string) => f.slice(srcRoot.length + 1);
const read = (f: string) => readFileSync(f, "utf8");

describe("the stylesheet is the package theme plus the site font", () => {
  test("its top-level statements are exactly the imports, the @source lines and the font key", () => {
    const top = cssNoComments
      .replace(/\{[^{}]*\}/g, "{}")
      .split(/;|\{\}/)
      .map((s) => s.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    expect(top).toEqual([
      '@import "tailwindcss"',
      '@import "@gjuoun/bigface-business-ui/styles.css"',
      '@import "@fontsource-variable/geist"',
      '@source "../../../packages/bigface-business-ui/src/components/ui/badge.tsx"',
      '@source "../../../packages/bigface-business-ui/src/components/ui/card.tsx"',
      '@source "../../../packages/bigface-business-ui/src/components/ui/table.tsx"',
      '@source "../../../packages/bigface-business-ui/src/components/ui/toggle.tsx"',
      '@source "../../../packages/bigface-business-ui/src/components/ui/toggle-group.tsx"',
      "@theme inline",
    ]);
  });

  test("every @source path resolves from the stylesheet's own directory", () => {
    expect(sourceLines.length).toBeGreaterThan(0);
    for (const line of sourceLines)
      expect(existsSync(join(srcRoot, line)), line).toBe(true);
  });

  test("the @source list is exactly the stock components the app renders, transitively", () => {
    const uiDir = join(
      import.meta.dir,
      "../../../../packages/bigface-business-ui/src/components/ui",
    );
    const used = new Set<string>();
    for (const file of allFiles.filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))) {
      for (const m of read(file).matchAll(
        /@gjuoun\/bigface-business-ui\/components\/ui\/([\w-]+)/g,
      ))
        used.add(m[1] as string);
    }
    expect(used.size).toBeGreaterThan(0);
    const closure = new Set<string>();
    const queue = [...used];
    while (queue.length) {
      const name = queue.pop() as string;
      if (closure.has(name)) continue;
      closure.add(name);
      for (const m of read(join(uiDir, name + ".tsx")).matchAll(
        /@gjuoun\/bigface-business-ui\/components\/ui\/([\w-]+)/g,
      ))
        queue.push(m[1] as string);
    }
    const pinned = sourceLines.map((l) => (l.split("/").pop() as string).replace(/\.tsx$/, ""));
    expect(pinned.sort()).toEqual([...closure].sort());
  });
});

describe("the app keeps no stock copy and no palette of its own", () => {
  test("there is no local components/ui directory and no import of one", () => {
    expect(existsSync(join(srcRoot, "components/ui"))).toBe(false);
    for (const file of codeFiles)
      expect(read(file), rel(file)).not.toContain("@/components/ui");
  });

  test("no source file carries a colour literal or a theme token directly", () => {
    for (const file of codeFiles) {
      const text = read(file);
      expect(text, rel(file)).not.toMatch(/oklch\(/);
      expect(text, rel(file)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, rel(file)).not.toContain("var(--theme-");
    }
  });

  test("no source file carries a dark: variant: the theme follows data-mode", () => {
    for (const file of codeFiles) expect(read(file), rel(file)).not.toContain("dark:");
  });

  test("the root document carries the theme, the mode and the pre-paint script", () => {
    const root = read(join(srcRoot, "routes/__root.tsx"));
    expect(root).toContain("@gjuoun/bigface-business-ui/lib/themes");
    expect(root).toContain("data-theme={DEFAULT_THEME}");
    expect(root).toContain("data-mode={DEFAULT_MODE}");
    expect(root).toContain("themeInitScript");
    expect(root).toContain("suppressHydrationWarning");
  });

  test("the theme package is a workspace dependency", () => {
    const pkg = JSON.parse(read(join(srcRoot, "../package.json"))) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.["@gjuoun/bigface-business-ui"]).toStartWith("workspace:");
  });
});
