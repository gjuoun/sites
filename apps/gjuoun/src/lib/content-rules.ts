// Pure content rules, kept free of astro:content so bun test can run them directly.

export const PROJECT_STATUSES = ["public", "private", "archived"] as const;

export interface PostLike {
	slug: string;
	draft: boolean;
	series?: string;
	order?: number;
}

export interface ProjectLike {
	slug: string;
	status: string;
	url?: string;
	repo?: string;
}

export interface ContentSet {
	posts: PostLike[];
	projects: ProjectLike[];
}

/** Returns one human-readable line per violated rule. An empty array means the content is valid. */
export function checkContent(content: ContentSet): string[] {
	const violations: string[] = [];

	const seen = new Map<string, string>();
	const claim = (slug: string, kind: string) => {
		const prior = seen.get(slug);
		if (prior)
			violations.push(`duplicate slug "${slug}" (${prior} and ${kind})`);
		else seen.set(slug, kind);
	};
	for (const p of content.posts) claim(p.slug, "post");

	// A series is the posts that share a series title; their order must be 1..n.
	const bySeries = new Map<string, number[]>();
	for (const p of content.posts) {
		if (p.series === undefined) continue;
		const orders = bySeries.get(p.series) ?? [];
		orders.push(p.order ?? Number.NaN);
		bySeries.set(p.series, orders);
	}
	for (const [series, orders] of bySeries) {
		const sorted = [...orders].sort((a, b) => a - b);
		const contiguous = sorted.every((value, i) => value === i + 1);
		if (!contiguous) {
			violations.push(
				`series "${series}" order must be 1..${orders.length} with no gaps, got [${sorted.join(", ")}]`,
			);
		}
	}

	for (const project of content.projects) {
		if (!(PROJECT_STATUSES as readonly string[]).includes(project.status)) {
			violations.push(
				`project "${project.slug}" has invalid status "${project.status}"`,
			);
		}
		if (project.status === "public" && !project.url && !project.repo) {
			violations.push(`public project "${project.slug}" needs a url or a repo`);
		}
	}

	return violations;
}

/** Posts that may render on the site: drafts are dropped. */
export function publishedPosts<P>(
	posts: P[],
	isDraft: (p: P) => boolean = (p) => (p as { draft?: boolean }).draft === true,
): P[] {
	return posts.filter((p) => !isDraft(p));
}
