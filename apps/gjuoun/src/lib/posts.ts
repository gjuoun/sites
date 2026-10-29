import type { CollectionEntry } from "astro:content";
import type { PostItem } from "../components/PostList";

type Post = CollectionEntry<"posts">;

export const postHref = (slug: string) => `/posts/${slug}/`;
export const pad = (n: number | undefined) => String(n ?? 0).padStart(2, "0");

/** A post as a list row. */
export const toPostItem = (p: Post, kicker?: string): PostItem => ({
	href: postHref(p.data.slug),
	title: p.data.title,
	summary: p.data.summary,
	order: p.data.order,
	kicker,
});

/** The lessons of one series, in series order. */
export const lessonsOf = (posts: Post[], series: string) =>
	posts
		.filter((p) => p.data.series === series)
		.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));

/** Newest first. Ties keep series order, so a course with one date starts at lesson 1. */
export const newestFirst = (posts: Post[]) =>
	posts
		.slice()
		.sort(
			(a, b) =>
				b.data.date.valueOf() - a.data.date.valueOf() ||
				(a.data.order ?? 0) - (b.data.order ?? 0),
		);
