import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UnifiedTable } from "@/components/unified-table";
import { CONTEXT_IDS, contextLabel } from "@/data/context";
import { MEASURED, type Chip, type SummaryTable, type ViewId } from "@/lib/summary";

/** Labels for the two switches. Each switch is a group named by its label, so screen readers hear the same name. */
export const MODEL_LABEL = "Model";
export const CONTEXT_LABEL = "Context size";
const MODEL_LABEL_ID = "switch-label-model";
const CONTEXT_LABEL_ID = "switch-label-context";

/** The two switches, the one table, and the speed basis. Only the selected view is in the DOM. */
export function SummaryView({ chips, tables, initial }: { chips: Chip[]; tables: Record<string, SummaryTable>; initial: ViewId }) {
  const [view, setView] = useState<string>(initial);
  const [ctx, setCtx] = useState<string>("short");
  const t = tables[view + "|" + ctx];
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div role="group" aria-labelledby={MODEL_LABEL_ID} className="flex flex-wrap items-center gap-2">
          <span id={MODEL_LABEL_ID} className="text-xs text-muted-foreground">{MODEL_LABEL}</span>
          <ToggleGroup
            type="single"
            variant="outline"
            value={view}
            onValueChange={(v) => {
              if (v) setView(v);
            }}
            className="flex-wrap justify-start"
          >
            {chips.map((c) => (
              <ToggleGroupItem key={c.id} value={c.id} data-chip={c.id} aria-label={c.label}>
                {c.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div role="group" aria-labelledby={CONTEXT_LABEL_ID} className="flex flex-wrap items-center gap-2">
          <span id={CONTEXT_LABEL_ID} className="text-xs text-muted-foreground">{CONTEXT_LABEL}</span>
          <ToggleGroup
            type="single"
            variant="outline"
            value={ctx}
            onValueChange={(v) => {
              if (v) setCtx(v);
            }}
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
      </div>
      <p className="text-xs text-muted-foreground">{t.basisLine}</p>
      <UnifiedTable testId="summary" columns={t.columns} rows={t.rows} />
      {t.footnote && <p className="text-xs text-muted-foreground">{t.footnote}</p>}
    </section>
  );
}
