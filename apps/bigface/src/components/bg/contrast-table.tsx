import type * as React from "react";
import { contrastReport } from "../../data/contrast.ts";
import { palette } from "../../data/palette.ts";

// Every palette colour's contrast on the background, with its WCAG band. Informational only.
const CELL = "border-b border-border px-[0.6rem] py-[0.4rem]";
const label = (r: number) => (r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "large text" : "below 3");

export function BGContrastTable() {
  const rows = contrastReport(palette as never);
  return (
    <table className="w-full border-collapse text-[0.9rem]">
      <thead>
        <tr>
          {["Colour", "Hex", "Ratio on background", "WCAG"].map((h) => (
            <th key={h} className={CELL + " font-semibold text-muted-foreground"}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <td className={CELL}>
              <i
                className="inline-block size-[0.8em] rounded-[3px] bg-(--c) align-[-0.05em]"
                style={{ "--c": r.hex } as React.CSSProperties}
              />{" "}
              {r.name}
            </td>
            <td className={CELL}>
              <code>{r.hex}</code>
            </td>
            <td className={CELL}>{r.ratio.toFixed(1)} : 1</td>
            <td className={CELL + (r.ratio < 4.5 ? " text-destructive" : "")}>{label(r.ratio)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
