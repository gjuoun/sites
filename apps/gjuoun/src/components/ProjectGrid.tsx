// The portfolio as a card grid. The cards, chips and buttons are the theme package's own stock components
// (@gjuoun/bigface-business-ui); this file only arranges them. It is rendered to static HTML at build time
// (renderProjectGrid), so no React runtime reaches the browser.
import { Badge } from "@gjuoun/bigface-business-ui/components/ui/badge";
import { Button } from "@gjuoun/bigface-business-ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@gjuoun/bigface-business-ui/components/ui/card";
import { renderToStaticMarkup } from "react-dom/server";

export interface GridProject {
	name: string;
	summary: string;
	stack: string[];
	url?: string;
	repo?: string;
}

// Two columns from the medium breakpoint, one below it. Every card in a row stretches to the row's height,
// and its footer is pushed to the bottom, so the actions line up across the band.
export function ProjectGrid({ projects }: { projects: GridProject[] }) {
	return (
		<ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
			{projects.map((project) => (
				<li key={project.name} className="flex">
					<Card className="flex-1">
						<CardHeader>
							<CardTitle>
								<h3 className="m-0 text-base font-medium leading-snug">
									{project.name}
								</h3>
							</CardTitle>
							<CardDescription>{project.summary}</CardDescription>
						</CardHeader>
						{project.stack.length > 0 && (
							<CardContent>
								<ul
									className="m-0 flex list-none flex-wrap gap-1.5 p-0"
									aria-label="Stack"
								>
									{project.stack.map((tech) => (
										<li key={tech}>
											<Badge variant="secondary">{tech}</Badge>
										</li>
									))}
								</ul>
							</CardContent>
						)}
						<CardFooter className="mt-auto">
							{project.url || project.repo ? (
								<div className="flex flex-wrap gap-2">
									{project.url && (
										<Button asChild className="motion-reduce:transition-none">
											<a href={project.url}>Visit</a>
										</Button>
									)}
									{project.repo && (
										<Button
											asChild
											variant="outline"
											className="text-foreground motion-reduce:transition-none"
										>
											<a href={project.repo}>Source</a>
										</Button>
									)}
								</div>
							) : (
								<p className="m-0 text-sm text-muted-foreground">
									Private project. No public link.
								</p>
							)}
						</CardFooter>
					</Card>
				</li>
			))}
		</ul>
	);
}

// The grid as an HTML string, for an Astro page to inject. Build-time only: the page ships no script for it.
export function renderProjectGrid(projects: GridProject[]): string {
	return renderToStaticMarkup(<ProjectGrid projects={projects} />);
}
