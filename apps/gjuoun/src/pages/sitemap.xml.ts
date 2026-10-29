import type { APIContext } from "astro";
import { livePosts } from "../lib/collections";
import { siteOrigin } from "../lib/seo";

export async function GET(context: APIContext) {
	const site = siteOrigin(context.site);
	const posts = await livePosts();
	const paths = [
		"/",
		"/posts/",
		"/projects/",
		"/resume/",
		...posts.map((p) => `/posts/${p.data.slug}/`),
	];
	const urls = paths
		.map((path) => `  <url><loc>${new URL(path, site).href}</loc></url>`)
		.join("\n");
	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemapprotocol.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
	return new Response(xml, {
		headers: { "Content-Type": "application/xml; charset=utf-8" },
	});
}
