import { getCollection } from "astro:content";
import { publishedPosts } from "./content-rules";

/** Posts that may render: the collection with drafts removed. */
export async function livePosts() {
	return publishedPosts(
		await getCollection("posts"),
		(entry) => entry.data.draft,
	);
}
