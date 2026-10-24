import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Everything we author in components/bg is named BG<Name>: .tsx files export only BG* names (plus
// their cva helpers bg*Variants / BG*Props types). The .astro composites live in site/src and are
// covered by that project's own test.
const src = join(import.meta.dir);
const bg = join(src, "components/bg");

export const badExports = (code: string): string[] =>
  [...code.matchAll(/export\s+(?:function|const|class|type|interface)\s+(\w+)/g)]
    .map((m) => m[1] as string)
    .filter((n) => !/^BG[A-Z]\w*$/.test(n) && !/^bg[A-Z]\w*Variants$/.test(n));

test("components/bg/*.tsx export only BG-prefixed names", () => {
  const bad: string[] = [];
  for (const f of readdirSync(bg).filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx")))
    for (const n of badExports(readFileSync(join(bg, f), "utf8"))) bad.push(`${f}: ${n}`);
  expect(bad).toEqual([]);
});

test("control: a plain Button export is caught", () => {
  expect(badExports("export function Button() {}")).toEqual(["Button"]);
  expect(badExports("export function BGButton() {}\nexport const bgButtonVariants = 1")).toEqual(
    [],
  );
});
