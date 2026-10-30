import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The consumer contract, pinned: the theme comes from @gjuoun/bigface-business-ui, the only
// stylesheets are the Tailwind entry and a token-only Starlight bridge, and no app source
// carries a colour of its own, a dark: variant or a retired token.
const srcRoot = join(import.meta.dir, "..");
const stylesDir = join(srcRoot, "styles");
const tailwindPath = join(stylesDir, "tailwind.css");
const bridgePath = join(stylesDir, "starlight.css");

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const tailwind = strip(readFileSync(tailwindPath, "utf8"));
const bridge = strip(readFileSync(bridgePath, "utf8"));

const sourceLines = [...tailwind.matchAll(/@source "([^"]+)"/g)].map((m) => m[1] as string);

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
const allFiles = walk(srcRoot);
const codeFiles = allFiles.filter(
  (file) => /\.(tsx?|astro)$/.test(file) && !/\.test\.tsx?$/.test(file),
);
const rel = (file: string) => file.slice(srcRoot.length + 1);
const read = (file: string) => readFileSync(file, "utf8");

describe("the stylesheets are the package theme plus a token bridge", () => {
  test("tailwind.css is exactly the imports and one @source per component used", () => {
    const top = tailwind
      .split(";")
      .map((statement) => statement.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    expect(top).toEqual([
      '@import "tailwindcss"',
      '@import "@gjuoun/bigface-business-ui/styles.css"',
      '@source "../../../../packages/bigface-business-ui/src/components/ui/accordion.tsx"',
      '@source "../../../../packages/bigface-business-ui/src/components/ui/badge.tsx"',
      '@source "../../../../packages/bigface-business-ui/src/components/ui/button.tsx"',
      '@source "../../../../packages/bigface-highlighter/src/highlighter.tsx"',
    ]);
    expect(tailwind).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl|oklch)\(/);
  });

  test("every @source path resolves from the stylesheet's own directory", () => {
    expect(sourceLines.length).toBeGreaterThan(0);
    for (const line of sourceLines) expect(existsSync(join(stylesDir, line)), line).toBe(true);
  });

  test("the @source list is exactly what the source imports, transitively", () => {
    const uiDir = join(
      import.meta.dir,
      "../../../../packages/bigface-business-ui/src/components/ui",
    );
    const used = new Set<string>();
    for (const file of codeFiles) {
      for (const match of read(file).matchAll(
        /@gjuoun\/bigface-business-ui\/components\/ui\/([\w-]+)/g,
      )) {
        used.add(match[1] as string);
      }
    }
    expect(used.size).toBeGreaterThan(0);

    const closure = new Set<string>();
    const queue = [...used];
    while (queue.length > 0) {
      const name = queue.pop() as string;
      if (closure.has(name)) continue;
      closure.add(name);
      for (const match of read(join(uiDir, name + ".tsx")).matchAll(
        /@gjuoun\/bigface-business-ui\/components\/ui\/([\w-]+)/g,
      )) {
        queue.push(match[1] as string);
      }
    }

    const pinned = sourceLines
      .filter((line) => line.includes("bigface-business-ui"))
      .map((line) => (line.split("/").pop() as string).replace(/\.tsx$/, ""));
    expect(pinned.sort()).toEqual([...closure].sort());

    const usesHighlighter = codeFiles.some((file) =>
      read(file).includes("@gjuoun/bigface-highlighter/"),
    );
    expect(sourceLines.some((line) => line.endsWith("/bigface-highlighter/src/highlighter.tsx"))).toBe(
      usesHighlighter,
    );
  });

  test("the Starlight stylesheet declares custom properties and nothing else", () => {
    expect(readdirSync(stylesDir).sort()).toEqual(["starlight.css", "tailwind.css"]);

    const withoutImport = bridge.replace(/@import\s+'[^']+';/, "").trim();
    expect((withoutImport.match(/\{/g) ?? []).length).toBe(1);
    const open = withoutImport.indexOf("{");
    const close = withoutImport.lastIndexOf("}");
    expect(withoutImport.slice(0, open).replace(/\s+/g, "")).toBe(
      ":root,[data-theme],[data-mode]",
    );

    const declarations = withoutImport
      .slice(open + 1, close)
      .split(";")
      .map((line) => line.trim())
      .filter(Boolean);
    expect(declarations.length).toBeGreaterThan(10);
    for (const declaration of declarations) {
      expect(declaration.startsWith("--"), declaration).toBe(true);
    }
    expect(bridge).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl|oklch)\(/);
  });
});

describe("the app keeps no palette, no retired token and no dark: variant", () => {
  test("no source file carries a colour literal, a theme variable or a dark: variant", () => {
    for (const file of codeFiles) {
      const text = read(file);
      expect(text, rel(file)).not.toMatch(/oklch\(/);
      expect(text, rel(file)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, rel(file)).not.toContain("var(--theme-");
      expect(text, rel(file)).not.toContain("--bf-");
      expect(text, rel(file)).not.toContain("dark:");
    }
  });

  test("there is no local components/ui directory and no reference to one", () => {
    expect(existsSync(join(srcRoot, "components/ui"))).toBe(false);
    expect(existsSync(join(srcRoot, "../components.json"))).toBe(false);
    for (const file of codeFiles) {
      expect(read(file), rel(file)).not.toContain("@/components/ui");
    }
  });
});

describe("both shells carry the theme contract", () => {
  test("the home document pins the theme, the mode and the pre-paint script", () => {
    const base = read(join(srcRoot, "layouts/Base.astro"));
    expect(base).toContain('data-theme="business"');
    expect(base).toContain('data-mode="dark"');
    expect(base).toContain("themeInitScript");
    expect(read(join(srcRoot, "components/Nav.astro"))).toContain("ThemeToggle");
  });

  test("the docs shell pins the theme, the mode and color-scheme before first paint", () => {
    const provider = read(join(srcRoot, "components/starlight/ThemeProvider.astro"));
    expect(provider).toContain("docsThemeInitScript");
    const adapter = read(join(srcRoot, "lib/theme.ts"));
    expect(adapter).toContain("dataset.theme");
    expect(adapter).toContain("dataset.mode");
    expect(adapter).toContain("colorScheme");
    expect(adapter).toContain("MODE_STORAGE_KEY");
    expect(read(join(srcRoot, "components/starlight/Header.astro"))).toContain("ThemeToggle");
  });

  test("the toggle writes the package's mode key and follows data-mode", () => {
    const toggle = read(join(srcRoot, "components/ThemeToggle.astro"));
    expect(toggle).toContain("MODE_STORAGE_KEY");
    expect(toggle).toContain('id="theme-toggle"');
    expect(toggle).toContain("aria-pressed");
    expect(toggle).toContain("style.colorScheme");
  });

  test("the theme and the highlighter are workspace dependencies", () => {
    const pkg = JSON.parse(read(join(srcRoot, "../package.json"))) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.["@gjuoun/bigface-business-ui"]).toStartWith("workspace:");
    expect(pkg.dependencies?.["@gjuoun/bigface-highlighter"]).toStartWith("workspace:");
  });
});
