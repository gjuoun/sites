import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The .tsx half of this rule lives with the package (packages/ui/src/bg-naming.test.ts); the
// .astro composites stay in site/src, so their import names are checked here.
const src = join(import.meta.dir);

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
