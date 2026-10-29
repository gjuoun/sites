import { cn } from "cn";
import { Link } from "./Link";

export interface PostItem {
	href: string;
	title: string;
	summary: string;
	order?: number;
	kicker?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

// Lessons: a numbered list in series order. One grid per row: a fixed ordinal track, then the label, title and
// summary share one text track.
export function PostList({
	items,
	numbered = false,
}: {
	items: PostItem[];
	numbered?: boolean;
}) {
	return (
		<ol
			className={cn(
				numbered ? "lesson-list" : "post-list",
				"not-prose list-none",
			)}
		>
			{items.map((item) => (
				<li
					key={item.href}
					className={cn(
						"border-t border-border py-3",
						numbered && "grid grid-cols-[2.5ch_minmax(0,1fr)] gap-x-2",
					)}
				>
					{numbered && item.order !== undefined && (
						<span className="ordinal font-mono text-foreground tabular-nums">
							{pad(item.order)}
						</span>
					)}
					<div>
						{item.kicker && (
							<p className="kicker text-[0.85rem] text-muted-foreground">
								{item.kicker}
							</p>
						)}
						<Link href={item.href}>{item.title}</Link>
						<p className="summary mt-[0.15rem]">{item.summary}</p>
					</div>
				</li>
			))}
		</ol>
	);
}
