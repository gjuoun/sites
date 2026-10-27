import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MODE_STORAGE_KEY } from "@gjuoun/bigface-business-ui/lib/themes";

const src = (rel: string) => readFileSync(join(import.meta.dir, "..", rel), "utf8");

test("the toggle writes the package's mode key", () => {
	expect(MODE_STORAGE_KEY).toBe("bigface-mode");
	expect(src("components/ThemeToggle.astro")).toContain("MODE_STORAGE_KEY");
});

test("site.css has no hand-picked colours", () => {
	expect(src("styles/site.css")).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
	expect(src("styles/site.css")).not.toMatch(/\b(rgb|hsl|oklch)\(/);
});
