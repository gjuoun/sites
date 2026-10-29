import { expect, test } from "bun:test";
import { highlightCode, loadHighlighter } from "./highlighter.tsx";

test("a listed language highlights: one line of token spans for one line of code", async () => {
	const lines = await highlightCode("const a = 1", "ts");
	expect(lines).not.toBeNull();
	expect(lines?.length).toBe(1);
	expect((lines?.[0] as unknown[]).length).toBeGreaterThan(1);
});

test("an unlisted language returns null instead of throwing", async () => {
	expect(await loadHighlighter("cobol")).toBeNull();
});
