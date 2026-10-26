/**
 * The one cell model every table on the site uses. A missing value is always na: true, text "N/A",
 * and a reason. Nothing renders as a dash, an empty cell, or a zero standing in for a missing value.
 */

export const BADGES = [
  "measured",
  "OR p50",
  "estimated",
  "derived",
  "low confidence",
  "unverified",
  "single account",
  "window",
  "seed",
  "unmeasured",
  "excluded",
] as const;
export type Badge = (typeof BADGES)[number];

export type Cell = { text: string; na: boolean; reason: string | null; badges: Badge[]; title: string | null; note: string | null };

export const na = (reason: string, badges: Badge[] = []): Cell => ({ text: "N/A", na: true, reason, badges, title: reason, note: null });
export const value = (text: string, badges: Badge[] = [], title: string | null = null, note: string | null = null): Cell => ({ text, na: false, reason: null, badges, title, note });
export const orCell = (text: string, title: string | null, lowConfidence: boolean, note: string | null = null): Cell =>
  value(text, lowConfidence ? ["OR p50", "low confidence"] : ["OR p50"], title, note);

/** A cell is well-formed when it names a value or says N/A with a reason. */
export function wellFormed(c: Cell): boolean {
  if (c.na) return c.text === "N/A" && c.reason !== null && c.reason.length > 0;
  return c.text.length > 0 && c.text !== "—" && c.text !== "N/A";
}
