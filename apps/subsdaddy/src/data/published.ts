import { z } from "zod";

/**
 * The last stable capacity of each lane (r48). A window at or under TRUSTED_USED_PCT used says nothing about the cycle:
 * its figure scales with 1 / used, so a 1% reading moves it by whole multiples. When every window of a lane is at or
 * under the threshold, the lane holds its last stable reading instead of recomputing from the new one. A stored reading
 * is replaced only by a fresh one (some window above the threshold). A lane with no stored reading shows N/A.
 */
export const TRUSTED_USED_PCT = 2;

export const windowUseSchema = z.object({
  window: z.string().min(1),
  used_pct: z.number().min(0).max(100),
  measured_at: z.string().min(1),
  source: z.string().min(1),
});
export const stableSchema = z.object({
  read_at: z.string().min(1),
  measured_at: z.string().min(1),
  source: z.string().min(1),
  published_on: z.string().min(1),
  binding_window: z.string().min(1),
  cycle_days: z.number().positive(),
  fee_per_cycle_usd: z.number().positive(),
  tokens_per_cycle: z.number().positive(),
  allowance_usd_per_cycle: z.number().positive(),
  allowance_basis: z.string().min(1),
  usd_per_b_measured: z.number().positive(),
  windows: z.array(windowUseSchema).min(1),
  /** An exception to the first-run rule (r49): a reading taken from a committed build, not from a window above 2%. */
  seed: z.boolean().optional(),
  seed_source: z.string().min(1).optional(),
});
export const snapshotFileSchema = z.object({
  source: z.string().min(1),
  lanes: z.record(z.string(), stableSchema),
});

export type WindowUse = z.infer<typeof windowUseSchema>;
export type Stable = z.infer<typeof stableSchema>;
export type SnapshotFile = z.infer<typeof snapshotFileSchema>;

export type Resolution =
  | { mode: "fresh"; stable: Stable }
  | { mode: "stale"; stable: Stable; current: WindowUse[]; reason: string }
  | { mode: "unavailable"; reason: string };

/** A reading is trusted when at least one window reads above the threshold. */
export function isTrusted(windows: WindowUse[]): boolean {
  return windows.some((w) => w.used_pct > TRUSTED_USED_PCT);
}

/**
 * Resolve one lane. candidate is the allowance the current reading gives (null when it gives none); snapshot is the
 * stored stable reading (null when none has been stored yet).
 */
export function resolvePublished(input: { windows: WindowUse[]; candidate: Stable | null; snapshot: Stable | null }): Resolution {
  if (input.windows.length === 0) return { mode: "unavailable", reason: "no quota windows in the reading" };
  if (isTrusted(input.windows)) {
    if (input.candidate) return { mode: "fresh", stable: input.candidate };
    return { mode: "unavailable", reason: "a window is above 2% used, but the reading gives no usable allowance" };
  }
  if (input.snapshot) {
    return { mode: "stale", stable: input.snapshot, current: input.windows, reason: "all windows under 2% used; capacity held at the last stable reading" };
  }
  return { mode: "unavailable", reason: "all windows under 2% used and no earlier stable reading to hold; N/A until a window passes 2% used" };
}

/** The stored reading after a build. Only a fresh reading replaces it; a low-signal build never overwrites it. */
export function nextSnapshot(prev: Stable | null, res: Resolution): Stable | null {
  return res.mode === "fresh" ? res.stable : prev;
}

/** The tooltip sentence for a held lane: the date of its last stable reading and the windows it reads now. */
export function staleSentence(readAt: string, current: WindowUse[]): string {
  return "last stable reading " + readAt.slice(0, 10) + "; current windows read " + current.map((w) => w.used_pct + "%").join(" / ");
}
