// The portfolio as a card grid. The cards, chips and buttons are the theme package's own stock components
// (@gjuoun/bigface-shadcn-ui); this file only arranges them. Pages use it without a client:* directive, so it
// renders to static HTML at build time and no React runtime reaches the browser.
import { Badge } from "@gjuoun/bigface-shadcn-ui/components/ui/badge";
import { Button } from "@gjuoun/bigface-shadcn-ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@gjuoun/bigface-shadcn-ui/components/ui/card";

// The site's keyboard focus: a solid outline around the stock button, as on every other link.
const FOCUS =
	"focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-solid focus-visible:outline-foreground";

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
		<ul className="not-prose grid list-none grid-cols-1 gap-4 md:grid-cols-2">
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
											<Badge variant="outline">{tech}</Badge>
										</li>
									))}
								</ul>
							</CardContent>
						)}
						<CardFooter className="mt-auto">
							{project.url || project.repo ? (
								<div className="flex flex-wrap gap-2">
									{project.url && (
										<Button
											asChild
											className={`${FOCUS} motion-reduce:transition-none motion-reduce:duration-0`}
										>
											<a href={project.url}>Visit</a>
										</Button>
									)}
									{project.repo && (
										<Button
											asChild
											variant="outline"
											className={`${FOCUS} text-foreground motion-reduce:transition-none motion-reduce:duration-0`}
										>
											<a href={project.repo}>Source</a>
										</Button>
									)}
								</div>
							) : (
								<p className="m-0 flex min-h-9 items-center text-sm text-muted-foreground">
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
