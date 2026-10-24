// The cross-file theme checker: the shadcn-theme pattern's five checks over the generated theme files.
//
//   bun run --cwd packages/ui ui:theme
//   theme-check: ok
//   theme-check: 2 violation(s)
//   src/themes/mistplay.css: dark-mode block missing required theme variables: --theme-radius
//
// Cross-file by nature (CSS <-> contract.json <-> roles.ts), so it cannot be a linter rule. The parser
// is a line-based block scanner: theme files are flat declaration lists by contract.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import contract from "../src/themes/contract.json";
import { OPTIONAL, REQUIRED, THEMES } from "../src/themes/roles.ts";

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

const isDark = (selector: string) => selector.includes('[data-mode="dark"]');

/** The five checks, over the files in dir and the registry. */
export function checkThemes(dir: string): Violation[] {
	const violations: Violation[] = [];
	const known = new Set([...REQUIRED, ...OPTIONAL].map((k) => "--theme-" + k));
	const files = existsSync(dir) ? readdirSync(dir, { encoding: "utf8" }) : [];
	const themeFiles = files.filter(
		(f) => f.endsWith(".css") && !f.startsWith("_"),
	);

	for (const theme of THEMES) {
		const path = join(dir, theme.id + ".css");
		if (!themeFiles.includes(theme.id + ".css")) {
			violations.push({
				file: path,
				line: 0,
				message: "registered theme has no stylesheet",
			});
			continue;
		}
		const rules = readDeclarations(readFileSync(path, "utf8"));
		const flat = rules.flatMap((r) => r.decls);

		// 1. only --theme-*, only known keys (the typo guard)
		for (const d of flat) {
			if (!known.has(d.key)) {
				violations.push({
					file: path,
					line: d.line,
					message: "unknown theme variable " + d.key,
				});
			}
		}

		// 2. the light block has every required key
		const light = flat.filter((d) => !isDark(d.selector));
		const missingLight = REQUIRED.map((k) => "--theme-" + k).filter(
			(k) => !light.some((d) => d.key === k),
		);
		if (missingLight.length) {
			violations.push({
				file: path,
				line: 0,
				message:
					"light block missing required theme variables: " +
					missingLight.join(", "),
			});
		}

		// 3. a dark block exists and has every required key on its own
		const dark = flat.filter((d) => isDark(d.selector));
		if (!dark.length) {
			violations.push({ file: path, line: 0, message: "no dark-mode block" });
		} else {
			const missingDark = REQUIRED.map((k) => "--theme-" + k).filter(
				(k) => !dark.some((d) => d.key === k),
			);
			if (missingDark.length) {
				violations.push({
					file: path,
					line: 0,
					message:
						"dark-mode block missing required theme variables: " +
						missingDark.join(", "),
				});
			}
		}
	}

	// 5. registry <-> stylesheets, one to one
	for (const file of themeFiles) {
		const id = file.replace(/\.css$/, "");
		if (!THEMES.some((t) => t.id === id)) {
			violations.push({
				file: join(dir, file),
				line: 0,
				message: "stylesheet has no registry entry",
			});
		}
	}

	// 4. _reset.css resets exactly the optional keys
	const resetPath = join(dir, "_reset.css");
	if (!existsSync(resetPath)) {
		violations.push({
			file: resetPath,
			line: 0,
			message: "missing _reset.css",
		});
	} else {
		const reset = readDeclarations(readFileSync(resetPath, "utf8")).flatMap(
			(r) => r.decls,
		);
		const want = OPTIONAL.map((k) => "--theme-" + k);
		const have = reset.map((d) => d.key);
		const missing = want.filter((k) => !have.includes(k));
		const extra = have.filter((k) => !want.includes(k));
		if (missing.length || extra.length) {
			violations.push({
				file: resetPath,
				line: 0,
				message:
					"must reset exactly the optional keys — missing: " +
					(missing.join(", ") || "none") +
					"; extra: " +
					(extra.join(", ") || "none"),
			});
		}
		for (const d of reset) {
			if (d.value !== "initial") {
				violations.push({
					file: resetPath,
					line: d.line,
					message: d.key + " must be initial",
				});
			}
		}
	}

	// contract.json and roles.ts must agree on the key list, or every file above is measured wrongly
	const declared = new Set([
		...Object.keys(contract.required),
		...Object.keys(contract.optional),
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
