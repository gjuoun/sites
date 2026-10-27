import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UnifiedTable } from "@/components/unified-table";
import { CONTEXT_IDS, contextLabel } from "@/data/context";
import { type Chip, type SummaryTable, type ViewId } from "@/lib/summary";

/** Labels for the two switches. Each switch is a group named by its label, so screen readers hear the same name. */
export const MODEL_LABEL = "Model";
export const CONTEXT_LABEL = "Context size";
const MODEL_LABEL_ID = "switch-label-model";
const CONTEXT_LABEL_ID = "switch-label-context";

/** One chip style for both switches. Unselected: outlined, light. Selected: solid dark. Never disabled, so never faded. */
export const CHIP_ITEM = "rounded-md border border-border bg-background text-foreground data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background";
/** One note style for the speed basis line and the footnote: the same size, colour and spacing. */
export const NOTE_LINE = "text-xs leading-5 text-muted-foreground";

/** The two switches, the one table, the speed basis and the footnote. Only the selected view is in the DOM. */
export function SummaryView({ chips, tables, initial }: { chips: Chip[]; tables: Record<string, SummaryTable>; initial: ViewId }) {
  const [view, setView] = useState<string>(initial);
  const [ctx, setCtx] = useState<string>("short");
  const t = tables[view + "|" + ctx];
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div role="group" aria-labelledby={MODEL_LABEL_ID} className="flex flex-wrap items-center gap-2">
          <span id={MODEL_LABEL_ID} className={NOTE_LINE}>{MODEL_LABEL}</span>
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
              <ToggleGroupItem key={c.id} value={c.id} data-chip={c.id} aria-label={c.label} className={CHIP_ITEM}>
                {c.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div role="group" aria-labelledby={CONTEXT_LABEL_ID} className="flex flex-wrap items-center gap-2">
          <span id={CONTEXT_LABEL_ID} className={NOTE_LINE}>{CONTEXT_LABEL}</span>
          <ToggleGroup
            type="single"
            variant="outline"
            value={ctx}
            onValueChange={(v) => {
              if (v) setCtx(v);
            }}
            data-testid="context-toggle"
          >
            {CONTEXT_IDS.map((id) => (
              <ToggleGroupItem key={id} value={id} data-context={id} aria-label={contextLabel(id) + " context"} className={CHIP_ITEM}>
                {contextLabel(id)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
      <p className={NOTE_LINE} data-note="basis">{t.basisLine}</p>
      <UnifiedTable testId="summary" columns={t.columns} rows={t.rows} />
      {t.footnote && <p className={NOTE_LINE} data-note="footnote">{t.footnote}</p>}
    </section>
  );
}
