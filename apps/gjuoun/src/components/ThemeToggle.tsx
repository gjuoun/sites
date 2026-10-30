import { MODE_STORAGE_KEY } from "@gjuoun/bigface-shadcn-ui/lib/themes";

// The light/dark switch. It renders as static HTML; the inline script wires the click: it flips data-mode on <html>,
// stores the choice under the package's mode key, and mirrors the state in aria-pressed (which also swaps the icon).
const SCRIPT = `(() => {
	const root = document.documentElement;
	const button = document.getElementById("theme-toggle");
	const sync = () => button.setAttribute("aria-pressed", String(root.dataset.mode === "dark"));
	button.addEventListener("click", () => {
		root.dataset.mode = root.dataset.mode === "dark" ? "light" : "dark";
		try {
			localStorage.setItem(${JSON.stringify(MODE_STORAGE_KEY)}, root.dataset.mode);
		} catch (e) {}
		sync();
	});
	sync();
})();`;

export function ThemeToggle() {
	return (
		<>
			<button
				type="button"
				id="theme-toggle"
				className="group inline-flex min-h-7 min-w-7 cursor-pointer items-center justify-center gap-[0.35rem] border border-border bg-card p-[0.3rem] text-foreground aria-pressed:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-solid focus-visible:outline-foreground max-[23.5rem]:px-[0.4rem] max-[23.5rem]:py-[0.15rem] max-[23.5rem]:text-xs"
				aria-pressed="false"
				aria-label="Dark mode"
			>
				<span className="inline-flex" aria-hidden="true">
					<svg
						aria-hidden="true"
						className="group-aria-pressed:hidden"
						viewBox="0 0 16 16"
						width="16"
						height="16"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
					>
						<path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" />
					</svg>
					<svg
						aria-hidden="true"
						className="hidden group-aria-pressed:inline-block"
						viewBox="0 0 16 16"
						width="16"
						height="16"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
					>
						<circle cx="8" cy="8" r="3" />
						<path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M13 3l-1 1M4 12l-1 1" />
					</svg>
				</span>
			</button>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed script, built from a constant */}
			<script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
		</>
	);
}
