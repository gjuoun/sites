import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { renderToStaticMarkup } from "react-dom/server";

// The DOM attributes are the store. These tests drive them the way the browser would: a stored value
// before the init script runs, a hover of another tab's storage event, and a plain attribute write.
beforeEach(async () => {
	if (!(globalThis as { happyDOM?: unknown }).happyDOM)
		GlobalRegistrator.register();
	// React only calls act() without complaint when it knows this is a test environment.
	(
		globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
	).IS_REACT_ACT_ENVIRONMENT = true;
	document.documentElement.removeAttribute("data-theme");
	document.documentElement.removeAttribute("data-mode");
	localStorage.clear();
});
afterEach(() => localStorage.clear());

const runInit = async (stored: { theme?: string; mode?: string }) => {
	const { themeInitScript } = await import("../lib/themes.ts");
	if (stored.theme) localStorage.setItem("bigface-theme", stored.theme);
	if (stored.mode) localStorage.setItem("bigface-mode", stored.mode);
	// biome-ignore lint: the script is a string built for a <script> tag; running it IS the test
	new Function(themeInitScript)();
};

describe("themeInitScript", () => {
	test("a stored theme and mode are applied before first paint", async () => {
		await runInit({ theme: "business", mode: "light" });
		expect(document.documentElement.dataset.theme).toBe("business");
		expect(document.documentElement.dataset.mode).toBe("light");
	});

	test("a stale or hand-edited value is ignored, not applied", async () => {
		document.documentElement.dataset.theme = "console";
		await runInit({ theme: "neon", mode: "sepia" });
		expect(document.documentElement.dataset.theme).toBe("console");
		expect(document.documentElement.dataset.mode).toBeUndefined();
	});

	test("the script carries every registry id, so a new theme needs no script change", async () => {
		const { themeInitScript } = await import("../lib/themes.ts");
		const { THEMES } = await import("../themes/roles.ts");
		for (const t of THEMES) expect(themeInitScript).toContain('"' + t.id + '"');
	});
});

describe("useTheme / useMode", () => {
	test("setTheme writes the attribute and the storage key", async () => {
		const { act, createElement } = await import("react");
		const { createRoot } = await import("react-dom/client");
		const { useTheme } = await import("./use-theme.ts");
		let api: ReturnType<typeof useTheme> | undefined;
		const Probe = () => {
			api = useTheme();
			return null;
		};
		const root = createRoot(document.createElement("div"));
		await act(async () => root.render(createElement(Probe)));
		await act(async () => api?.setTheme("business"));
		expect(document.documentElement.dataset.theme).toBe("business");
		expect(localStorage.getItem("bigface-theme")).toBe("business");
		await act(async () => root.unmount());
	});

	test("an attribute written elsewhere re-renders every hook instance", async () => {
		const { act, createElement } = await import("react");
		const { createRoot } = await import("react-dom/client");
		const { useTheme } = await import("./use-theme.ts");
		const seen: string[] = [];
		const Probe = () => {
			const { theme } = useTheme();
			seen.push(theme);
			return createElement("span", null, theme);
		};
		const host = document.createElement("div");
		document.body.append(host);
		const root = createRoot(host);
		await act(async () => root.render(createElement(Probe)));
		await act(async () => {
			document.documentElement.dataset.theme = "game";
			await new Promise((r) => setTimeout(r, 0));
		});
		expect(host.textContent).toBe("game");
		expect(seen).toContain("game");
		await act(async () => root.unmount());
	});
});
