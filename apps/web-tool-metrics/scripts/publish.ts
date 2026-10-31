// scripts/publish.ts — copy the static build into the web-tool service.
//
// This is the only cross-repo seam: the dashboard is built in the sites workspace (it
// needs the private bigface packages) and served by apps/web-tool at /ui/.
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const dist = resolve(import.meta.dir, "..", "dist");
const target =
	process.env.WEB_TOOL_UI_DIR ??
	join(
		homedir(),
		"code",
		"gjuoun",
		"june-agent",
		"apps",
		"web-tool",
		"public",
		"ui",
	);

async function countFiles(dir: string): Promise<number> {
	const entries = await readdir(dir, { withFileTypes: true });
	let total = 0;
	for (const entry of entries) {
		total += entry.isDirectory() ? await countFiles(join(dir, entry.name)) : 1;
	}
	return total;
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(dist, target, { recursive: true });

console.log(`published ${await countFiles(target)} files to ${target}`);
