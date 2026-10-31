import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The consumer contract, pinned: the theme comes from @gjuoun/bigface-shadcn-ui, the only
// stylesheet is the package plus the site's fonts and motions, the document carries data-theme /
// data-mode, and no file carries a colour, a retired token or a mode variant of its own.
const PACKAGE = "@gjuoun/bigface-shadcn-ui";
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
// The BG family moved to apps/bigface and arrives through @sites/bigface. Its markup is compiled by
// this app, so it counts as this app's source for the two checks below that look at what renders.
const familyDir = join(srcRoot, "../../bigface/src/components/bg");
const familyFiles = walk(familyDir).filter((file) => /\.tsx$/.test(file) && !isTest(file));
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
      '@import "@gjuoun/bigface-shadcn-ui/styles.css"',
      '@source "../../../../packages/bigface-shadcn-ui/src/components/ui/button.tsx"',
      '@source "../../../../packages/bigface-shadcn-ui/src/components/ui/badge.tsx"',
      '@source "../../../../packages/bigface-shadcn-ui/src/components/ui/card.tsx"',
      '@source "../../../../packages/bigface-shadcn-ui/src/components/ui/tabs.tsx"',
      '@source "../../../bigface/src/components/bg"',
      "@utility font-code",
      "@theme inline",
    ]);
  });

  test("the styles folder holds tailwind.css and the generated font faces, nothing else", () => {
    expect(readdirSync(stylesDir).sort()).toEqual(["qublack-fonts.css", "tailwind.css"]);
  });

  test("no local layer, utility, variant, colour or shadow lives in the stylesheet", () => {
    // One utility: font-code, because the shared BG family is set in it and Tailwind does not
    // resolve a utility the consuming app never defines.
    expect([...css.matchAll(/@utility\s+(\S+)/g)].map((m) => m[1])).toEqual(["font-code"]);
    expect(css).not.toMatch(/@layer|@custom-variant/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl|oklch)\(/);
    expect(css).not.toContain("--color-");
  });

  test("the @theme block carries fonts and the two site motions only", () => {
    const theme = /@theme inline \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    const keys = [...theme.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]);
    expect(keys.sort()).toEqual([
      "--animate-drift",
      "--animate-hue",
      "--ease-bf",
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
    expect(sourceLines.length).toBe(5);
    for (const line of sourceLines) expect(existsSync(join(stylesDir, line)), line).toBe(true);
  });

  test("the @source list is exactly the stock components the site imports, transitively", () => {
    const uiDir = join(
      srcRoot,
      "../../../packages/bigface-shadcn-ui/src/components/ui",
    );
    const used = new Set<string>();
    for (const file of [...codeFiles, ...familyFiles]) {
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
        /@gjuoun\/bigface-shadcn-ui\/components\/ui\/([\w-]+)/g,
      ))
        queue.push(match[1] as string);
    }
    // The directory source scans the shared BG family; only the per-component lines pin the closure.
    const pinned = sourceLines
      .filter((line) => line.endsWith(".tsx"))
      .map((line) => (line.split("/").pop() as string).replace(/\.tsx$/, ""));
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

  test("the inline highlight is painted with the theme's one yellow", () => {
    const chips: string[] = [];
    for (const file of [...codeFiles, ...familyFiles]) {
      for (const match of read(file).matchAll(/<code\b[^>]*class(?:Name)?="([^"]*)"/g)) chips.push(match[1] as string);
    }
    expect(chips.length).toBeGreaterThan(10);
    for (const classes of chips) {
      // No chip takes its ink from a chart-ramp colour any more.
      expect(classes).not.toContain("text-chart-");
      // The block command lines keep the foreground ink; every inline highlight is the theme's yellow.
      if (!classes.includes("text-foreground")) expect(classes).toContain("text-yellow");
    }
  });

  test("the document carries no descendant display rule that out-specifies a component", () => {
    // 2026-10-30: a page-wide "[&_svg]:inline" on <body> (a stand-in for Tailwind's preflight override)
    // beat the toggle's ".hidden" on specificity, so both icons showed in light mode. Display belongs to
    // the element that needs it, never to a blanket descendant selector on the document.
    const base = read(join(srcRoot, "layouts/Base.astro"));
    const body = /<body[\s\S]*?>/.exec(base)?.[0] ?? "";
    expect(body).not.toBe("");
    expect(body).not.toMatch(/\[&_[a-z]+\]:(inline|inline-block|block|flex|grid|none)\b/);
  });

  test("the theme package is a workspace dependency", () => {
    const pkg = JSON.parse(read(join(srcRoot, "../package.json"))) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.[PACKAGE]).toStartWith("workspace:");
  });
});

// 2026-10-30: the theme now carries the palette's yellow unchanged in both blocks (#ffeb3b), so the
// "darken it until it clears AA on paper" derivation is gone. Dark still asserts AA, because that is the
// ink this site uses; light records the palette value and its measured ratio as an explicit exception —
// on paper #ffeb3b is a fill accent, not body ink, and the chip keeps its shape rather than a recolour.
describe("yellow is the palette's #ffeb3b in both modes", () => {
  const themeCss = read(
    join(srcRoot, "../../../packages/bigface-shadcn-ui/src/themes/bigface.css"),
  );
  const tokens = (selector: string) => {
    const at = themeCss.indexOf(selector + " {");
    const body = at < 0 ? "" : themeCss.slice(at + selector.length + 2).split("}")[0] || "";
    return Object.fromEntries(
      [...body.matchAll(/(--theme-[\w]+):\s*(#[0-9a-fA-F]{3,8})/g)].map((match) => [match[1], match[2] as string]),
    ) as Record<string, string>;
  };
  const luminance = (colour: string) => {
    const channels = [1, 3, 5].map((i) => Number.parseInt(colour.slice(i, i + 2), 16) / 255);
    const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * (linear[0] as number) + 0.7152 * (linear[1] as number) + 0.0722 * (linear[2] as number);
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  };
  // The chip backdrop: 8% of the border colour over the page.
  const chip = (theme: Record<string, string>) => {
    const channels = [1, 3, 5].map((i) => {
      const border = Number.parseInt((theme["--theme-border"] as string).slice(i, i + 2), 16) / 255;
      const bg = Number.parseInt((theme["--theme-bg"] as string).slice(i, i + 2), 16) / 255;
      return Math.round((border * 0.08 + bg * 0.92) * 255)
        .toString(16)
        .padStart(2, "0");
    });
    return "#" + channels.join("");
  };

  test("dark: the yellow ink clears AA on the chip", () => {
    const theme = tokens('[data-mode="dark"]');
    expect(theme["--theme-yellow"]).toBe("#ffeb3b");
    expect(ratio(theme["--theme-yellow"] as string, chip(theme))).toBeGreaterThan(7);
  });

  test("light: the palette value, pinned as a known low-contrast ink", () => {
    const theme = tokens(':root, [data-mode="light"]');
    const yellow = theme["--theme-yellow"] as string;
    expect(yellow).toBe("#ffeb3b");
    // 1.13:1 on the paper. Not an AA ink and not meant to be: in light the role is a fill and underline
    // accent. Pinned so a palette move, or a silent re-derivation, shows up here.
    expect(ratio(yellow, theme["--theme-bg"] as string)).toBeCloseTo(1.13, 1);
  });
});
