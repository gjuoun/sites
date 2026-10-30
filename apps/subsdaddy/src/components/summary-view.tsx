import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@gjuoun/bigface-business-ui/components/ui/toggle-group";
import { UnifiedTable } from "@/components/unified-table";
import { CONTEXT_IDS, contextLabel } from "@/data/context";
import { MEASURED, type Chip, type SummaryTable, type ViewId } from "@/lib/summary";

/** Labels for the three switches. Each switch is a group named by its label, so screen readers hear the same name. */
export const MODEL_LABEL = "Model";
export const CONTEXT_LABEL = "Context size";
export const SHAPE_LABEL = "Shape";
const MODEL_LABEL_ID = "switch-label-model";
const CONTEXT_LABEL_ID = "switch-label-context";
const SHAPE_LABEL_ID = "switch-label-shape";

/** One chip style for every switch: unselected outlined and light, selected solid dark. Never disabled. */
export const CHIP_ITEM = "rounded-md border border-border bg-background text-foreground data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background";
/** One note style for the speed basis line and the footnote. */
export const NOTE_LINE = "text-xs leading-5 text-muted-foreground";

/** The three switches, the one table, the speed basis and the footnote. Only the selected view is in the DOM. */
export function SummaryView({ chips, tables, initial, shapes, initialShape }: { chips: Chip[]; tables: Record<string, SummaryTable>; initial: ViewId; shapes: Array<{ id: string; label: string }>; initialShape: string }) {
  const [view, setView] = useState<string>(initial);
  const [ctx, setCtx] = useState<string>("short");
  const [shape, setShape] = useState<string>(initialShape);
  const t = tables[view + "|" + ctx + "|" + shape];
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div role="group" aria-labelledby={MODEL_LABEL_ID} className="flex flex-wrap items-center gap-2">
          <span id={MODEL_LABEL_ID} className={NOTE_LINE}>{MODEL_LABEL}</span>
          <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => { if (v) setView(v); }} className="flex-wrap justify-start">
            {chips.map((c) => (
              <ToggleGroupItem key={c.id} value={c.id} data-chip={c.id} aria-label={c.label} className={CHIP_ITEM}>
                {c.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div role="group" aria-labelledby={CONTEXT_LABEL_ID} className="flex flex-wrap items-center gap-2">
          <span id={CONTEXT_LABEL_ID} className={NOTE_LINE}>{CONTEXT_LABEL}</span>
          <ToggleGroup type="single" variant="outline" value={ctx} onValueChange={(v) => { if (v) setCtx(v); }} data-testid="context-toggle">
            {CONTEXT_IDS.map((id) => (
              <ToggleGroupItem key={id} value={id} data-context={id} aria-label={contextLabel(id) + " context"} className={CHIP_ITEM}>
                {contextLabel(id)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div role="group" aria-labelledby={SHAPE_LABEL_ID} className="flex flex-wrap items-center gap-2">
          <span id={SHAPE_LABEL_ID} className={NOTE_LINE}>{SHAPE_LABEL}</span>
          <ToggleGroup type="single" variant="outline" value={shape} onValueChange={(v) => { if (v) setShape(v); }} data-testid="shape-toggle">
            {shapes.map((s) => (
              <ToggleGroupItem key={s.id} value={s.id} data-shape={s.id} aria-label={s.label} className={CHIP_ITEM}>
                {s.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
      <p className={NOTE_LINE} data-note="basis">{t.basisLine}</p>
      <UnifiedTable testId="summary" columns={t.columns} rows={t.rows} />
      {t.footnote && t.footnote.split("\n").map((line) => (
        <p key={line} className={NOTE_LINE} data-note="footnote">{line}</p>
      ))}
    </section>
  );
}
