import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The family rule, asserted once. Every BG component lives in apps/bigface/src/components/bg, every
// one of them is .tsx, exports only BG* names (plus their cva helpers bg*Variants / BG*Props types),
// and nothing anywhere still imports a bg/*.astro. The other apps consume the family through
// @sites/bigface, so a second copy under any app's own components dir is a failure here.
const src = join(import.meta.dir);
const bgDir = join(src, "components/bg");
const appsDir = join(src, "..", "..", "..");

export const badExports = (code: string): string[] =>
  [...code.matchAll(/export\s+(?:function|const|class|type|interface)\s+(\w+)/g)]
    .map((m) => m[1] as string)
    .filter((n) => !/^BG[A-Z]\w*$/.test(n) && !/^bg[A-Z]\w*Variants$/.test(n));

const appDirs = readdirSync(appsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

test("the family is TSX only", () => {
  const astro = readdirSync(bgDir).filter((name) => name.endsWith(".astro"));
  expect(astro).toEqual([]);
});

test("components/bg/*.tsx export only BG-prefixed names", () => {
  const offenders: string[] = [];
  for (const f of readdirSync(bgDir).filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx")))
    for (const n of badExports(readFileSync(join(bgDir, f), "utf8"))) offenders.push(f + ": " + n);
  expect(offenders).toEqual([]);
});

test("every bg file name is kebab-case", () => {
  for (const f of readdirSync(bgDir)) expect(f).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*\.(tsx|test\.tsx)$/);
});

test("no app re-creates a member of the family", () => {
  // An app may keep page sections under its own components/bg; what it may not keep is a second
  // copy of a component bigface already owns, which is the duplicate this rule exists for.
  const family = new Set(readdirSync(bgDir).filter((name) => name.endsWith(".tsx")));
  const copies: string[] = [];
  for (const app of appDirs) {
    if (app === "bigface") continue;
    const dir = join(appsDir, app, "src", "components", "bg");
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) if (family.has(name)) copies.push(app + "/" + name);
  }
  expect(copies).toEqual([]);
});

test("nothing imports a bg/*.astro", () => {
  const offenders: string[] = [];
  for (const app of appDirs) {
    const root = join(appsDir, app, "src");
    if (!existsSync(root)) continue;
    for (const file of readdirSync(root, { recursive: true, encoding: "utf8" }))
      if (/\.(astro|tsx?)$/.test(file) && !/\.test\./.test(file)) {
        const code = readFileSync(join(root, file), "utf8");
        if (/components\/bg\/[^"']+\.astro/.test(code)) offenders.push(app + "/" + file);
      }
  }
  expect(offenders).toEqual([]);
});

test("control: a plain Button export is caught", () => {
  expect(badExports("export function Button() {}")).toEqual(["Button"]);
  expect(badExports("export function BGButton() {}\nexport const bgButtonVariants = 1")).toEqual([]);
});
