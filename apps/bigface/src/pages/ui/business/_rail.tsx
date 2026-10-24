import * as React from "react";
import { CATEGORIES } from "./_categories.ts";

// The catalogue's navigation. From 1024px it is a sticky column of every section and component, with its own
// scroll; below that it is one select that moves to the chosen anchor. Both read the same CATEGORIES list.

function jump(e: React.ChangeEvent<HTMLSelectElement>) {
	if (e.target.value) window.location.hash = e.target.value;
}

export function Rail() {
	return (
		<>
			<label className="flex flex-col gap-1.5 text-sm lg:hidden">
				<span className="text-muted-foreground">Jump to</span>
				<select aria-label="Jump to a section" defaultValue="" onChange={jump} className="h-9 rounded-md border bg-background px-2 text-sm text-foreground">
					<option value="">Choose a section</option>
					<option value="#colour">Colour</option>
					<option value="#typography">Typography</option>
					{CATEGORIES.map((c) => (
						<optgroup key={c.id} label={c.title}>
							<option value={"#cat-" + c.id}>{c.title}</option>
							{c.components.map((k) => (
								<option key={k.id} value={"#" + k.id}>{"\u00a0\u00a0" + k.title}</option>
							))}
						</optgroup>
					))}
				</select>
			</label>
			<aside className="hidden lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
				<nav aria-label="Catalogue sections" className="flex flex-col gap-4 pr-2 text-sm">
					<a href="#colour" className="font-medium text-foreground">Colour</a>
					<a href="#typography" className="font-medium text-foreground">Typography</a>
					{CATEGORIES.map((c) => (
						<div key={c.id} className="flex flex-col gap-1">
							<a href={"#cat-" + c.id} className="font-medium text-foreground">{c.title}</a>
							<ul className="flex flex-col gap-0.5 border-l pl-3">
								{c.components.map((k) => (
									<li key={k.id}>
										<a href={"#" + k.id} className="text-muted-foreground hover:text-foreground">{k.title}</a>
									</li>
								))}
							</ul>
						</div>
					))}
				</nav>
			</aside>
		</>
	);
}
