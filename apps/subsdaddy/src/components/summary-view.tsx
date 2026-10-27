import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UnifiedTable } from "@/components/unified-table";
import { CONTEXT_IDS, contextLabel } from "@/data/context";
import { MEASURED, type Chip, type SummaryTable, type ViewId } from "@/lib/summary";

/** The one switch of views, the context switch beside it, and the one table. Only the selected view is in the DOM. */
export function SummaryView({ chips, tables, initial }: { chips: Chip[]; tables: Record<string, SummaryTable>; initial: ViewId }) {
  const [view, setView] = useState<string>(initial);
  const [ctx, setCtx] = useState<string>("short");
  const t = tables[view + "|" + ctx];
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          value={view}
          onValueChange={(v) => {
            if (v) setView(v);
          }}
          aria-label="View"
          className="flex-wrap justify-start"
        >
          {chips.map((c) => (
            <ToggleGroupItem key={c.id} value={c.id} data-chip={c.id} aria-label={c.label}>
              {c.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          type="single"
          variant="outline"
          value={ctx}
          onValueChange={(v) => {
            if (v) setCtx(v);
          }}
          aria-label="Context"
          disabled={view === MEASURED}
          data-testid="context-toggle"
        >
          {CONTEXT_IDS.map((id) => (
            <ToggleGroupItem key={id} value={id} data-context={id} aria-label={contextLabel(id) + " context"}>
              {contextLabel(id)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <p className="text-xs text-muted-foreground">{t.basisLine}</p>
      <UnifiedTable testId="summary" columns={t.columns} rows={t.rows} />
      {t.footnote && <p className="text-xs text-muted-foreground">{t.footnote}</p>}
    </section>
  );
}
