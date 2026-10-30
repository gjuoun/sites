import { useMode } from "@gjuoun/bigface-shadcn-ui/hooks/use-theme";

// The light/dark switch. The mode lives in data-mode on <html> — the package's pre-paint script reads
// the same storage key — so this component only writes through the package hook. Icon-only, 28px at
// its smallest, and named for screen readers.
export function ThemeToggle() {
  const { mode, setMode } = useMode();
  const dark = mode === "dark";
  return (
    <button
      type="button"
      id="theme-toggle"
      className="inline-flex min-h-7 min-w-7 cursor-pointer items-center justify-center border border-border bg-card p-1 text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-foreground"
      aria-label="Dark mode"
      aria-pressed={dark}
      onClick={() => setMode(dark ? "light" : "dark")}
    >
      <span className="inline-flex" aria-hidden="true">
        {dark ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
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
  );
}
