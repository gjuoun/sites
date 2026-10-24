import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	cpSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkThemes, readDeclarations } from "./theme-check.ts";

const real = join(import.meta.dir, "../src/themes");
let work: string;

// Each case gets a throwaway copy of the real generated files, so a fixture can never be confused
// with the committed ones.
const fixture = (mutate: (dir: string) => void): string => {
	work = mkdtempSync(join(tmpdir(), "bf-theme-"));
	cpSync(real, work, { recursive: true });
	mutate(work);
	return work;
};
const edit = (dir: string, file: string, from: string, to: string) => {
	const path = join(dir, file);
	const css = readFileSync(path, "utf8");
	if (!css.includes(from))
		throw new Error("fixture anchor not found in " + file + ": " + from);
	writeFileSync(path, css.replace(from, to));
};

afterAll(() => {
	if (work) rmSync(work, { recursive: true, force: true });
});

describe("theme-check", () => {
	test("the committed theme files pass all five checks", () => {
		expect(checkThemes(real)).toEqual([]);
	});

	test("the parser reads declarations with their line numbers", () => {
		const rules = readDeclarations(
			readFileSync(join(real, "console.css"), "utf8"),
		);
		const first = rules[0]?.decls[0];
		expect(first?.key).toBe("--theme-canvas");
		expect(first?.line).toBeGreaterThan(0);
	});

	test("a typo'd key is reported with its line, not silently ignored", () => {
		const dir = fixture((d) =>
			edit(
				d,
				"game.css",
				"  --theme-radius:",
				"  --theme-sucess: #00c853;\n  --theme-radius:",
			),
		);
		const found = checkThemes(dir).filter((v) =>
			/unknown theme variable/.test(v.message),
		);
		expect(found).toHaveLength(1);
		expect(found[0]?.message).toContain("--theme-sucess");
		expect(found[0]?.line).toBeGreaterThan(0);
	});

	test("a dark block missing a required key is reported per block", () => {
		// Both blocks set it, so both must lose it: the checks are per block.
		const dir = fixture((d) => {
			const path = join(d, "business.css");
			writeFileSync(
				path,
				readFileSync(path, "utf8")
					.split(String.fromCharCode(10))
					.filter((line) => !line.trim().startsWith("--theme-radius:"))
					.join(String.fromCharCode(10)),
			);
		});
		const messages = checkThemes(dir).map((v) => v.message);
		expect(
			messages.some((m) => /light block missing.*--theme-radius/.test(m)),
		).toBe(true);
		expect(
			messages.some((m) => /dark-mode block missing.*--theme-radius/.test(m)),
		).toBe(true);
	});

	test("a theme file with no dark block at all is reported", () => {
		const dir = fixture((d) => {
			const path = join(d, "game.css");
			const css = readFileSync(path, "utf8");
			writeFileSync(
				path,
				css.slice(0, css.indexOf('[data-theme="game"][data-mode="dark"]')),
			);
		});
		expect(checkThemes(dir).map((v) => v.message)).toContain(
			"no dark-mode block",
		);
	});

	test("_reset.css must reset exactly the optional keys", () => {
		const dir = fixture((d) =>
			edit(d, "_reset.css", "  --theme-overlay: initial;", ""),
		);
		expect(
			checkThemes(dir)
				.map((v) => v.message)
				.some((m) => /must reset exactly.*--theme-overlay/.test(m)),
		).toBe(true);
	});

	test("a stylesheet with no registry entry is reported", () => {
		const dir = fixture((d) =>
			cpSync(join(d, "game.css"), join(d, "pirate.css")),
		);
		expect(checkThemes(dir).map((v) => v.message)).toContain(
			"stylesheet has no registry entry",
		);
	});

	test("control: removing a key from the real files fails the same check", () => {
		const dir = fixture((d) =>
			edit(
				d,
				"console.css",
				"  --theme-font-mono:",
				"  --theme-font-mono-typo:",
			),
		);
		expect(checkThemes(dir).length).toBeGreaterThan(0);
	});
});
