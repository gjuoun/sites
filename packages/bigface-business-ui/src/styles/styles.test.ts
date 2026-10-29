import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { contrastRatio, luminance } from "../../../bigface-tokens/src/contrast-math.ts";
import { loadModel, type Mode, resolve, varRefs } from "../../scripts/css-model.ts";
import { NEUTRALS } from "../themes/roles.ts";

// The stylesheet checked against itself: every expectation below is computed from business.css, styles.css,
// the stock component files and Tailwind's own theme. Nothing restates a declaration, so a refactor that keeps
// every colour keeps these green, and a change that moves a colour turns them red.
const m = loadModel();
const MODES: Mode[] = ["light", "dark"];
const value = (name: string, mode: Mode): string => resolve("var(" + name + ")", mode, m.env);
const HEX = /^#[0-9a-f]{6}$/i;

describe("styles.css resolves", () => {
	test("every declaration in styles.css resolves in both modes: no var() reads an undeclared name", () => {
		const failures: string[] = [];
		for (const block of m.styles)
			for (const d of block.decls)
				for (const mode of MODES) {
					try {
						resolve(d.value, mode, m.env);
					} catch (e) {
						failures.push(block.prelude + " " + d.name + " (" + mode + "): " + (e as Error).message);
					}
				}
		expect(failures).toEqual([]);
		expect(m.duplicates).toEqual([]);
	});

	test("every runtime role resolves to a palette colour in both modes (--radius is the one length)", () => {
		const palette = new Set(MODES.flatMap((mode) => m.palette.decls.map((d) => resolve(d.value, mode, m.env).toLowerCase())));
		for (const d of m.roles.decls) {
			if (d.name === "--radius") {
				expect(varRefs(d.value)).toEqual([]);
				continue;
			}
			for (const mode of MODES) {
				const v = value(d.name, mode).toLowerCase();
				expect(v, d.name + " " + mode).toMatch(HEX);
				expect(palette.has(v), d.name + " " + mode + " = " + v + " is a palette value").toBe(true);
			}
		}
	});
});

