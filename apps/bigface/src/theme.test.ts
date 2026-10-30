import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The consumer contract, pinned: the theme comes from @gjuoun/bigface-business-ui, the site's whole
// stylesheet is the package plus its fonts, motions and the one font-capability utility, the document
// carries data-theme/data-mode dark, and no file carries a palette variable, a retired package name or
// a mode variant of its own.
const PACKAGE = "@gjuoun/bigface-business-ui";
// Assembled from parts on purpose: the retirement gate is "a plain grep for the old name finds
// nothing", and the guard's own source must not be the one file that trips it.
const OLD = ["@gjuoun", "bigface-ui"].join("/");
const OLD_PATH = ["packages", "ui"].join("/");
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
const rel = (file: string) => file.slice(srcRoot.length + 1);
const codeFiles = allFiles.filter((file) => /\.(astro|tsx?|css)$/.test(file) && !isTest(file));
// The business catalogue is its own entry with its own stylesheet (business-showcase.css), which scans
// the whole package on purpose. It is not part of the marketing surface these assertions describe: it
// displays the generated theme (so it reads --theme-* to print the values) and renders all 63 stock
// components.
const isCatalogue = (file: string) => rel(file).startsWith("pages/ui/business/");
const siteFiles = codeFiles.filter((file) => !isCatalogue(file));
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
    // The statement splitter strips CSS comments, which eats the glob in a test-exclusion line; those
    // two lines are asserted by prefix below instead of by their text.
    const statements = topLevelStatements(css);
    expect(statements.filter((s) => !s.startsWith("@source not"))).toEqual([
      '@import "tailwindcss" source("../")',
      '@import "./reset-palette.css"',
      '@import "@gjuoun/bigface-business-ui/styles.css"',
      ...sourceLines.map((line) => '@source "' + line + '"'),
      "@theme inline",
      "@utility font-code",
      "@layer base",
    ]);
    expect(statements.filter((s) => s.startsWith("@source not")).length, "test fixtures are not scanned").toBe(2);
  });

  test("the palette reset stays in front of the package theme, or its colour keys are cleared", () => {
    const statements = topLevelStatements(css);
    expect(statements.indexOf('@import "./reset-palette.css"')).toBeLessThan(
      statements.indexOf('@import "@gjuoun/bigface-business-ui/styles.css"'),
    );
  });

  test("one base layer for document elements, one font utility, no variant and no colour", () => {
    // The base layer exists because content typography has to lose to any utility on the element
    // (an [&_h1] rule out-specifies them); it may style generic document elements and the page's two
    // state classes only, never a component class.
    const base = /@layer base \{([\s\S]*)\n\}\s*$/.exec(css)?.[1] ?? "";
    expect(base).not.toBe("");
    const selectors = [...base.matchAll(/([^{}]+)\{/g)].map((m) => (m[1] as string).trim());
    expect(selectors.some((s) => /\bbg-|\btext-\[|data-slot|\.group/.test(s))).toBe(false);
    expect(css.match(/@layer/g)?.length, "exactly one layer").toBe(1);
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
      "--animate-drift",
      "--animate-hue",
      "--animate-marquee",
      "--animate-ring",
      "--ease-bf",
      "--font-display",
      "--font-mono",
      "--font-sans",
    ]);
    for (const name of ["bf-hue", "bf-ring", "bf-marquee", "bf-blink", "bf-drift"]) {
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
    for (const file of siteFiles) {
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

  test("no marketing file carries a palette variable or reads a theme variable directly", () => {
    for (const file of siteFiles) {
      const text = read(file);
      expect(text, rel(file)).not.toContain("--bf-");
      expect(text, rel(file)).not.toContain("var(--theme-");
    }
  });

  test("no marketing file carries a mode variant: the theme follows data-mode", () => {
    // One exception, and it is the opposite case: the install tabs must override the stock trigger's own
    // dark: active state, because this site's only mode is dark. The rule pins that this stays the only one.
    const shipped = siteFiles.filter((file) => /\.(astro|tsx|css)$/.test(file));
    const withDark = shipped.filter((file) => read(file).includes("dark:")).map(rel);
    expect(withDark).toEqual(["components/bg/install-tabs.tsx"]);
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
      expect(text, rel(file)).not.toContain(OLD_PATH);
    }
  });
});
