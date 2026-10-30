// The theme registry and the pre-paint init script. The DOM attributes are the store: React never
// owns theme state, it reads and writes \`data-theme\` / \`data-mode\` on <html> (see hooks/use-theme.ts).
import {
	DEFAULT_MODE,
	DEFAULT_THEME,
	MODE_STORAGE_KEY,
	MODES,
	THEME_STORAGE_KEY,
	THEMES,
} from "../themes/roles.ts";

export {
	DEFAULT_MODE,
	DEFAULT_THEME,
	MODE_STORAGE_KEY,
	MODES,
	type Mode,
	THEME_STORAGE_KEY,
	THEMES,
} from "../themes/roles.ts";

export type ThemeId = (typeof THEMES)[number]["id"];
export const isThemeId = (v: string | null | undefined): v is ThemeId =>
	THEMES.some((t) => t.id === v);
export const isMode = (v: string | null | undefined): boolean =>
	(MODES as readonly string[]).includes(v ?? "");

/**
 * Runs before first paint, so a stored theme never flashes the default one. Built from the registry,
 * so adding a theme needs no script change; a stale or hand-edited value is ignored rather than
 * applied. Wrapped in try/catch because storage can be blocked.
 */
export const themeInitScript = [
	"(() => {",
	"  const themes = " + JSON.stringify(THEMES.map((t) => t.id)) + ";",
	"  const modes = " + JSON.stringify([...MODES]) + ";",
	"  try {",
	"    const t = localStorage.getItem(" +
		JSON.stringify(THEME_STORAGE_KEY) +
		");",
	"    const m = localStorage.getItem(" +
		JSON.stringify(MODE_STORAGE_KEY) +
		");",
	"    if (t && themes.includes(t)) document.documentElement.dataset.theme = t;",
	"    if (m && modes.includes(m)) document.documentElement.dataset.mode = m;",
	"  } catch (e) {",
	"    /* storage blocked: keep the server-rendered attributes */",
	"  }",
	"})();",
].join("\n");
