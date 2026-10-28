// Internal link checker over dist/. Local hrefs and srcs must resolve to a file in dist, and a
// #fragment must match an id on the target page. External links are listed, never fetched.
import { join } from "node:path";

export interface Broken {
	from: string;
	href: string;
	reason: string;
}

export interface LinkResult {
	pages: number;
	internal: number;
	broken: Broken[];
	external: string[];
}

const REF = /\s(?:href|src)="([^"]*)"/g;
const ID = /\sid="([^"]*)"/g;
const EXTERNAL = /^(?:https?:|mailto:|tel:|data:)/i;

export function refsOf(html: string): string[] {
	return [...html.matchAll(REF)].map((m) => m[1] ?? "");
}

export function idsOf(html: string): Set<string> {
	return new Set([...html.matchAll(ID)].map((m) => m[1] ?? ""));
}

/** dist/posts/effect-gen/index.html is served at /posts/effect-gen/. */
function routeOf(file: string): string {
	if (file === "index.html") return "/";
	if (file.endsWith("/index.html"))
		return `/${file.slice(0, -"index.html".length)}`;
	return `/${file}`;
}

/** The dist-relative file a served path maps to, or undefined when the path cannot be a file. */
function fileOf(pathname: string): string {
	const path = decodeURIComponent(pathname).replace(/^\//, "");
	return path === "" || path.endsWith("/") ? `${path}index.html` : path;
}

/** origin: the site's own origin; absolute links to it are checked like local paths. */
export function checkLinks(
	pages: Map<string, string>,
	assets: Set<string>,
	origin = "",
): LinkResult {
	const ids = new Map(
		[...pages].map(([file, html]) => [file, idsOf(html)] as const),
	);
	const broken: Broken[] = [];
	const external: string[] = [];
	let internal = 0;

	for (const [file, html] of pages) {
		const here = routeOf(file);
		for (const href of refsOf(html)) {
			const local =
				origin !== "" && href.startsWith(origin)
					? href.slice(origin.length) || "/"
					: href;
			if (EXTERNAL.test(local)) {
				external.push(href);
				continue;
			}
			internal++;
			const hash = local.indexOf("#");
			const pathPart = hash === -1 ? local : local.slice(0, hash);
			const fragment = hash === -1 ? "" : local.slice(hash + 1);
			const target =
				pathPart === ""
					? here
					: new URL(pathPart, `https://local${here}`).pathname;
			const targetFile = fileOf(target);
			if (!pages.has(targetFile) && !assets.has(targetFile)) {
				broken.push({
					from: file,
					href,
					reason: `no file ${targetFile} in dist`,
				});
				continue;
			}
			if (fragment !== "" && pages.has(targetFile)) {
				const wanted = decodeURIComponent(fragment);
				if (!ids.get(targetFile)?.has(wanted)) {
					broken.push({
						from: file,
						href,
						reason: `no id "${wanted}" on ${targetFile}`,
					});
				}
			}
		}
	}
	return { pages: pages.size, internal, broken, external };
}

if (import.meta.main) {
	const dist = join(import.meta.dir, "..", "dist");
	const pages = new Map<string, string>();
	const assets = new Set<string>();
	for await (const rel of new Bun.Glob("**/*").scan({ cwd: dist })) {
		if (rel.endsWith(".html"))
			pages.set(rel, await Bun.file(join(dist, rel)).text());
		else assets.add(rel);
	}
	const config = await Bun.file(
		join(import.meta.dir, "..", "astro.config.mjs"),
	).text();
	const origin =
		/site:\s*"([^"]+)"/.exec(config)?.[1]?.replace(/\/$/, "") ?? "";
	const result = checkLinks(pages, assets, origin);
	for (const line of result.external)
		console.log(`external (not fetched): ${line}`);
	if (result.broken.length > 0) {
		for (const b of result.broken)
			console.error(`BROKEN ${b.from} -> ${b.href}: ${b.reason}`);
		console.error(
			`links failed pages=${result.pages} internal=${result.internal} broken=${result.broken.length}`,
		);
		process.exit(1);
	}
	console.log(
		`links ok pages=${result.pages} internal=${result.internal} broken=0`,
	);
}
