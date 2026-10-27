import type { Cell, BadgeKind, BadgeVariant } from "@/lib/cells";
import { BADGE_VARIANT } from "@/lib/cells";

/**
 * The single table style and the single badge on the site. Every table renders through this file.
 * Each cell has three fixed slots: the value, one secondary line, and the badges. The slots are always
 * reserved, so every row on every table has the same height. Long text is cut to one line; the full
 * text is in the title.
 */

export const TABLE = "w-full table-fixed border-collapse text-sm";
export const HEAD = "border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground";
export const CELL = "border-b border-border px-3 py-2 align-top";
export const NUM = "text-right tabular-nums";

/** One badge: the same size, padding, radius and weight for every variant. Only the tone differs. */
const BADGE_BASE = "inline-flex h-5 items-center whitespace-nowrap rounded-md border px-1.5 text-[11px] font-medium leading-none";
const VARIANT_TONE: Record<BadgeVariant, string> = {
  source: "border-foreground/40 bg-background text-foreground",
  confidence: "border-foreground bg-muted text-foreground",
  status: "border-border bg-background text-muted-foreground",
};

export function Badge({ kind }: { kind: BadgeKind }) {
  const variant = BADGE_VARIANT[kind];
  return (
    <span className={BADGE_BASE + " " + VARIANT_TONE[variant]} data-badge={kind} data-badge-variant={variant}>
      {kind}
    </span>
  );
}

/** A cell's three slots: the value, its secondary line (reason or note), and its badges. */
export function CellView({ cell, numeric = false, clip = false }: { cell: Cell; numeric?: boolean; clip?: boolean }) {
  const shown = cell.na ? cell.reason : cell.note;
  const body = (
    <span className="block min-w-0" data-na={cell.na ? "yes" : undefined} data-flags={cell.flags ? "yes" : undefined} title={cell.title ?? undefined}>
      <span className={"block h-5 leading-5 whitespace-nowrap " + (clip ? "truncate " : "") + (numeric ? "text-right " : "") + (cell.na ? "text-muted-foreground" : "font-medium")}>
        {cell.text.endsWith("*") ? cell.text.slice(0, -1) : cell.text}
        {cell.text.endsWith("*") && <sup className="ml-px text-[9px] leading-none">*</sup>}
      </span>
      <span className={"block h-4 truncate text-xs leading-4 text-muted-foreground " + (numeric ? "text-right" : "")} title={shown ?? undefined}>
        {shown ?? ""}
      </span>
      <span className={"mt-1 flex h-5 flex-nowrap items-center gap-1 overflow-hidden " + (numeric ? "justify-end" : "")}>
        {cell.badges.map((b) => (
          <Badge key={b} kind={b} />
        ))}
      </span>
    </span>
  );
  if (!cell.detail || cell.detail.length === 0) return body;
  return (
    <span className="group relative block min-w-0" data-hover="yes">
      {body}
      <span role="tooltip" data-tooltip="yes" className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-[380px] max-w-[90vw] rounded-md border border-border bg-background p-3 text-xs leading-5 text-foreground shadow-md group-hover:block">
        {cell.detail.map((line) => (
          <span key={line} className="block">{line}</span>
        ))}
      </span>
    </span>
  );
}

export type Column = { key: string; label: string; width: string; numeric?: boolean; clip?: boolean };
export type Row = { key: string; cells: Record<string, Cell> };

export function UnifiedTable({ testId, columns, rows }: { testId: string; columns: Column[]; rows: Row[] }) {
  return (
    <table className={TABLE} data-table="unified" data-testid={testId}>
      <colgroup>
        {columns.map((c) => (
          <col key={c.key} style={{ width: c.width }} />
        ))}
      </colgroup>
      <thead>
        <tr className={HEAD}>
          {columns.map((c) => (
            <th key={c.key} className={"px-3 py-2 font-medium " + (c.numeric ? "text-right" : "")}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} data-row={r.key}>
            {columns.map((c) => (
              <td key={c.key} className={CELL + " " + (c.numeric ? NUM : "")} data-col={c.key}>
                <CellView cell={r.cells[c.key]} numeric={c.numeric} clip={c.clip} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
