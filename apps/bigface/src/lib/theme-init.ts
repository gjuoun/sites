import { MODE_STORAGE_KEY, MODES, THEME_STORAGE_KEY } from "@gjuoun/bigface-ui/lib/themes";

// The site's pre-paint theme script. It is the registry's script narrowed to the themes this site still
// serves, so a stored id for a retired theme (game) is ignored here rather than applied.
const SITE_THEMES = ["console"] as const;

export const siteThemeInitScript = [
	"(() => {",
	"  const themes = " + JSON.stringify(SITE_THEMES) + ";",
	"  const modes = " + JSON.stringify([...MODES]) + ";",
	"  try {",
	"    const t = localStorage.getItem(" + JSON.stringify(THEME_STORAGE_KEY) + ");",
	"    const m = localStorage.getItem(" + JSON.stringify(MODE_STORAGE_KEY) + ");",
	"    if (t && themes.includes(t)) document.documentElement.dataset.theme = t;",
	"    if (m && modes.includes(m)) document.documentElement.dataset.mode = m;",
	"  } catch (e) {",
	"    /* storage blocked: keep the server-rendered attributes */",
	"  }",
	"})();",
].join("\n");
