import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "./manifest.json";
import { checkLock, extractBlocks, sha256, stripBlocks, type Manifest } from "../../scripts/ui-lock-lib.ts";
import { buttonVariants } from "../components/ui/button.tsx";

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
	test("the glow variant is a paleBlue halo: gradient primary fill, on-primary ink, outer paleBlue glow, hover lift", () => {
		const glow = buttonVariants({ variant: "glow" }).split(/\s+/);
		// the halo is the theme's existing paleBlue, read through --theme-paleBlue; the fill is a gradient to a darker primary
		expect(glow).toContain("shadow-[0_0_20px_-2px_var(--theme-paleBlue)]");
		expect(glow).toContain("hover:shadow-[0_0_20px_-2px_var(--theme-paleBlue)]");
		expect(glow).toContain("bg-linear-135/srgb");
		expect(glow).toContain("from-primary");
		expect(glow).toContain("text-primary-foreground");
		expect(glow).toContain("hover:-translate-y-0.5");
		// no inset ring and no ring in the canvas colour: the glow is an outside halo
		expect(glow.some((c) => /inset-ring|ring-background/.test(c))).toBe(false);
		// no new custom property: every var() the variant reads is one the theme already declares
		const used = [...buttonVariants({ variant: "glow" }).matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]);
		const declared = readFileSync(join(import.meta.dir, "../themes/business.css"), "utf8");
		for (const name of new Set(used)) expect(declared, name).toContain(name + ":");
		expect(new Set(used)).toEqual(new Set(["--theme-blue", "--theme-fg", "--theme-bg", "--theme-paleBlue"]));
		// the stock default keeps no glow
		expect(buttonVariants({ variant: "default" })).not.toContain("paleBlue");
	});

	test("button.tsx diverges from registry bytes only by its declared colour lines and the marked glow lines", () => {
		const text = files.get("button.tsx") as string;
		const blocks = extractBlocks(text).blocks;
		expect(blocks.map((b) => b.id)).toEqual(["variant.glow"]);
		const withoutGlow = stripBlocks(text);
		// with the marked lines removed, button.tsx is the declared colour exception, byte for byte
		expect(m.files["button.tsx"]).toMatchObject({ state: "declared" });
		expect(sha256(withoutGlow)).toBe((m.files["button.tsx"] as { sha256: string }).sha256);
		// the marked lines are exactly the recorded ones, and nothing else sits outside the declared exception
		expect(blocks[0]?.body).toEqual(m.variants["button.tsx"]?.[0]?.body);
		expect(text.split("\n").length - withoutGlow.split("\n").length).toBe(blocks[0]!.body.length + 2);
	});

	test("control: an upstream overwrite that drops the glow variant fails the checker", () => {
		// an overwrite restores the stock file; with the glow block removed the colour sha still matches, so the
		// variant check is what must turn the gate red
		const dropped = new Map(files);
		dropped.set("button.tsx", stripBlocks(files.get("button.tsx") as string));
		expect(checkLock(dropped, m).some((f) => f.includes("button.tsx") && /variant/.test(f))).toBe(true);
	});

	test("control: a marker with no end fails the checker", () => {
		const broken = new Map(files);
		broken.set("button.tsx", (files.get("button.tsx") as string).replace("// bg2:variant end", ""));
		expect(checkLock(broken, m).length).toBeGreaterThan(0);
	});
});
