import { blendedUsdPerB, priceAt, type RefPrice } from "../data/estimate";

/**
 * Claude plans and the hour figures (r44). Anthropic publishes hours of usage, not a dollar allowance. A conversion
 * hours x burn rate x list price is shown only as a sensitivity table in methodology, never as a table value.
 * Every input is read from data/: hours from claude-plans.json, the measured burn rate from context.json, the list
 * prices from claude-plans.json (Sonnet 5.5) and models.json (Haiku 5.5), the mix from usage.json.
 */
export const CLAUDE_CYCLE_DAYS = 30;
/** The 100K standard context, the low prompt tier for Claude Haiku 5.5 (a prompt above 100K is the high tier). */
export const HAIKU_CONTEXT_TOKENS = 100_000;

export type Price = { in_per_m: number; out_per_m: number; cache_per_m: number; cache_write_per_m: number };
export type MeasuredShares = { output_share: number; cache_share: number; cache_write_share: number };
export type Intensity = { id: "light" | "medium" | "heavy"; label: string; tokensPerActiveHour: number; basis: string };

/** Dollars per billion tokens of a price at a measured mix. */
export function usdPerB(price: Price, mix: MeasuredShares): number {
  return blendedUsdPerB(price, mix);
}

/**
 * The three burn rates of the sensitivity table. Light and medium are scenario values chosen for the table, not
 * measurements. Heavy is the measured median, passed in from context.json; nothing here is typed in.
 */
export function intensityLevels(heavyTokensPerActiveHour: number): Intensity[] {
  const m = (t: number) => (t / 1e6).toFixed(1) + "M";
  return [
    { id: "light", label: "5M tok/h, light interactive", tokensPerActiveHour: 5_000_000, basis: "scenario value, not measured: light interactive use" },
    { id: "medium", label: "15M tok/h, medium agent", tokensPerActiveHour: 15_000_000, basis: "scenario value, not measured: medium agent use" },
    { id: "heavy", label: m(heavyTokensPerActiveHour) + " tok/h, measured median", tokensPerActiveHour: heavyTokensPerActiveHour, basis: "measured: median of pi sessions with 9+ active minutes, 30 days, all four token classes (data/context.json)" },
  ];
}

/** Dollars a plan's hours buy per cycle at one burn rate: hours per week x tokens per active hour x blend x cycle / 7. */
export function cycleUsd(hoursPerWeek: number, tokensPerActiveHour: number, price: Price, mix: MeasuredShares): { tokensPerWeek: number; usdPerWeek: number; usdPerCycle: number; usdPerB: number } {
  const tokensPerWeek = hoursPerWeek * tokensPerActiveHour;
  const b = usdPerB(price, mix);
  const usdPerWeek = (tokensPerWeek / 1e9) * b;
  return { tokensPerWeek, usdPerWeek, usdPerCycle: (usdPerWeek * CLAUDE_CYCLE_DAYS) / 7, usdPerB: b };
}

/** Haiku 5.5's blended dollars per billion tokens at the 100K standard context (low tier) and the measured mix. */
export function haikuUsdPerB(haiku: RefPrice, mix: MeasuredShares): number {
  return blendedUsdPerB(priceAt(haiku, HAIKU_CONTEXT_TOKENS).price, mix);
}

export type GridPlan = { plan: string; plan_id: string; hours_low: number; hours_high: number };
export type GridCell = { intensity: Intensity; usd: number; haikuB: number };
export type GridRow = { plan: string; plan_id: string; bound: "lower" | "upper"; hours: number; cells: GridCell[] };

/** The sensitivity table: each plan at its lower and upper hour figure, at each burn rate. Dollars per cycle and the Haiku billions those dollars buy. */
export function sensitivityGrid(input: { plans: GridPlan[]; price: Price; mix: MeasuredShares; haiku: RefPrice; heavy: number }): GridRow[] {
  const levels = intensityLevels(input.heavy);
  const hu = haikuUsdPerB(input.haiku, input.mix);
  const rows: GridRow[] = [];
  for (const p of input.plans) {
    for (const [bound, hours] of [["lower", p.hours_low], ["upper", p.hours_high]] as const) {
      rows.push({
        plan: p.plan,
        plan_id: p.plan_id,
        bound,
        hours,
        cells: levels.map((lv) => {
          const usd = cycleUsd(hours, lv.tokensPerActiveHour, input.price, input.mix).usdPerCycle;
          return { intensity: lv, usd, haikuB: usd / hu };
        }),
      });
    }
  }
  return rows;
}

/** A dollar figure for the reason text: $2.7k, $16.5k, or whole dollars below $1,000. */
export function fmtK(v: number): string {
  return v >= 1000 ? "$" + (v / 1000).toFixed(1) + "k" : "$" + v.toFixed(0);
}

/** The N/A reason every Claude plan shows as its tooltip. The span is the lower-bound dollars at the measured burn rate, lowest to highest plan. */
export function unavailableReason(lowestUsd: number, highestUsd: number, heavyTokensPerActiveHour: number): string {
  return "Anthropic publishes hours of usage, not a dollar allowance. Our agent burn rate (" + (heavyTokensPerActiveHour / 1e6).toFixed(1) + "M tokens per active hour) is far heavier than the interactive use those hours assume, so a conversion would span " + fmtK(lowestUsd) + "–" + fmtK(highestUsd) + "/mo, too wide to publish as a number.";
}
