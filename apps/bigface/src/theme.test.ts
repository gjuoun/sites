import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The consumer contract, pinned: the theme comes from @gjuoun/bigface-business-ui, the site's whole
// stylesheet is the package plus its fonts, motions and the one font-capability utility, the document
// carries data-theme/data-mode dark, and no file carries a palette variable, a retired package name or
// a mode variant of its own.
const PACKAGE = "@gjuoun/bigface-business-ui";
const OLD = "@gjuoun/bigface-ui";
const srcRoot = import.meta.dir;
const siteDir = join(srcRoot, "..");
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

describe("the stylesheet is the package theme plus the site's fonts, motions and font-code", () => {
  test("its top-level statements are the three imports, the @source lines and the theme block", () => {
    expect(topLevelStatements(css)).toEqual([
      '@import "tailwindcss" source("../")',
      '@import "./reset-palette.css"',
      '@import "@gjuoun/bigface-business-ui/styles.css"',
      ...sourceLines.map((line) => '@source "' + line + '"'),
      "@theme inline",
      "@utility font-code",
    ]);
  });

  test("the palette reset stays in front of the package theme, or its colour keys are cleared", () => {
    const statements = topLevelStatements(css);
    expect(statements.indexOf('@import "./reset-palette.css"')).toBeLessThan(
      statements.indexOf('@import "@gjuoun/bigface-business-ui/styles.css"'),
    );
  });

  test("no second layer, variant or colour lives in the stylesheet", () => {
    expect(css).not.toMatch(/@layer/);
    expect(css).not.toMatch(/@custom-variant/);
    expect([...css.matchAll(/@utility\s+(\S+)/g)].map((m) => m[1])).toEqual(["font-code"]);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl|oklch)\(/);
    expect(css).not.toContain("--color-");
    expect(css).not.toContain("--bf-");
  });

  test("the @theme block carries fonts, the site's motion and nothing else", () => {
    const theme = /@theme inline \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    const keys = [...theme.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]);
    expect(keys.sort()).toEqual([
      "--animate-blink",
      "--animate-hue",
      "--animate-marquee",
      "--animate-ring",
      "--ease-bf",
      "--font-display",
      "--font-mono",
      "--font-sans",
    ]);
    for (const name of ["bf-hue", "bf-ring", "bf-marquee", "bf-blink"]) {
      expect(theme, name).toContain("@keyframes " + name);
    }
  });
});

describe("every @source is real and matches what the site renders", () => {
  test("each @source path resolves from the stylesheet's own directory", () => {
    expect(sourceLines.length).toBeGreaterThan(0);
    for (const line of sourceLines) expect(existsSync(join(stylesDir, line)), line).toBe(true);
  });

  test("the @source list is exactly the stock components the site imports, transitively", () => {
    const uiDir = join(siteDir, "../../packages/bigface-business-ui/src/components/ui");
    const used = new Set<string>();
    for (const file of codeFiles) {
      const pattern = new RegExp(PACKAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/components/ui/([\\w-]+)", "g");
      for (const match of read(file).matchAll(pattern)) used.add(match[1] as string);
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

  test("no source file carries a palette variable or reads a theme variable directly", () => {
    for (const file of codeFiles) {
      const text = read(file);
      expect(text, rel(file)).not.toContain("--bf-");
      expect(text, rel(file)).not.toContain("var(--theme-");
    }
  });

  test("no source file carries a mode variant: the theme follows data-mode", () => {
    for (const file of codeFiles) expect(read(file), rel(file)).not.toContain("dark:");
  });

  test("the root document carries the theme and the dark default, and no pre-paint mode script", () => {
    const base = read(join(srcRoot, "layouts/Base.astro"));
    expect(base).toContain(PACKAGE + "/lib/themes");
    expect(base).toContain("data-theme={DEFAULT_THEME}");
    expect(base).toContain('data-mode="dark"');
    // Q2=A: the marketing pages are dark by design; /ui/business/ is the one page with a toggle.
    expect(base).not.toContain("themeInitScript");
  });

  test("the package is a workspace dependency and the retired one is gone", () => {
    const pkg = JSON.parse(read(join(siteDir, "package.json"))) as {
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.dependencies?.[PACKAGE]).toStartWith("workspace:");
    expect(pkg.dependencies?.[OLD]).toBeUndefined();
    expect(pkg.scripts?.["ui:drift"]).toBeUndefined();
  });

  test("the site's bigface layer is local to the app", () => {
    for (const name of ["button", "badge", "card", "install-tabs"]) {
      const file = join(srcRoot, "components/bg", name + ".tsx");
      expect(existsSync(file), name).toBe(true);
      expect(read(file)).toContain(PACKAGE + "/components/ui/");
    }
  });
});

describe("the retired workspaces are gone and the stock catalogue stays", () => {
  test("no legacy /ui/ or /ui/console/ page and no reference to the old package anywhere", () => {
    expect(existsSync(join(srcRoot, "pages/ui/index.astro"))).toBe(false);
    expect(existsSync(join(srcRoot, "pages/ui/console"))).toBe(false);
    expect(existsSync(join(srcRoot, "pages/ui/business/index.astro"))).toBe(true);
    for (const file of codeFiles) {
      const text = read(file);
      expect(text, rel(file)).not.toContain(OLD);
      expect(text, rel(file)).not.toContain("packages/ui");
    }
  });
});
