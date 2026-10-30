import { MODE_STORAGE_KEY, MODES, type Mode } from "@gjuoun/bigface-business-ui/lib/themes";

/** bundant is a dark product page: the product surface, not the marketing paper. */
export const DEFAULT_MODE: Mode = "dark";

/**
 * The docs shell belongs to Starlight: its `Page.astro` hardcodes `data-theme` and writes no
 * `data-mode`, so the package's pre-paint script cannot carry the contract there on its own.
 * This adapter pins the theme id, applies a stored mode (default: dark) and keeps
 * `color-scheme` in step so `light-dark()` resolves correctly before the first paint.
 */
export const docsThemeInitScript = `(() => {
	const root = document.documentElement;
	root.dataset.theme = "business";
	let mode = ${JSON.stringify(DEFAULT_MODE)};
	try {
		const stored = localStorage.getItem(${JSON.stringify(MODE_STORAGE_KEY)});
		if (${JSON.stringify([...MODES])}.includes(stored)) mode = stored;
	} catch (e) {
		/* storage blocked: keep the default mode */
	}
	root.dataset.mode = mode;
	root.style.colorScheme = mode;
})();`;
