import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "./manifest.json";
import { checkLock, extractBlocks, stripBlocks, type Manifest } from "../../scripts/ui-lock-lib.ts";

// The components/ui lock. Every file is either LOCKED (its bytes are the shadcn registry output, no edits) or
// DECLARED (it carries a known, recorded exception: colour written as light-dark() tokens, to be moved into tokens
// later). The one permitted edit kind is a marked variant block (// bg2:variant <id> begin ... // bg2:variant end),
// recorded here with its exact lines. The manifest pins the sha256 of each file with its variant blocks removed.

const UI = join(import.meta.dir, "../components/ui");
const read = (): Map<string, string> =>
	new Map(
		readdirSync(UI)
			.filter((f) => f.endsWith(".tsx"))
			.sort()
			.map((f) => [f, readFileSync(join(UI, f), "utf8")] as const),
	);
const m = manifest as Manifest;
const files = read();

describe("components/ui lock", () => {
	test("the lock holds exactly the files in components/ui, and the findings are empty", () => {
		expect(checkLock(files, m)).toEqual([]);
		expect(Object.keys(m.files).length).toBe(files.size);
	});

	test("34 files are locked to registry bytes and 29 are declared exceptions", () => {
		const states = Object.values(m.files).map((f) => f.state);
		expect(states.filter((s) => s === "locked").length).toBe(34);
		expect(states.filter((s) => s === "declared").length).toBe(29);
	});

	test("each declared exception carries a marker and a one-line reason, and a TODO returns the colour to tokens", () => {
		for (const [name, entry] of Object.entries(m.files)) {
			if (entry.state !== "declared") continue;
			expect(entry.marker, name).toMatch(/^[a-z][a-z0-9-]+$/);
			expect(entry.reason, name).not.toMatch(/\n/);
			expect(entry.reason.length, name).toBeGreaterThan(20);
		}
		expect(m.todo.some((t) => /tokens/.test(t.text) && /stock/.test(t.text))).toBe(true);
	});

	test("a locked file has no marker block; a declared file's markers are only the recorded ones", () => {
		for (const [name, entry] of Object.entries(m.files)) {
			const blocks = extractBlocks(files.get(name) as string).blocks.map((b) => b.id);
			const recorded = (m.variants[name] ?? []).map((v) => v.id);
			expect(blocks, name).toEqual(recorded);
			if (entry.state === "locked") expect(blocks, name).toEqual([]);
		}
	});

	test("control: a one-line change to a locked file fails the checker", () => {
		const changed = new Map(files);
		changed.set("accordion.tsx", (files.get("accordion.tsx") as string) + "\n// drift\n");
		expect(checkLock(changed, m).some((f) => f.includes("accordion.tsx"))).toBe(true);
	});

	test("control: an extra 64th file in components/ui fails the checker", () => {
		const extra = new Map(files);
		extra.set("zz-extra.tsx", "export {};\n");
		expect(checkLock(extra, m).some((f) => f.includes("zz-extra.tsx"))).toBe(true);
	});
});

