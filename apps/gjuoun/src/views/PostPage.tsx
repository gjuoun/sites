import { type LessonLink, LessonNav } from "../components/LessonNav";
import { Markdown } from "../components/Markdown";
import { Page } from "../components/Page";

export function PostPage({
	title,
	summary,
	html,
	kicker,
	prev,
	next,
}: {
	title: string;
	summary: string;
	html: string;
	kicker?: string;
	prev?: LessonLink;
	next?: LessonLink;
}) {
	return (
		<Page>
			<article>
				{kicker && (
					<p className="kicker not-prose text-[0.85rem] text-muted-foreground">
						{kicker}
					</p>
				)}
				<h1>{title}</h1>
				<p>{summary}</p>
				<Markdown html={html} />
			</article>
			<LessonNav label="Lesson navigation" back={prev} forward={next} />
		</Page>
	);
}
