import { Page } from "../components/Page";
import { type PostItem, PostList } from "../components/PostList";

export interface SeriesSummary {
	slug: string;
	title: string;
	summary: string;
	lessons: PostItem[];
}

export function PostsPage({
	series,
	standalone,
}: {
	series: SeriesSummary[];
	standalone: PostItem[];
}) {
	return (
		<Page>
			<h1>Posts</h1>
			{series.map((s) => (
				<section key={s.slug} aria-labelledby={`series-${s.slug}`}>
					<h2 id={`series-${s.slug}`}>
						<a href={`/posts/${s.slug}/`}>{s.title}</a>
					</h2>
					<p>{s.summary}</p>
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
