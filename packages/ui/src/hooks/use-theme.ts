"use client";
// Theme and mode live in two DOM attributes on <html> — CSS does the work, this file only reads and
// writes them. useSyncExternalStore + MutationObserver means every hook instance updates no matter
// who changed the attribute (a switcher, the init script, devtools, another tab).
import { useCallback, useSyncExternalStore } from "react";
import {
	DEFAULT_MODE,
	DEFAULT_THEME,
	isMode,
	isThemeId,
	MODE_STORAGE_KEY,
	MODES,
	type Mode,
	THEME_STORAGE_KEY,
	THEMES,
	type ThemeId,
} from "../lib/themes.ts";

const read = (attr: "theme" | "mode"): string | undefined =>
	typeof document === "undefined"
		? undefined
		: document.documentElement.dataset[attr];

function subscribe(onChange: () => void): () => void {
	if (typeof document === "undefined") return () => {};
	const observer = new MutationObserver(onChange);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-theme", "data-mode"],
	});
	// the storage event fires only in OTHER tabs: apply it here, the observer notifies React
	const onStorage = (event: StorageEvent) => {
		if (event.key === THEME_STORAGE_KEY && isThemeId(event.newValue)) {
			document.documentElement.dataset.theme = event.newValue;
		}
		if (event.key === MODE_STORAGE_KEY && isMode(event.newValue)) {
			document.documentElement.dataset.mode = event.newValue as Mode;
		}
	};
	window.addEventListener("storage", onStorage);
	return () => {
		observer.disconnect();
		window.removeEventListener("storage", onStorage);
	};
}

const write = (attr: "theme" | "mode", key: string, value: string) => {
	document.documentElement.dataset[attr] = value;
	try {
		localStorage.setItem(key, value);
	} catch {
		/* still applied for this view */
	}
};

export function useTheme() {
	const theme = useSyncExternalStore(
		subscribe,
		() => (read("theme") as ThemeId | undefined) ?? DEFAULT_THEME,
		() => DEFAULT_THEME,
	);
	const setTheme = useCallback(
		(next: ThemeId) => write("theme", THEME_STORAGE_KEY, next),
		[],
	);
	return { theme, setTheme, themes: THEMES };
}

export function useMode() {
	const mode = useSyncExternalStore(
		subscribe,
		() => (read("mode") as Mode | undefined) ?? DEFAULT_MODE,
		() => DEFAULT_MODE,
	);
	const setMode = useCallback(
		(next: Mode) => write("mode", MODE_STORAGE_KEY, next),
		[],
	);
	return { mode, setMode, modes: MODES };
}
