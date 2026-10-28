// The components/ui lock: the checker shared by the offline gate (scripts/ui-lock.ts) and its test.
//
// A file is LOCKED (its bytes are the shadcn registry output) or DECLARED (a recorded exception). A declared
// file's sha256 pins its bytes as they are today. The only edit a file may carry is a MARKED variant block:
//
//     // bg2:variant <id> begin
//     ...lines...
//     // bg2:variant end
//
// Removing the marked blocks must give the manifest's sha256, and each block must match its recorded lines.
import { createHash } from "node:crypto";

export const BEGIN = /^\s*\/\/ bg2:variant ([a-z][\w.-]*) begin$/;
export const END = /^\s*\/\/ bg2:variant end$/;

export interface Block {
	id: string;
	/** Index of the begin marker line, and of the end marker line. */
	start: number;
	end: number;
	/** The lines strictly between the markers. */
	body: string[];
}

export type FileEntry =
	| { state: "locked"; sha256: string }
	| { state: "declared"; sha256: string; marker: string; reason: string };

export interface Manifest {
	upstream: { registry: string; shadcn: string; method: string };
	files: Record<string, FileEntry>;
	variants: Record<string, { id: string; body: string[] }[]>;
	todo: { id: string; text: string }[];
}

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/** The marked blocks of a file, and any marker that does not pair. */
export function extractBlocks(text: string): { blocks: Block[]; errors: string[] } {
	const lines = text.split("\n");
	const blocks: Block[] = [];
	const errors: string[] = [];
	let open: { id: string; start: number } | null = null;
	lines.forEach((line, i) => {
		const b = BEGIN.exec(line);
		if (b) {
			if (open) errors.push(open.id + " opened at line " + (open.start + 1) + " is not closed before line " + (i + 1));
			open = { id: b[1] as string, start: i };
			return;
		}
		if (END.test(line)) {
			if (!open) {
				errors.push("end marker at line " + (i + 1) + " has no begin");
				return;
			}
			blocks.push({ id: open.id, start: open.start, end: i, body: lines.slice(open.start + 1, i) });
			open = null;
		}
	});
	const dangling = open as { id: string; start: number } | null;
	if (dangling) errors.push(dangling.id + " opened at line " + (dangling.start + 1) + " never ends");
	return { blocks, errors };
}

/** The file with every marked block (markers included) removed: the bytes the manifest pins. */
export function stripBlocks(text: string): string {
	const out: string[] = [];
	let skipping = false;
	for (const line of text.split("\n")) {
		if (BEGIN.test(line)) {
			skipping = true;
			continue;
		}
		if (skipping) {
			if (END.test(line)) skipping = false;
			continue;
		}
		out.push(line);
	}
	return out.join("\n");
}

/** Every finding of the lock against the given files (name to contents). Empty means the lock holds. */
export function checkLock(files: Map<string, string>, m: Manifest): string[] {
	const out: string[] = [];
	const expected = new Set(Object.keys(m.files));
	for (const name of expected) if (!files.has(name)) out.push(name + ": in the manifest, missing from components/ui");
	for (const name of files.keys()) if (!expected.has(name)) out.push(name + ": in components/ui, not in the manifest (a 64th file)");
	for (const name of Object.keys(m.variants)) if (!expected.has(name)) out.push(name + ": variant recorded for a file not in the manifest");

	for (const [name, entry] of Object.entries(m.files)) {
		const text = files.get(name);
		if (text === undefined) continue;
		if (entry.state === "declared") {
			if (!entry.marker) out.push(name + ": declared exception without a marker");
			if (!entry.reason || entry.reason.includes("\n")) out.push(name + ": declared exception without a one-line reason");
		}
		const { blocks, errors } = extractBlocks(text);
		for (const e of errors) out.push(name + ": variant marker: " + e);
		const recorded = m.variants[name] ?? [];
		const got = blocks.map((b) => b.id).join(",");
		const want = recorded.map((v) => v.id).join(",");
		if (got !== want) out.push(name + ": variant blocks [" + got + "] differ from the manifest [" + want + "] (a dropped variant, or an unrecorded one)");
		for (const v of recorded) {
			const b = blocks.find((x) => x.id === v.id);
			if (b && b.body.join("\n") !== v.body.join("\n")) out.push(name + ": variant " + v.id + " differs from its recorded lines");
		}
		if (entry.state === "locked" && blocks.length > 0) out.push(name + ": locked file carries a variant block");
		if (sha256(stripBlocks(text)) !== entry.sha256) {
			out.push(name + ": bytes differ from the " + (entry.state === "locked" ? "registry" : "declared") + " sha256 outside the marked lines");
		}
	}

	const declared = Object.values(m.files).some((f) => f.state === "declared");
	if (declared && !m.todo.some((t) => /tokens/.test(t.text) && /stock/.test(t.text))) {
		out.push("no TODO entry returns the declared colour to tokens so the exceptions can go back to stock");
	}
	return out;
}
