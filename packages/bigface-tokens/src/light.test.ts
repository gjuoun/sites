
import { describe, expect, test } from "bun:test";
import { contrastRatio } from "./contrast-math.ts";
import { darkenUntil, MIN_CONTRAST, toOklch } from "./light.ts";

describe("darkenUntil", () => {
	test("the palette yellow on paper clears AA, keeps its hue, and gets darker", () => {
		const paper = "#f8f8f0";
		const out = darkenUntil("#ffeb3b", paper, MIN_CONTRAST);
		expect(contrastRatio(out, paper)).toBeGreaterThanOrEqual(MIN_CONTRAST);
		expect(toOklch(out)[0]).toBeLessThan(toOklch("#ffeb3b")[0]);
		expect(Math.abs(toOklch(out)[2] - toOklch("#ffeb3b")[2])).toBeLessThan(2);
	});

	test("a colour that already clears the floor is returned unchanged", () => {
		expect(darkenUntil("#252925", "#f8f8f0")).toBe("#252925");
	});
});
