import type { ReactNode } from "react";
import type { Badge, Cell } from "@/lib/cells";

/**
 * The single table style on the site. Every table renders through this component and these classes,
 * so headers, padding, numbers, currency and badges look the same in every section.
 */

export const TABLE = "w-full table-fixed border-collapse text-sm";
export const HEAD = "border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground";
export const CELL = "border-b border-border px-3 py-2 align-top whitespace-normal break-words";
export const NUM = "text-right tabular-nums";
export const BADGE_CLASS = "mr-1 mt-0.5 inline-block rounded border px-1.5 py-px text-[11px] leading-4 whitespace-nowrap";

const BADGE_TONE: Record<Badge, string> = {
  measured: "border-foreground/30 text-foreground",
  "OR p50": "border-foreground/30 text-foreground",
  estimated: "border-dashed border-foreground/40 text-muted-foreground",
  derived: "border-dashed border-foreground/40 text-muted-foreground",
  "low confidence": "border-foreground/40 text-foreground",
  unverified: "border-dashed border-foreground/40 text-muted-foreground",
  "single account": "border-foreground/30 text-muted-foreground",
  window: "border-foreground/30 text-muted-foreground",
  seed: "border-dashed border-foreground/40 text-muted-foreground",
  unmeasured: "border-foreground/30 text-muted-foreground",
  excluded: "border-foreground/40 text-muted-foreground",
};

export function StatusBadge({ kind }: { kind: Badge }) {
  return (
    <span className={BADGE_CLASS + " " + BADGE_TONE[kind]} data-badge={kind}>
      {kind}
    </span>
  );
}

/** A cell's value, its badges, and its reason when it is N/A. */
export function CellView({ cell, numeric = false }: { cell: Cell; numeric?: boolean }) {
  return (
    <span className={numeric ? "block " + NUM : "block"} data-na={cell.na ? "yes" : undefined} title={cell.title ?? undefined}>
      <span className={cell.na ? "text-muted-foreground" : "font-medium"}>{cell.text}</span>
      {cell.na && cell.reason && <span className="mt-0.5 block text-xs text-muted-foreground">{cell.reason}</span>}
      {cell.badges.length > 0 && (
        <span className="mt-0.5 block">
          {cell.badges.map((b) => (
            <StatusBadge key={b} kind={b} />
          ))}
        </span>
      )}
    </span>
  );
}

export type Column = { key: string; label: string; width: string; numeric?: boolean };
export type Row = { key: string; cells: Record<string, Cell>; extra?: ReactNode };

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
                <CellView cell={r.cells[c.key]} numeric={c.numeric} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
