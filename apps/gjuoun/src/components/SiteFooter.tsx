import { Link } from "./Link";

export function SiteFooter({ starter = false }: { starter?: boolean }) {
	return (
		<footer className="mx-auto mt-12 max-w-[calc(68ch+2rem)] px-4 pb-4 print:hidden">
			<p>
				© {new Date().getFullYear()} Jun Guo ·{" "}
				<Link variant="plain" href="/rss.xml">
					RSS
				</Link>
			</p>
			{starter && (
				<p className="starter-note mt-1 text-[0.85rem] text-muted-foreground">
					Starter copy: written to be reviewed and replaced.
				</p>
			)}
		</footer>
	);
}
