import { Page } from "../components/Page";
import { type PostItem, PostList } from "../components/PostList";

export interface SeriesGroup {
	title: string;
	lessons: PostItem[];
}

// Each series under its title, lessons numbered in order; then the standalone posts, newest first.
export function PostsPage({
	series,
	standalone,
}: {
	series: SeriesGroup[];
	standalone: PostItem[];
}) {
	return (
		<Page>
			<h1>Posts</h1>
			{series.map((s, i) => (
				<section key={s.title} aria-labelledby={`series-${i + 1}`}>
					<h2 id={`series-${i + 1}`}>{s.title}</h2>
					<PostList numbered items={s.lessons} />
				</section>
			))}
			{standalone.length > 0 && (
				<section aria-labelledby="standalone-heading">
					<h2 id="standalone-heading">Standalone posts</h2>
					<PostList items={standalone} />
				</section>
			)}
		</Page>
	);
}
