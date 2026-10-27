import type { APIContext } from "astro";
import { getCollection } from "astro:content";
import { publishedPosts } from "../lib/content-rules";

export async function GET(context: APIContext) {
	const site = context.site ?? new URL("https://jun.qqntt.com");
	const posts = publishedPosts(await getCollection("posts"));
	const series = await getCollection("series");
	const paths = [
		"/",
		"/posts/",
		"/projects/",
		"/resume/",
		...series.map((s) => `/posts/${s.data.slug}/`),
		...posts.map((p) => `/posts/${p.data.slug}/`),
	];
	const urls = paths.map((path) => `  <url><loc>${new URL(path, site).href}</loc></url>`).join("\n");
	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemapprotocol.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
	return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
