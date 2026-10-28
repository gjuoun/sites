import allowanceRaw from "../../data/allowance.json";

/**
 * True when CommandCode has a quota reading in the last build. Its tests assert that reading, so they are skipped (not
 * failed) while the reading is absent, for example when its session has expired (r59). The skip count is reported.
 */
export const commandcodeLive: boolean = (allowanceRaw as { lanes: Array<{ lane: string; binding_window: string | null }> }).lanes.some(
  (l) => l.lane === "commandcode-goat" && l.binding_window !== null,
);
