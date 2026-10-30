/**
 * The package publishes semantic roles, not a code palette: these constants name the roles the
 * site needs for surfaces the theme does not model directly. Class strings only — no CSS.
 */
/** A recessed code surface inside a panel (the package's muted and card are the same panel). */
export const PANEL = "bg-muted";
/** A divider inside a panel: one border colour, softened instead of inventing a second. */
export const HAIRLINE = "border-border/60";
/** "ok" has no role: chart-5 is the palette's own green. */
export const OK = "text-chart-5";
/** Terminal traffic light: destructive, the neutral, the palette green. */
export const TERMINAL_DOTS = ["bg-destructive", "bg-muted-foreground", "bg-chart-5"] as const;