// Every custom property a stock component reads at runtime must exist at runtime. The sources are derived:
// the roles block, the @theme keys (Tailwind emits a key a source references), Tailwind's own theme, the
// palette, a name the file sets itself, or a variable a headless library sets on its own elements.
describe("the components' custom properties are declared", () => {
	const UI = join(import.meta.dir, "../components/ui");
	const req = createRequire(import.meta.url);
	const tailwindTheme = new Set(
		[...readFileSync(req.resolve("tailwindcss/theme.css"), "utf8").matchAll(/(--[A-Za-z][\w-]*)\s*:/g)].map((x) => x[1] as string),
	);
	// radix and base-ui write these on their own popper/collapsible nodes; shiki on its tokens; tw is Tailwind's internals
	const LIBRARY = /^--(radix-|anchor-|available-|transform-origin|shiki-|tw-)/;
	const declared = new Set([...m.roles.decls, ...m.theme.decls, ...m.palette.decls].map((d) => d.name));

	test("every var(--x) and (--x) a components/ui file reads is declared", () => {
		const unknown: string[] = [];
		let reads = 0;
		for (const f of readdirSync(UI).filter((f) => f.endsWith(".tsx"))) {
			const text = readFileSync(join(UI, f), "utf8");
			const names = new Set([...text.matchAll(/(?:var\(\s*|\()(--[A-Za-z][\w-]*)(?=[\s,)])/g)].map((x) => x[1] as string));
			for (const n of names) {
				reads++;
				const setHere = text.includes('"' + n + '"') || text.includes("'" + n + "'") || text.includes("[" + n + ":");
				if (declared.has(n) || tailwindTheme.has(n) || setHere || LIBRARY.test(n)) continue;
				unknown.push(f + ": " + n);
			}
		}
		expect(reads).toBeGreaterThan(0);
		expect(unknown).toEqual([]);
	});

	test("the shadcn roles the components read are runtime roles, not just Tailwind keys", () => {
		// a Tailwind key is emitted only when a scanned source names it; a role must exist regardless of the scan
		const roleNames = new Set(m.roles.decls.map((d) => d.name));
		const shadcn = m.theme.decls.filter((d) => d.name.startsWith("--color-")).map((d) => "--" + d.name.slice("--color-".length));
		const read = new Set<string>();
		for (const f of readdirSync(UI).filter((f) => f.endsWith(".tsx")))
			for (const x of readFileSync(join(UI, f), "utf8").matchAll(/var\(\s*(--[A-Za-z][\w-]*)\)/g)) read.add(x[1] as string);
		const missing = shadcn.filter((n) => read.has(n) && !roleNames.has(n));
		expect(missing).toEqual([]);
	});
});

// Text pairs are derived from the Tailwind key names: x on x-foreground, on-x on x, plus the base pairs. A pair
// below AA is allowed only as a recorded tradeoff, pinned to its exact ratio so any colour move trips it.
describe("contrast", () => {
	const TRADEOFFS: Record<string, number> = {
		// Ruling 2026-10-27: the ink on the primary fill is the canvas colour in both modes; paper on blue is 2.27:1
		"light --color-primary-foreground on --color-primary": 2.27,
		"light --color-sidebar-primary-foreground on --color-sidebar-primary": 2.27,
		// the accent as a link or ring on paper (ruling 2026-10-24)
		"light --color-primary-ink on --color-background": 2.27,
		// muted grey on the panel fill: AA on the canvas (below), just under it on the panel
		"light --color-muted-foreground on --color-muted": 4.09,
		"dark --color-muted-foreground on --color-muted": 4.03,
	};
	const keys = new Set(m.theme.decls.map((d) => d.name));
	const pairs: [string, string][] = [
		["--color-foreground", "--color-background"],
		["--color-muted-foreground", "--color-background"],
		["--color-primary-ink", "--color-background"],
	];
	for (const k of keys) {
		const fg = /^--color-(.+)-foreground$/.exec(k);
		if (fg && keys.has("--color-" + fg[1])) pairs.push([k, "--color-" + fg[1]]);
		const on = /^--color-on-(.+)$/.exec(k);
		if (on && keys.has("--color-" + on[1])) pairs.push([k, "--color-" + on[1]]);
	}

	test("every text pair clears 4.5:1 in both modes, or is a recorded tradeoff at its exact ratio", () => {
		expect(pairs.length).toBeGreaterThan(10);
		const measured = new Set<string>();
		const failures: string[] = [];
		for (const [ink, fill] of pairs)
			for (const mode of MODES) {
				const a = value(ink, mode), b = value(fill, mode);
				expect(a, ink + " " + mode).toMatch(HEX);
				expect(b, fill + " " + mode).toMatch(HEX);
				const ratio = Math.round(contrastRatio(a, b) * 100) / 100;
				const key = mode + " " + ink + " on " + fill;
				measured.add(key);
				if (key in TRADEOFFS) {
					if (ratio !== TRADEOFFS[key]) failures.push(key + ": recorded " + TRADEOFFS[key] + ", measured " + ratio);
				} else if (ratio < 4.5) failures.push(key + ": " + ratio + ":1 is below AA");
			}
		expect(failures).toEqual([]);
		// no stale entry: every recorded tradeoff is a pair the stylesheet really has
		expect(Object.keys(TRADEOFFS).filter((k) => !measured.has(k))).toEqual([]);
	});
});

describe("shadows and the two neutral ends", () => {
	test("the scrim is the darkest palette neutral of each mode, and the thumb the lightest", () => {
		for (const mode of MODES) {
			const neutrals = NEUTRALS.map((n) => value("--theme-" + n, mode)).sort((a, b) => luminance(a) - luminance(b));
			expect(value("--color-scrim", mode), mode).toBe(neutrals[0] as string);
			expect(value("--color-thumb", mode), mode).toBe(neutrals[neutrals.length - 1] as string);
		}
	});

	test("every shadow paints only a translucent scrim: Tailwind's geometry, no colour of its own", () => {
		const shadows = m.theme.decls.filter((d) => /^--shadow(-|$)/.test(d.name));
		expect(shadows.length).toBeGreaterThan(0);
		for (const d of shadows) {
			const mixes = d.value.match(/color-mix\(in oklab,var\(--color-scrim\) \d+%,transparent\)/g) ?? [];
			expect(mixes.length, d.name).toBeGreaterThan(0);
			const geometry = d.value.replace(/color-mix\(in oklab,var\(--color-scrim\) \d+%,transparent\)/g, "");
			expect(geometry, d.name).toMatch(/^[-\d\s.,a-z]*$/);
			expect(geometry, d.name).not.toMatch(/var\(|#|rgb|hsl|oklch|lab\(|black|white/);
		}
	});
});

test("no declaration resolves to black or white in either mode: the neutral ends are palette colours", () => {
	const END = /rgb\(\s*0[\s,]+0[\s,]+0|rgb\(\s*255[\s,]+255[\s,]+255|#000(?:000)?\b|#fff(?:fff)?\b|\bblack\b|\bwhite\b/i;
	const hits: string[] = [];
	for (const block of m.styles)
		for (const d of block.decls)
			for (const mode of MODES) {
				const v = resolve(d.value, mode, m.env);
				if (END.test(v)) hits.push(block.prelude + " " + d.name + " (" + mode + "): " + v);
			}
	expect(hits).toEqual([]);
});

test("the Canvas and CanvasText system colours resolve to the canvas and the ink", () => {
	const rule = (prelude: string, prop: string) => {
		const block = m.styles.find((b) => b.prelude === prelude);
		const d = block?.decls.find((x) => x.name === prop);
		if (!d) throw new Error("no " + prop + " in " + prelude);
		return d.value;
	};
	for (const mode of MODES) {
		expect(resolve(rule(".bg-\\[Canvas\\]", "background-color"), mode, m.env), mode).toBe(value("--color-background", mode));
		expect(resolve(rule(".text-\\[CanvasText\\]", "color"), mode, m.env), mode).toBe(value("--color-foreground", mode));
	}
});
