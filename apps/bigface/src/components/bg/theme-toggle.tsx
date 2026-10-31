import { useEffect, useState } from "react";
import { MODE_STORAGE_KEY } from "@gjuoun/bigface-shadcn-ui/lib/themes";

// The light/dark switch: icon-only, 28px at its smallest, named for screen readers. The mode lives in
// data-mode on <html> and the reader's choice in the theme package's storage key — the same one the
// pre-paint script reads before first paint, so a reload keeps the choice.
//
// It is the family's one interactive island: mount it with client:load. The DOM owns the mode, so the
// component only mirrors it — the initial aria-pressed matches the server render (the site's default).
export function BGThemeToggle({ defaultDark = true }: { defaultDark?: boolean }) {
  const [dark, setDark] = useState(defaultDark);

  // color-scheme has to be inline: light-dark() resolves on it, and the pre-paint script only
  // writes data-mode. The meta theme-color follows the canvas, for the browser chrome.
  const apply = (mode: string) => {
    const root = document.documentElement;
    root.dataset.mode = mode;
    root.style.colorScheme = mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", getComputedStyle(root).getPropertyValue("--theme-bg").trim());
    setDark(mode === "dark");
  };

  useEffect(() => {
    const mode = document.documentElement.dataset.mode;
    apply(mode === "dark" || mode === "light" ? mode : defaultDark ? "dark" : "light");
  }, []);

  return (
    <button
      type="button"
      id="theme-toggle"
      className="group inline-flex min-h-7 min-w-7 cursor-pointer items-center justify-center border border-border bg-card p-1 text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-foreground"
      aria-label="Dark mode"
      aria-pressed={dark}
      onClick={() => {
        const next = document.documentElement.dataset.mode === "dark" ? "light" : "dark";
        try {
          localStorage.setItem(MODE_STORAGE_KEY, next);
        } catch {
          // storage can be blocked; the mode still applies for this page view
        }
        apply(next);
      }}
    >
      <span className="inline-flex" aria-hidden="true">
        <svg
          className="hidden group-aria-pressed:inline-block"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="8" cy="8" r="3"></circle>
          <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M13 3l-1 1M4 12l-1 1"></path>
        </svg>
        <svg
          className="inline-block group-aria-pressed:hidden"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z"></path>
        </svg>
      </span>
    </button>
  );
}
