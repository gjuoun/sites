import * as React from "react";
import { cn } from "@gjuoun/bigface-business-ui/lib/utils";
import { CATEGORIES } from "./_categories.ts";

// The catalogue's navigation. From 1024px it is a sticky column of every section and component; below that, one
// select that moves to the chosen anchor. Both read the same CATEGORIES list, so they cannot drift from the page.
// The active section is the last one whose top has passed the upper third of the screen (a scroll listener, so it
// follows the page both ways).

const TOP = ["colour", "typography"];
const ORDER = [...TOP, ...CATEGORIES.flatMap((c) => c.components.map((k) => k.id))];

function useActive(ids: string[]): string {
	const [active, setActive] = React.useState(ids[0] ?? "");
	React.useEffect(() => {
		const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => e !== null);
		let frame = 0;
		const update = () => {
			frame = 0;
			const line = window.innerHeight * 0.33;
			let current = els[0]?.id ?? "";
			for (const el of els) {
				if (el.getBoundingClientRect().top <= line) current = el.id;
				else break;
			}
			setActive(current);
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(update);
		};
		update();
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll);
		return () => {
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
			if (frame) cancelAnimationFrame(frame);
		};
	}, [ids]);
	return active;
}

function jump(e: React.ChangeEvent<HTMLSelectElement>) {
	if (e.target.value) window.location.hash = e.target.value;
}

const catLink = (on: boolean) =>
	cn("block px-2 py-1 transition-colors", on ? "font-semibold text-foreground" : "font-medium text-muted-foreground hover:text-foreground");

const link = (on: boolean) =>
	cn("block rounded-md px-2 py-1 transition-colors", on ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:text-foreground");

export function Rail() {
	const active = useActive(ORDER);
	const activeCategory = CATEGORIES.find((c) => c.components.some((k) => k.id === active))?.id ?? (active === "" ? "" : active);

	React.useEffect(() => {
		document.querySelector<HTMLElement>('[data-rail="' + active + '"]')?.scrollIntoView({ block: "nearest" });
	}, [active]);

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
			<aside className="hidden lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pb-16">
				<nav aria-label="Catalogue sections" className="flex flex-col gap-3 pr-2 text-sm">
					<a href="#colour" data-rail="colour" aria-current={active === "colour" ? "location" : undefined} className={link(active === "colour")}>Colour</a>
					<a href="#typography" data-rail="typography" aria-current={active === "typography" ? "location" : undefined} className={link(active === "typography")}>Typography</a>
					{CATEGORIES.map((c) => (
						<div key={c.id} className="flex flex-col gap-0.5">
							<a href={"#cat-" + c.id} data-rail={"cat-" + c.id} aria-current={activeCategory === c.id ? "location" : undefined} className={catLink(activeCategory === c.id)}>{c.title}</a>
							<ul className="ml-3 flex flex-col gap-0.5 border-l pl-2">
								{c.components.map((k) => (
									<li key={k.id}>
										<a href={"#" + k.id} data-rail={k.id} aria-current={active === k.id ? "location" : undefined} className={link(active === k.id)}>{k.title}</a>
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
