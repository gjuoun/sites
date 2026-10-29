import { ButtonLink } from "../components/ButtonLink";
import { Intro } from "../components/Intro";
import { Page } from "../components/Page";
import { type PostItem, PostList } from "../components/PostList";
import { type GridProject, ProjectGrid } from "../components/ProjectGrid";

export function HomePage({
	projects,
	latest,
}: {
	projects: GridProject[];
	latest: PostItem[];
}) {
	return (
		<Page>
			<h1>Jun Guo</h1>
			<section aria-labelledby="intro-heading">
				<h2 id="intro-heading" className="sr-only">
					Introduction
				</h2>
				<Intro />
			</section>
			<section aria-labelledby="portfolio-heading">
				<h2 id="portfolio-heading">Portfolio</h2>
				<ProjectGrid projects={projects} />
			</section>
			{/* The posts are set off from the portfolio above them. */}
			<section
				className="mt-10 border-t-2 border-border pt-6 [&>h2]:mt-0"
				aria-labelledby="posts-heading"
			>
				<h2 id="posts-heading">Posts</h2>
				<PostList numbered items={latest} />
				<p className="not-prose mt-4">
					<ButtonLink variant="outline" href="/posts/" label="All posts" />
				</p>
			</section>
		</Page>
	);
}
