import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { livePosts } from "../lib/collections";
import { siteOrigin } from "../lib/seo";

export async function GET(context: APIContext) {
	const posts = (await livePosts()).sort(
		(a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
	);
	return rss({
		title: "Jun Guo — posts",
		description: "Numbered posts by Jun Guo.",
		site: siteOrigin(context.site),
		items: posts.map((p) => ({
			title: p.data.title,
			pubDate: p.data.date,
			description: p.data.summary,
			link: `/posts/${p.data.slug}/`,
		})),
	});
}
