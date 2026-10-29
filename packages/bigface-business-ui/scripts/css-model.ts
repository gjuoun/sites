// A small model of the package's two stylesheets, for tests that derive their expectations from the CSS itself
// rather than restating it: parse business.css and styles.css into blocks and declarations, and resolve any
// var() / light-dark() chain to the value it takes in a mode.
//
// It reads plain CSS only (no Tailwind compile): @theme inline keys are declarations like any other, which is
// exactly what Tailwind inlines into the utilities.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Mode = "light" | "dark";
export interface Decl {
	name: string;
	value: string;
}
export interface Block {
	/** The selector or at-rule prelude, whitespace collapsed and with no spaces around commas. */
	prelude: string;
	/** The declarations directly inside this block (nested blocks are their own entries). */
	decls: Decl[];
}

const SRC = join(import.meta.dir, "../src");
export const STYLES_PATH = join(SRC, "styles/styles.css");
export const BUSINESS_PATH = join(SRC, "themes/business.css");

export const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");
const norm = (s: string): string => s.trim().replace(/\s+/g, " ").replace(/\s*,\s*/g, ",");

const parseDecls = (body: string): Decl[] =>
	body
		.split(";")
		.map((part) => part.trim())
		.filter((part) => part.length > 0)
		.flatMap((part) => {
			const colon = part.indexOf(":");
			if (colon < 1) return [];
			const name = part.slice(0, colon).trim();
			if (!/^-{0,2}[A-Za-z][\w-]*$/.test(name)) return []; // @apply and at-statements are not declarations
			return [{ name, value: norm(part.slice(colon + 1)) }];
		});

/** Every block of a stylesheet, nested ones included, in source order of their closing brace. */
export function parseBlocks(css: string): Block[] {
	const text = stripComments(css);
	const blocks: Block[] = [];
	const stack: { prelude: string; body: string }[] = [];
	let buf = "";
	for (const ch of text) {
		if (ch === "{") {
			// text before the last ';' belongs to the parent's body; the rest is this block's prelude
			const cut = buf.lastIndexOf(";");
			if (stack.length && cut >= 0) (stack[stack.length - 1] as { body: string }).body += buf.slice(0, cut + 1);
			stack.push({ prelude: norm(cut >= 0 ? buf.slice(cut + 1) : buf), body: "" });
			buf = "";
		} else if (ch === "}") {
			const top = stack.pop();
			if (!top) throw new Error("unbalanced '}' in stylesheet");
			blocks.push({ prelude: top.prelude, decls: parseDecls(top.body + buf) });
			buf = "";
		} else {
			buf += ch;
		}
	}
	if (stack.length) throw new Error("unclosed block in stylesheet");
	return blocks;
}

/** The function call fn(...) starting at or after from, with its top-level comma-separated arguments. */
function findCall(text: string, fn: string, from = 0): { start: number; end: number; args: string[] } | null {
	const re = new RegExp("(?<![\\w-])" + fn.replace(/[-]/g, "\\-") + "\\(", "g");
	re.lastIndex = from;
	const m = re.exec(text);
	if (!m) return null;
	let depth = 0;
	const args: string[] = [];
	let argStart = m.index + m[0].length;
	for (let i = argStart; i < text.length; i++) {
		const c = text[i];
		if (c === "(") depth++;
		else if (c === ")") {
			if (depth === 0) {
				args.push(text.slice(argStart, i).trim());
				return { start: m.index, end: i + 1, args };
			}
			depth--;
		} else if (c === "," && depth === 0) {
			args.push(text.slice(argStart, i).trim());
			argStart = i + 1;
		}
	}
	throw new Error("unbalanced " + fn + "( in: " + text);
}

/** Every custom property name a value reads through var(). */
export const varRefs = (value: string): string[] => [...value.matchAll(/var\(\s*(--[A-Za-z][\w-]*)/g)].map((m) => m[1] as string);

/**
 * The value a declaration takes in a mode: every var() substituted from env (its fallback when the name is
 * undeclared), then every light-dark() reduced to its branch for the mode. Throws on an undeclared name with
 * no fallback, and on a cycle.
 */
export function resolve(value: string, mode: Mode, env: Map<string, string>, seen: string[] = []): string {
	let out = value;
	for (let call = findCall(out, "var"); call; call = findCall(out, "var")) {
		const [name, ...rest] = call.args as [string, ...string[]];
		let sub: string;
		if (seen.includes(name)) throw new Error("var() cycle: " + [...seen, name].join(" -> "));
		const declared = env.get(name);
		if (declared !== undefined) sub = resolve(declared, mode, env, [...seen, name]);
		else if (rest.length) sub = resolve(rest.join(","), mode, env, seen);
		else throw new Error("unresolved " + name + (seen.length ? " (via " + seen.join(" -> ") + ")" : ""));
		out = out.slice(0, call.start) + sub + out.slice(call.end);
	}
	for (let call = findCall(out, "light-dark"); call; call = findCall(out, "light-dark")) {
		if (call.args.length !== 2) throw new Error("light-dark() takes two colours: " + out);
		out = out.slice(0, call.start) + (mode === "light" ? call.args[0] : call.args[1]) + out.slice(call.end);
	}
	return norm(out);
}

export interface Model {
	business: Block[];
	styles: Block[];
	/** The one block of business.css: --theme-* palette values. */
	palette: Block;
	/** styles.css's :root,[data-theme] block: the runtime roles. */
	roles: Block;
	/** styles.css's @theme inline block: the Tailwind keys. */
	theme: Block;
	/** Every declaration of both files by name (custom properties only). */
	env: Map<string, string>;
	/** Names declared more than once in the same block. */
	duplicates: string[];
}

const only = (blocks: Block[], prelude: string, file: string): Block => {
	const hits = blocks.filter((b) => b.prelude === prelude);
	if (hits.length !== 1) throw new Error(file + ": expected one '" + prelude + "' block, found " + hits.length);
	return hits[0] as Block;
};

export function loadModel(styles = readFileSync(STYLES_PATH, "utf8"), business = readFileSync(BUSINESS_PATH, "utf8")): Model {
	const b = parseBlocks(business);
	const s = parseBlocks(styles);
	if (b.length !== 1) throw new Error("business.css: expected one block, found " + b.length);
	const env = new Map<string, string>();
	const duplicates: string[] = [];
	for (const block of [...b, ...s]) {
		const inBlock = new Set<string>();
		for (const d of block.decls) {
			if (!d.name.startsWith("--")) continue;
			if (inBlock.has(d.name)) duplicates.push(block.prelude + " " + d.name);
			inBlock.add(d.name);
			env.set(d.name, d.value);
		}
	}
	return {
		business: b,
		styles: s,
		palette: b[0] as Block,
		roles: only(s, ":root,[data-theme]", "styles.css"),
		theme: only(s, "@theme inline", "styles.css"),
		env,
		duplicates,
	};
}
