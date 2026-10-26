import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UnifiedTable } from "@/components/unified-table";
import type { Chip, SummaryTable, ViewId } from "@/lib/summary";

/** The one switch and the one table of the front page. Only the selected view is in the DOM. */
export function SummaryView({ chips, tables, initial }: { chips: Chip[]; tables: Record<string, SummaryTable>; initial: ViewId }) {
  const [view, setView] = useState<string>(initial);
  const t = tables[view];
  return (
    <section className="space-y-3">
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
      <p className="text-xs text-muted-foreground">{t.basisLine}</p>
      <UnifiedTable testId="summary" columns={t.columns} rows={t.rows} />
      {t.footnote && <p className="text-xs text-muted-foreground">{t.footnote}</p>}
    </section>
  );
}
