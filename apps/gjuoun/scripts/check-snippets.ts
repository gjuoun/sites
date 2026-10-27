// Typechecks every ts block in the posts against the pinned effect version.
// Each run writes its snippets to .snippets/<name>/ and compiles them with tsconfig.snippets.json.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface Snippet {
	readonly id: string;
	readonly code: string;
}

export interface CheckResult {
	readonly blocks: number;
	readonly errors: number;
	readonly output: string;
}

/** The body of every \`\`\`ts fence in a markdown document, in order. */
export function extractTsBlocks(markdown: string): string[] {
	const blocks: string[] = [];
	const fence = /^\`\`\`ts[ \t]*\n([\s\S]*?)^\`\`\`[ \t]*$/gm;
	for (const match of markdown.matchAll(fence)) blocks.push(match[1] ?? "");
	return blocks;
}

/** Compiles the snippets in an isolated directory under appRoot and counts TypeScript errors. */
export async function checkSnippets(appRoot: string, name: string, snippets: Snippet[]): Promise<CheckResult> {
	const dir = join(appRoot, ".snippets", name);
	await rm(dir, { recursive: true, force: true });
	await mkdir(dir, { recursive: true });
	for (const s of snippets) await writeFile(join(dir, `${s.id}.ts`), s.code);
	await writeFile(
		join(dir, "tsconfig.json"),
		JSON.stringify({ extends: "../../tsconfig.snippets.json", include: ["./*.ts"] }, null, 2),
	);
	const proc = Bun.spawn(["bun", "x", "tsc", "--noEmit", "-p", join(dir, "tsconfig.json")], {
		cwd: appRoot,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [out, err, code] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	const output = out + err;
	const counted = (output.match(/error TS\d+/g) ?? []).length;
	return { blocks: snippets.length, errors: Math.max(counted, code === 0 ? 0 : 1), output };
}

/** Reads every post under src/content/posts and returns its ts blocks as snippets. */
export async function postSnippets(appRoot: string): Promise<{ posts: number; snippets: Snippet[] }> {
	const snippets: Snippet[] = [];
	let posts = 0;
	const glob = new Bun.Glob("**/*.md");
	for await (const rel of glob.scan({ cwd: join(appRoot, "src/content/posts") })) {
		posts++;
		const text = await readFile(join(appRoot, "src/content/posts", rel), "utf8");
		const slug = /^slug:\s*"?([^"\n]+)"?\s*$/m.exec(text)?.[1] ?? rel;
		extractTsBlocks(text).forEach((code, i) => snippets.push({ id: `${slug}-${i + 1}`, code }));
	}
	return { posts, snippets };
}

if (import.meta.main) {
	const appRoot = join(import.meta.dir, "..");
	const { posts, snippets } = await postSnippets(appRoot);
	const result = await checkSnippets(appRoot, "posts", snippets);
	if (result.errors === 0) {
		console.log(`snippets ok posts=${posts} blocks=${result.blocks} errors=0`);
	} else {
		console.error(result.output);
		console.error(`snippets failed posts=${posts} blocks=${result.blocks} errors=${result.errors}`);
		process.exit(1);
	}
}
