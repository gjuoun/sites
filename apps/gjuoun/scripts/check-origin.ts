// Origin gate over dist/. The site origin comes from astro.config.mjs and is the only host the site
// names for itself: canonical, og:url, sitemap, rss and robots must use it, and the built output may
// name no other host except the declared external ones. "gqntt" never appears in the output.
import { join } from "node:path";

/** External hosts the content links to (project pages, the repo, the profile), plus XML namespace identifiers and the licence comment in the compiled stylesheet, which are not requests. */
export const EXTERNAL_HOSTS: readonly string[] = [
	"github.com",
	"linkedin.com",
	"tailwindcss.com", // the licence comment Tailwind writes at the top of the compiled stylesheet; not a request
	"qublack.qqntt.com",
	"bigface.qqntt.com",
	"subsdaddy.qqntt.com",
	"bundant.qqntt.com",
	"www.w3.org",
	"www.sitemapprotocol.org",
];

const TEXT_FILE = /\.(?:html|xml|txt|css|js|svg)$/;
const ABSOLUTE_URL = /https?:\/\/([^/"'\s<>()\\]+)/g;
const SELF_FIELDS: RegExp[] = [
	/<link rel="canonical" href="([^"]+)"/g,
	/<meta property="og:url" content="([^"]+)"/g,
	/<loc>([^<]+)<\/loc>/g,
	/<link>(https?:[^<]+)<\/link>/g,
	/<atom:link href="([^"]+)"/g,
	/^Sitemap: (\S+)/gm,
];

/** Hostnames of every absolute http(s) url in a text file. */
export function hostsIn(text: string): string[] {
	return [...text.matchAll(ABSOLUTE_URL)].map((m) =>
		(m[1] ?? "").toLowerCase(),
	);
}

/** The self-referencing urls a file publishes: canonical, og:url, sitemap locs, rss links, robots Sitemap. */
export function selfUrlsIn(text: string): string[] {
	return SELF_FIELDS.flatMap((re) =>
		[...text.matchAll(re)].map((m) => m[1] ?? ""),
	);
}

/** Every violation in the built text files, one line each. An empty list means the origin gate passes. */
export function originViolations(
	files: Map<string, string>,
	origin: URL,
): string[] {
	const host = origin.host.toLowerCase();
	const allowed = new Set([host, ...EXTERNAL_HOSTS]);
	const out: string[] = [];
	let selfUrls = 0;
	for (const [rel, text] of files) {
		if (/gqntt/i.test(text)) out.push(`${rel} contains "gqntt"`);
		for (const u of selfUrlsIn(text)) {
			selfUrls++;
			if (new URL(u).host.toLowerCase() !== host)
				out.push(`${rel} self url ${u} is not on ${host}`);
		}
		for (const h of new Set(hostsIn(text)))
			if (!allowed.has(h))
				out.push(
					`${rel} names host ${h}, not the origin or a declared external host`,
				);
	}
	if (selfUrls === 0)
		out.push("no self-referencing url found in the built output");
	return out;
}

if (import.meta.main) {
	const root = join(import.meta.dir, "..");
	const dist = join(root, "dist");
	const config = await Bun.file(join(root, "astro.config.mjs")).text();
	const site = /site:\s*"([^"]+)"/.exec(config)?.[1] ?? "";
	if (site === "") throw new Error("astro.config.mjs has no site");
	const origin = new URL(site);

	const files = new Map<string, string>();
	for await (const rel of new Bun.Glob("**/*").scan({ cwd: dist })) {
		if (TEXT_FILE.test(rel))
			files.set(rel, await Bun.file(join(dist, rel)).text());
	}
	const problems = originViolations(files, origin);
	if (problems.length > 0) {
		for (const p of problems) console.error(`ORIGIN ${p}`);
		console.error(`origin failed origin=${origin.host} files=${files.size}`);
		process.exit(1);
	}
	const hosts = new Set<string>();
	for (const text of files.values())
		for (const h of hostsIn(text)) hosts.add(h);
	console.log(
		`origin ok origin=${origin.host} files=${files.size} hosts=${[...hosts].sort().join(",")}`,
	);
}
