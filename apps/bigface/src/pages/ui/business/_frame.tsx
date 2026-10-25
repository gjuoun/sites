import * as React from "react";

/** A catalogue block: a titled, anchored section with its source line, in the same frame as the components. */
export function Block({ id, title, source, children }: { id: string; title: string; source: string; children: React.ReactNode }) {
	return (
		<section id={id} className="flex scroll-mt-6 flex-col gap-4 border-t border-border pt-8">
			<header className="flex flex-col gap-1">
				<h2 className="text-xl font-semibold text-foreground">{title}</h2>
				<code className="font-mono text-xs text-muted-foreground">{source}</code>
			</header>
			{children}
		</section>
	);
}
