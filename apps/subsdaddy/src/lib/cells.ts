/**
 * The one cell model every table on the site uses. A missing value is always na: true, text "N/A",
 * and a reason. Nothing renders as a dash, a zero, or an empty cell except a flag cell with no flags.
 */

/** Every badge the site can show, with the one variant it uses. Three variants, one size. */
export const BADGE_VARIANT = {
  measured: "source",
  "OR p50": "source",
  "low confidence": "confidence",
  estimated: "status",
  derived: "status",
  unverified: "status",
  unmeasured: "status",
  excluded: "status",
  seed: "status",
  window: "status",
  single_account_reading: "status",
} as const;
export type BadgeKind = keyof typeof BADGE_VARIANT;
export type BadgeVariant = "source" | "confidence" | "status";
export const BADGE_KINDS = Object.keys(BADGE_VARIANT) as BadgeKind[];

export type Cell = {
  /** Lines shown in a hover panel for this cell; the value itself is unchanged. */
  detail?: string[];
  text: string;
  na: boolean;
  reason: string | null;
  badges: BadgeKind[];
  title: string | null;
  note: string | null;
  flags: boolean;
  /** A source marker shown as a superscript after the value (allowance: p, r, d, c). */
  sup?: string | null;
};

export const na = (reason: string, badges: BadgeKind[] = []): Cell => ({ text: "N/A", na: true, reason, badges, title: reason, note: null, flags: false });
export const value = (text: string, badges: BadgeKind[] = [], title: string | null = null, note: string | null = null): Cell => ({
  text,
  na: false,
  reason: null,
  badges,
  title,
  note,
  flags: false,
});
/** A column of flags: the flag names as badges, and nothing at all when there are none. */
export const flagCell = (badges: BadgeKind[]): Cell => ({ text: "", na: false, reason: null, badges, title: badges.join(", ") || null, note: null, flags: true });
export const orCell = (text: string, title: string | null, note: string | null = null): Cell => value(text, ["OR p50"], title, note);

/** A cell is well-formed when it names a value, says N/A with a reason, or is a flag cell. */
export function wellFormed(c: Cell): boolean {
  if (c.flags) return c.text === "";
  if (c.na) return c.text === "N/A" && c.reason !== null && c.reason.length > 0;
  return c.text.length > 0 && c.text !== "—" && c.text !== "N/A";
}
