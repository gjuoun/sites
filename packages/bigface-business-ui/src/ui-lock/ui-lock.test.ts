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
	test("the glow variant is the reference rim: plain primary fill at rest, a 1px hover rim over the fill edge, and a hover lift", () => {
		const glow = buttonVariants({ variant: "glow" }).split(/\s+/);
		// rest: the plain primary fill with on-primary ink, no gradient and no shadow
		expect(glow).toContain("bg-primary");
		expect(glow).toContain("text-primary-foreground");
		expect(glow.some((c) => /^shadow-|bg-linear-135/.test(c))).toBe(false);
		// the rim is a pseudo-element over the padding box, faded in on hover (it must be the border-box edge, not a halo)
		for (const c of ["relative", "before:absolute", "before:inset-0", "before:p-px", "before:opacity-0", "hover:before:opacity-100"]) expect(glow, c).toContain(c);
		// the reference card gradient: 140deg, blue at 55 percent, lime at 12 percent at 45 percent, transparent at 70 percent
		for (const c of ["before:bg-linear-140/srgb", "before:from-[var(--theme-blue)]/55", "before:via-[var(--theme-lime)]/12", "before:via-45%", "before:to-transparent", "before:to-70%"]) expect(glow, c).toContain(c);
		// the hairline: the content box is excluded from the padding box, so only the 1px ring paints
		expect(glow).toContain("before:[mask-composite:exclude]");
		expect(glow).toContain("before:[mask-clip:content-box,border-box]");
		// hover lifts the button 2px and keeps the fill (no hover colour change)
		expect(glow).toContain("hover:-translate-y-0.5");
		expect(glow).toContain("hover:bg-primary");
		// no new custom property: every var() the variant reads is one the theme already declares
		const used = [...buttonVariants({ variant: "glow" }).matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]);
		const declared = readFileSync(join(import.meta.dir, "../themes/business.css"), "utf8");
		for (const name of new Set(used)) expect(declared, name).toContain(name + ":");
		expect(new Set(used)).toEqual(new Set(["--theme-blue", "--theme-lime"]));
		// the stock default keeps no rim
		expect(buttonVariants({ variant: "default" })).not.toContain("before:absolute");
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
