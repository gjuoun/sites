import * as React from "react";

// Mounts its children once the placeholder is in the UPPER part of the screen (the top 60%), never before. Why it
// exists: a stock component that scrolls its own selected item into view on mount (cmdk does, in the Command demo)
// would otherwise move the whole page to that item at load, which put the control rows far above the viewport.
// Mounted in the upper part, the item is already on screen, so the component's own scroll does nothing and the
// reader sees no movement. The placeholder keeps the demo's height, so the page does not shift when it mounts.
export function InView({ kind, minHeight, children }: { kind: string; minHeight: string; children: React.ReactNode }) {
	const ref = React.useRef<HTMLDivElement>(null);
	const [on, setOn] = React.useState(false);
	React.useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (typeof IntersectionObserver === "undefined") {
			setOn(true);
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) {
					setOn(true);
					io.disconnect();
				}
			},
			{ rootMargin: "0px 0px -40% 0px" },
		);
		io.observe(el);
		return () => io.disconnect();
	}, []);
	return (
		<div ref={ref} data-lazy-trigger={kind} data-mounted={on ? "true" : "false"} style={on ? undefined : { minHeight }}>
			{on ? children : null}
		</div>
	);
}
