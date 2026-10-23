import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bgCatalog, propsOf, textScale, variantKeys } from "./ui-catalog.ts";

// The library moved to packages/ui; the site keeps the .astro composites. The catalog and the /ui
// page read both, so these helpers resolve a BG entry by name wherever it lives.
const pkg = join(import.meta.dir, "../../../../packages/ui/src/components");
const ui = join(pkg, "ui");
const bgPkg = join(pkg, "bg");
const bgSite = join(import.meta.dir, "../components/bg");
const read = (dir: string, f: string) => readFileSync(join(dir, f), "utf8");
const bgFiles = () =>
  [
    ...readdirSync(bgSite, { encoding: "utf8" }),
    ...readdirSync(bgPkg, { encoding: "utf8" }),
  ].sort();
const bgAt = (f: string) => (existsSync(join(bgPkg, f)) ? bgPkg : bgSite);

test("variant keys are read from the shadcn sources", () => {
  const button = read(ui, "button.tsx");
  expect(variantKeys(button, "variant")).toEqual([
    "default",
    "outline",
    "secondary",
    "ghost",
    "destructive",
    "link",
  ]);
  expect(variantKeys(button, "size")).toEqual([
    "default",
    "xs",
    "sm",
    "lg",
    "icon",
    "icon-xs",
    "icon-sm",
    "icon-lg",
  ]);
  expect(variantKeys(read(ui, "badge.tsx"), "variant")).toHaveLength(6);
  expect(variantKeys(read(ui, "tabs.tsx"), "variant")).toEqual(["default", "line"]);
  expect(variantKeys(button, "nope")).toEqual([]);
});

test("the catalog lists every file in components/bg, and nothing else", () => {
  const files = bgFiles().filter((f) => !f.includes(".test."));
  expect(bgCatalog.map((e) => e.file).sort()).toEqual(files);
});

test("every BG export of a .tsx file is in the catalog", () => {
  const names = new Set(bgCatalog.map((e) => e.name));
  for (const f of readdirSync(bgPkg).filter((f) => f.endsWith(".tsx") && !f.includes(".test.")))
    for (const m of read(bgPkg, f).matchAll(/export function (BG\w+)/g))
      expect(names.has(m[1] as string), `${f}: ${m[1]}`).toBe(true);
});

test("props come from the source: every component that takes props shows them", () => {
  for (const e of bgCatalog.filter((e) => e.kind !== "helper")) {
    const props = propsOf(e.file, read(bgAt(e.file), e.file));
    if (["toast.astro", "divider.astro", "contrast-table.astro"].includes(e.file))
      expect(props).toBe("(no props)");
    else expect(props, e.file).not.toBe("(no props)");
  }
  const tabs = propsOf("install-tabs.tsx", read(bgPkg, "install-tabs.tsx"));
  expect(tabs).toContain("command: string");
  expect(tabs).toContain("items: BGInstallTab[]");
});

test("a component whose props are not final says why", () => {
  for (const e of bgCatalog.filter((e) => !e.finalised)) expect(e.why, e.name).toBeTruthy();
});

// A tie at the same size must not depend on which file the class was found in: that made the /ui
// page render `text-xs` before the move and `text-[0.75rem]` after it, because Vite's glob lists
// packages/ before site/ but apps/ before packages/. Named scale classes win the tie.
test("equal font sizes are ordered by name, not by scan order", () => {
  const arbitraryFirst = textScale(['class="text-[0.75rem]"', "text-xs"]);
  const namedFirst = textScale(["text-xs", 'class="text-[0.75rem]"']);
  expect(arbitraryFirst).toEqual(["text-xs", "text-[0.75rem]"]);
  expect(namedFirst).toEqual(["text-xs", "text-[0.75rem]"]);
});

test("the text scale is the font-size classes in use, smallest first, colours excluded", () => {
  const scale = textScale([
    'class="text-[0.72rem] text-sm text-bf-blue text-[1rem]/[1.5]"',
    "text-xs",
  ]);
  expect(scale).toEqual(["text-[0.72rem]", "text-xs", "text-sm"]);
});
