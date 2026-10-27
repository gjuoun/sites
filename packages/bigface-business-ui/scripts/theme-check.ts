// The cross-file theme checker: the shadcn-theme pattern's checks over the generated theme files.
//
//   bun run --cwd packages/bigface-business-ui ui:theme
//   theme-check: ok
//
// The theme is ONE block: a role whose palettes differ is light-dark(light, dark), one whose palettes agree
// is a bare hex. There is no dark block and no optional tier, so the checks are: one block, exactly the
// contract keys, every value in one of the two shapes, and a registry entry per stylesheet.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import contract from "../src/themes/contract.json";
import { DERIVED_KEYS, REQUIRED, THEMES } from "../src/themes/roles.ts";

export interface Violation {
	file: string;
	line: number;
	message: string;
}

const stripComments = (line: string): string =>
	line.replace(/\/\*.*?\*\//g, "");

/** A declaration found in the file, with the 1-based line it sits on and the selector it sits under. */
interface Decl {
	key: string;
	value: string;
	line: number;
	selector: string;
}

/** Every --theme-* declaration of a stylesheet, grouped by the rule block that introduces it. */
export function readDeclarations(
	css: string,
): { selectors: string[]; decls: Decl[] }[] {
	const rules: { selectors: string[]; decls: Decl[] }[] = [];
	let current: { selectors: string[]; decls: Decl[] } | null = null;
	let pending: string[] = [];
	css.split("\n").forEach((raw, i) => {
		const line = stripComments(raw).trim();
		if (!line) return;
		if (line.includes("{")) {
			const sel = line.slice(0, line.indexOf("{")).trim();
			pending = sel ? sel.split(",").map((s) => s.trim()) : [];
			if (pending.length) {
				current = { selectors: pending, decls: [] };
				rules.push(current);
			}
			return;
		}
		if (line.startsWith("}")) {
			current = null;
			return;
		}
		if (!current || !line.startsWith("--theme-")) return;
		const colon = line.indexOf(":");
		if (colon < 0) return;
		current.decls.push({
			key: line.slice(0, colon).trim(),
			value: line.slice(colon + 1, line.lastIndexOf(";")).trim(),
			line: i + 1,
			selector: current.selectors[0] as string,
		});
	});
	return rules;
}

/** light-dark(#a, #b) or one bare hex: the only two value shapes a role may have. */
const SHAPE = /^(?:light-dark\(#[0-9a-f]{6}, #[0-9a-f]{6}\)|#[0-9a-f]{6})$/;

/** The checks, over the files in dir and the registry. */
export function checkThemes(dir: string): Violation[] {
	const violations: Violation[] = [];
	const known = new Set([...REQUIRED, ...DERIVED_KEYS].map((k) => "--theme-" + k));
	const files = existsSync(dir) ? readdirSync(dir, { encoding: "utf8" }) : [];
	const themeFiles = files.filter(
		(f) => f.endsWith(".css") && !f.startsWith("_"),
	);

	for (const theme of THEMES) {
		const path = join(dir, theme.id + ".css");
		if (!themeFiles.includes(theme.id + ".css")) {
			violations.push({ file: path, line: 0, message: "registered theme has no stylesheet" });
			continue;
		}
		const rules = readDeclarations(readFileSync(path, "utf8"));
		if (rules.length !== 1) {
			violations.push({ file: path, line: 0, message: "expected exactly one block, found " + rules.length });
			continue;
		}
		const decls = rules[0]?.decls ?? [];

		// 1. only --theme-*, only known keys (the typo guard)
		for (const d of decls) {
			if (!known.has(d.key)) violations.push({ file: path, line: d.line, message: "unknown theme variable " + d.key });
		}

		// 2. every required key, once
		for (const key of known) {
			const hits = decls.filter((d) => d.key === key);
			if (hits.length === 0) violations.push({ file: path, line: 0, message: "missing required theme variable " + key });
			if (hits.length > 1) violations.push({ file: path, line: 0, message: "duplicate theme variable " + key });
		}

		// 3. every value is light-dark(a, b) or a bare hex: no selector workaround can hide here
		for (const d of decls) {
			if (!SHAPE.test(d.value)) {
				violations.push({ file: path, line: d.line, message: d.key + " must be light-dark(light, dark) or one hex: " + d.value });
			}
		}
	}

	// 4. registry <-> stylesheets, one to one
	for (const file of themeFiles) {
		const id = file.replace(/\.css$/, "");
		if (!THEMES.some((t) => t.id === id)) {
			violations.push({ file: join(dir, file), line: 0, message: "stylesheet has no registry entry" });
		}
	}

	// 5. contract.json and roles.ts must agree on the key list, or every file above is measured wrongly
	const declared = new Set([
		...Object.keys(contract.required),
		...Object.keys(contract.optional),
		...Object.keys(contract.derived),
	]);
	const missingInContract = [...known].filter((k) => !declared.has(k));
	const extraInContract = [...declared].filter((k) => !known.has(k));
	if (missingInContract.length || extraInContract.length) {
		violations.push({
			file: "src/themes/contract.json",
			line: 0,
			message:
				"contract and roles disagree — missing: " +
				(missingInContract.join(", ") || "none") +
				"; extra: " +
				(extraInContract.join(", ") || "none"),
		});
	}

	return violations;
}

if (import.meta.main) {
	const violations = checkThemes(join(import.meta.dir, "../src/themes"));
	for (const v of violations) {
		const short = v.file.split("/src/themes/").pop() as string;
		console.log("src/themes/" + short + ":" + v.line + ": " + v.message);
	}
	if (violations.length) {
		console.log("theme-check: " + violations.length + " violation(s)");
		process.exit(1);
	}
	console.log("theme-check: ok");
}
