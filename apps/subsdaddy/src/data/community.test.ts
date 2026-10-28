import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataset } from "../lib/dataset";
import { communityLine, summaryTable, SHAPES } from "../lib/summary";
import { thirdPartyFileSchema, medianOf, monthlyUsd } from "./third-party";
import type { DS } from "../lib/sections";

const APP_ROOT = join(import.meta.dir, "..", "..");
const raw = JSON.parse(readFileSync(join(APP_ROOT, "data", "third-party-allowances.json"), "utf8"));
const file = thirdPartyFileSchema.parse(raw);
const ds = dataset as unknown as DS;
const entry = (id: string) => file.entries.find((e) => e.plan_id === id)!;
const catRow = (id: string) => ds.catalog.rows.find((r) => r.plan_id === id)!;

describe("Claude Max 5x: the median of three independent values is the headline (r56)", () => {
  test("the three values are the publisher's 940 and the X posts' 550 and 1,718; the median is 940", () => {
    const e = entry("claude-code-max-5x");
    expect(e.value_rule).toBe("median_of_sources");
    expect(e.primary_weekly_usd).toBe(940);
    expect(e.community_observations.map((o) => o.weekly_usd).sort((a, b) => a - b)).toEqual([550, 1718]);
    expect(medianOf([940, 550, 1718])).toBe(940);
    expect(e.weekly_usd).toBe(940);
  });
  test("the monthly allowance is 940 x 30/7 = $4,028.57, with the basis naming the median of three", () => {
    expect(catRow("claude-code-max-5x").allowance[0].usd).toBe(monthlyUsd(940));
    expect(catRow("claude-code-max-5x").allowance[0].basis).toContain("median of three independent measurements");
  });
});

describe("Claude Max 20x: the median of two values, not the highest (r56)", () => {
  test("the two values are the publisher's 1,602 and the X post's 1,100; the median is 1,351", () => {
    const e = entry("claude-code-max-20x");
    expect(e.value_rule).toBe("median_of_sources");
    expect(e.primary_weekly_usd).toBe(1602);
    expect(e.community_observations.map((o) => o.weekly_usd)).toEqual([1100]);
    expect(medianOf([1602, 1100])).toBe(1351);
    expect(e.weekly_usd).toBe(1351);
  });
  test("the monthly allowance is 1,351 x 30/7 = $5,790.00, and the basis says median of two", () => {
    expect(catRow("claude-code-max-20x").allowance[0].usd).toBe(5790);
    expect(catRow("claude-code-max-20x").allowance[0].basis).toContain("median of two independent measurements");
  });
  test("the headline is not the highest report", () => {
    const e = entry("claude-code-max-20x");
    expect(e.weekly_usd).toBeLessThan(Math.max(e.primary_weekly_usd!, ...e.community_observations.map((o) => o.weekly_usd)));
  });
});

describe("every X observation carries a clickable URL, its tweet id, and its quote (r56)", () => {
  test("each observation's URL is https://x.com/<author>/status/<tweet id>, and it parses as a URL", () => {
    for (const e of file.entries) for (const o of e.community_observations) {
      expect(o.url).toBe("https://x.com/" + o.author + "/status/" + o.tweet_id);
      expect(new URL(o.url).hostname).toBe("x.com");
    }
  });
  test("each quote is non-empty and shows the value it reports", () => {
    for (const e of file.entries) for (const o of e.community_observations) {
      expect(o.quote.length).toBeGreaterThan(0);
      expect(o.quote).toContain(o.weekly_usd.toLocaleString("en-US"));
    }
  });
  test("the tweet ids and dates are the ones checked: buildwithhassan 2111584427067551764 (2026-10-17), SKatalystAI 2114395405253333390 (2026-10-25)", () => {
    const all = file.entries.flatMap((e) => e.community_observations);
    const hassan = all.find((o) => o.author === "buildwithhassan")!;
    const kata = all.find((o) => o.author === "SKatalystAI")!;
    expect(hassan.tweet_id).toBe("2111584427067551764");
    expect(hassan.date).toBe("2026-10-17");
    expect(kata.tweet_id).toBe("2114395405253333390");
    expect(kata.date).toBe("2026-10-25");
  });
});

describe("the schema refuses a median row that does not match its sources (r56)", () => {
  const base = raw.entries.find((e: { plan_id: string }) => e.plan_id === "claude-code-max-20x");
  test("a headline that is not the median is refused", () => {
    const bad = { ...base, weekly_usd: 1602 };
    expect(thirdPartyFileSchema.safeParse({ ...raw, entries: [bad] }).success).toBe(false);
  });
  test("a community observation whose URL does not match its tweet id is refused", () => {
    const o = { ...base.community_observations[0], url: "https://x.com/someone/status/1" };
    expect(thirdPartyFileSchema.safeParse({ ...raw, entries: [{ ...base, community_observations: [o] }] }).success).toBe(false);
  });
  test("community observations on a non-median row are refused", () => {
    const pro = raw.entries.find((e: { plan_id: string }) => e.plan_id === "claude-code-pro");
    const o = base.community_observations[0];
    expect(thirdPartyFileSchema.safeParse({ ...raw, entries: [{ ...pro, community_observations: [o] }] }).success).toBe(false);
  });
});

describe("tooltips show the community range, count and month (r56)", () => {
  test("communityLine: a range with two reports, and a single value with one report", () => {
    expect(communityLine({ min: 550, max: 1718, count: 2, period: "Oct 2026" })).toBe("community range $550–1,718/week (2 reports on X, Oct 2026)");
    expect(communityLine({ min: 1100, max: 1100, count: 1, period: "Oct 2026" })).toBe("community range $1,100/week (1 report on X, Oct 2026)");
    expect(communityLine(null)).toBeNull();
  });
  test("the Max 5x Allowance and $/B tooltips carry the community range line", () => {
    const row = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows.find((r) => r.key === "claude-code-max-5x")!;
    expect(row.cells.allowance.title ?? "").toContain("community range $550–1,718/week (2 reports on X, Oct 2026)");
    expect(row.cells.usd.title ?? "").toContain("community range $550–1,718/week (2 reports on X, Oct 2026)");
  });
  test("the Max 20x tooltip carries the single X report", () => {
    const row = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows.find((r) => r.key === "claude-code-max-20x")!;
    expect(row.cells.allowance.title ?? "").toContain("community range $1,100/week (1 report on X, Oct 2026)");
  });
});

describe("Claude Pro is unchanged (r56)", () => {
  test("Pro stays the wokey headline at 157 a week, with no community posts", () => {
    expect(entry("claude-code-pro").weekly_usd).toBe(157);
    expect(entry("claude-code-pro").value_rule).toBe("headline");
    expect(entry("claude-code-pro").community_observations).toEqual([]);
  });
});
