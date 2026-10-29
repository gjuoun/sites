import { type LessonLink, LessonNav } from "../components/LessonNav";
import { Markdown } from "../components/Markdown";
import { Page } from "../components/Page";
import { type PostItem, PostList } from "../components/PostList";

export function SeriesPage({
	title,
	summary,
	html,
	lessons,
	first,
}: {
	title: string;
	summary: string;
	html: string;
	lessons: PostItem[];
	first?: LessonLink;
}) {
	return (
		<Page>
			<h1>{title}</h1>
			<p>{summary}</p>
			<Markdown html={html} />
			<h2>Lessons</h2>
			<PostList numbered items={lessons} />
			<LessonNav
				label="Series navigation"
				back={{ href: "/posts/", label: "← All posts" }}
				forward={first}
			/>
		</Page>
	);
}
