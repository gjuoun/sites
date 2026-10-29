import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
	{ href: "/", label: "Home" },
	{ href: "/projects/", label: "Portfolio" },
	{ href: "/posts/", label: "Posts" },
	{ href: "/resume/", label: "Resume" },
];

// "page" marks the current page. "true" marks a parent of the current page, so a lesson under /posts/ lights up Posts.
function current(path: string, href: string): "page" | "true" | undefined {
	if (href === "/") return path === "/" ? "page" : undefined;
	if (path === href) return "page";
	return path.startsWith(href) ? "true" : undefined;
}

// Narrow screens: the nav and the toggle share one row. Very narrow (23.5rem): the nav scrolls in its own track.
export function SiteHeader({ path }: { path: string }) {
	return (
		<header className="site-header mx-auto flex max-w-[calc(68ch+2rem)] flex-wrap items-center justify-between gap-4 p-4 max-sm:flex-nowrap max-sm:gap-2 max-sm:px-4 max-sm:py-3 print:hidden">
			<nav
				aria-label="Primary"
				className="max-[23.5rem]:min-w-0 max-[23.5rem]:overflow-x-auto max-[23.5rem]:[scrollbar-width:none]"
			>
				<ul className="flex list-none gap-4 max-sm:gap-2 max-[23.5rem]:flex-nowrap">
					{LINKS.map((link) => (
						<li key={link.href}>
							<a
								href={link.href}
								aria-current={current(path, link.href)}
								className="inline-block px-[0.6rem] py-1 text-foreground hover:underline hover:decoration-primary hover:decoration-2 hover:underline-offset-[0.2em] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-solid focus-visible:outline-foreground aria-[current]:bg-muted aria-[current]:shadow-[inset_0_-3px_0_var(--foreground)] max-sm:px-[0.45rem] max-sm:py-[0.2rem] max-sm:text-sm max-[23.5rem]:px-[0.35rem] max-[23.5rem]:text-[0.8125rem]"
							>
								{link.label}
							</a>
						</li>
					))}
				</ul>
			</nav>
			<ThemeToggle />
		</header>
	);
}
