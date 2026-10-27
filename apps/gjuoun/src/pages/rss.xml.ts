import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getCollection } from "astro:content";
import { publishedPosts } from "../lib/content-rules";

export async function GET(context: APIContext) {
	const posts = publishedPosts(await getCollection("posts")).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
	return rss({
		title: "Jun Guo — posts",
		description: "Numbered posts by Jun Guo.",
		site: context.site ?? "https://jun.qqntt.com",
		items: posts.map((p) => ({
			title: p.data.title,
			pubDate: p.data.date,
			description: p.data.summary,
			link: `/posts/${p.data.slug}/`,
		})),
	});
}
