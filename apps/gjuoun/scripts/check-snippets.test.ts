import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { checkSnippets, extractTsBlocks, postSnippets } from "./check-snippets";

const appRoot = join(import.meta.dir, "..");

describe("extractTsBlocks", () => {
	test("returns only ts fences, in order", () => {
		const md = [
			"intro",
			"",
			"```ts",
			"const a = 1;",
			"```",
			"",
			"```sh",
			"echo no",
			"```",
			"",
			"```ts",
			"const b = 2;",
			"```",
		].join("\n");
		expect(extractTsBlocks(md)).toEqual(["const a = 1;\n", "const b = 2;\n"]);
	});
});

describe("checkSnippets", () => {
	test("a wrong Effect.catchTag tag fails the check", async () => {
		const fixture = [
			'import { Effect } from "effect";',
			'type E = { readonly _tag: "Other" };',
			'const f: Effect.Effect<number, E> = Effect.fail({ _tag: "Other" });',
			'export const g = f.pipe(Effect.catchTag("Nope", () => Effect.succeed(1)));',
			"",
		].join("\n");
		const result = await checkSnippets(appRoot, "fixture", [
			{ id: "wrong-tag", code: fixture },
		]);
		expect(result.errors).toBeGreaterThan(0);
	}, 60_000);

	test("the real posts typecheck against effect 4.0.4", async () => {
		const { posts, snippets } = await postSnippets(appRoot);
		expect(posts).toBe(6);
		const result = await checkSnippets(appRoot, "posts", snippets);
		expect(result.output).toBe("");
		expect(result.errors).toBe(0);
		expect(result.blocks).toBe(6);
	}, 120_000);
});
