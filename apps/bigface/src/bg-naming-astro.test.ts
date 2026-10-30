import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Everything the site authors under components/bg is named BG<Name>: .astro composites are imported
// under BG-prefixed names, and .tsx parts export only BG* names (plus their cva helpers
// bg*Variants / BG*Props types). The rule lived with the old package before JW-329; the components
// are app-local now, so the app owns the whole check.
const src = join(import.meta.dir);
const bgDir = join(src, "components/bg");

export const badExports = (code: string): string[] =>
  [...code.matchAll(/export\s+(?:function|const|class|type|interface)\s+(\w+)/g)]
    .map((m) => m[1] as string)
    .filter((n) => !/^BG[A-Z]\w*$/.test(n) && !/^bg[A-Z]\w*Variants$/.test(n));

const bad: string[] = [];
test("components/bg/*.astro are imported under BG-prefixed names", () => {
  const files = readdirSync(src, { recursive: true, encoding: "utf8" }).filter((f) =>
    /\.(astro|tsx|ts)$/.test(f),
  );
  for (const f of files) {
    const code = readFileSync(join(src, f), "utf8");
    for (const m of code.matchAll(
      /import\s+(\w+)\s+from\s+["'][^"']*components\/bg\/[^"']+\.astro["']/g,
    ))
      if (!/^BG[A-Z]/.test(m[1] as string)) bad.push(`${f}: ${m[1]}`);
    for (const m of code.matchAll(/import\s+(\w+)\s+from\s+["']\.\/[^"']+\.astro["']/g))
      if (f.startsWith("components/bg/") && !/^BG[A-Z]/.test(m[1] as string))
        bad.push(`${f}: ${m[1]}`);
  }
  expect(bad).toEqual([]);
});

test("components/bg/*.tsx export only BG-prefixed names", () => {
  const offenders: string[] = [];
  for (const f of readdirSync(bgDir).filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx")))
    for (const n of badExports(readFileSync(join(bgDir, f), "utf8"))) offenders.push(`${f}: ${n}`);
  expect(offenders).toEqual([]);
});

test("control: a plain Button export is caught", () => {
  expect(badExports("export function Button() {}")).toEqual(["Button"]);
  expect(badExports("export function BGButton() {}\nexport const bgButtonVariants = 1")).toEqual([]);
});
