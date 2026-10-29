import { Page } from "../components/Page";
import { type GridProject, ProjectGrid } from "../components/ProjectGrid";

export function PortfolioPage({ projects }: { projects: GridProject[] }) {
	return (
		<Page>
			<h1>Portfolio</h1>
			<ProjectGrid projects={projects} />
		</Page>
	);
}
