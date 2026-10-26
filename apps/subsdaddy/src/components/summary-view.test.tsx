import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SummaryView, MODEL_LABEL, CONTEXT_LABEL } from "./summary-view";
import { dataset } from "@/lib/dataset";
import { MEASURED, summaryTable, viewChips, type SummaryTable } from "@/lib/summary";
import type { DS } from "@/lib/sections";

const ds = dataset as unknown as DS;
const chips = viewChips(ds);
const tables: Record<string, SummaryTable> = {};
for (const c of chips) for (const k of ["short", "long"] as const) tables[c.id + "|" + k] = summaryTable(ds, c.id, k);
const html = renderToStaticMarkup(<SummaryView chips={chips} tables={tables} initial={MEASURED} />);

const labelOf = (id: string) => {
  const m = html.match(new RegExp("<span id=\"" + id + "\"[^>]*>([^<]*)</span>"));
  return m ? m[1] : null;
};

describe("switch labels", () => {
  test("the two labels read Model and Context size", () => {
    expect(MODEL_LABEL).toBe("Model");
    expect(CONTEXT_LABEL).toBe("Context size");
    expect(html).toContain(">Model</span>");
    expect(html).toContain(">Context size</span>");
  });

  test("Model comes before Context size in the document, so Model is the left group", () => {
    expect(html.indexOf(">Model</span>")).toBeLessThan(html.indexOf(">Context size</span>"));
    expect(html.indexOf("data-chip=\"measured\"")).toBeLessThan(html.indexOf("data-context=\"short\""));
  });

  test("each group is named by its label through aria-labelledby, and the id it names holds that label", () => {
    const groups = [...html.matchAll(/role="group" aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
    expect(groups.length).toBe(2);
    expect(labelOf(groups[0])).toBe("Model");
    expect(labelOf(groups[1])).toBe("Context size");
  });

  test("the Model group holds the five views and the Context group holds 100K and 350K", () => {
    const modelPart = html.slice(html.indexOf("aria-labelledby=\"switch-label-model\""), html.indexOf("aria-labelledby=\"switch-label-context\""));
    const ctxPart = html.slice(html.indexOf("aria-labelledby=\"switch-label-context\""));
    expect((modelPart.match(/data-chip="/g) ?? []).length).toBe(chips.length);
    expect((ctxPart.match(/data-context="/g) ?? []).length).toBe(2);
    expect(modelPart).not.toContain("data-context=");
    expect(ctxPart).not.toContain("data-chip=");
  });
});
