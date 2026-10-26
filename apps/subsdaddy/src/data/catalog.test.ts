import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { catalogDisplayRow, catalogFileSchema, catalogRowSchema, formatUsdPerCredit } from "./catalog";

const T = "2026-10-26T16:00:00Z";
const official = { kind: "official_page", url: "https://claude.com/pricing", note: "pricing page" };
const unverified = { kind: "unverified", url: null, note: "unverified: pricing page returned 403" };

const base = {
  plan_id: "claude-code-max-20x",
  product: "Claude Code",
  tier: "Max 20x",
  label: "Claude Code - Max 20x",
  status: "catalog",
  provider: null,
  price_month_usd: 200,
  price_native: null,
  currency: "USD",
  price_annual_usd: null,
  allowance_model: "window_percent",
  allowance_detail: "5h and weekly windows",
  credits_to_usd: null,
  cli_compat: "Claude Code native",
  heat_samples: 142,
  exclusion_reason: null,
  price_note: null,
  measured_at: T,
  sources: [official],
};

describe("catalog row schema", () => {
  test("a confirmed price with an official source parses", () => {
    expect(catalogRowSchema.parse(base).price_month_usd).toBe(200);
  });

  test("the catalog never ranks: status ranked is rejected", () => {
    expect(() => catalogRowSchema.parse({ ...base, status: "ranked" })).toThrow();
  });

  test("a per-billion dollar field cannot appear on a catalog row", () => {
    expect(() => catalogRowSchema.parse({ ...base, usd_per_b: 9.2 })).toThrow();
    expect(() => catalogRowSchema.parse({ ...base, usd_per_b_basis: "measured" })).toThrow();
  });

  test("a price with no official source is rejected", () => {
    expect(() => catalogRowSchema.parse({ ...base, sources: [unverified] })).toThrow(/official/);
  });

  test("no price needs an explicit unverified source, never a guessed number", () => {
    const noPrice = { ...base, price_month_usd: null, price_native: null, sources: [official] };
    expect(() => catalogRowSchema.parse(noPrice)).toThrow(/unverified/);
    const ok = catalogRowSchema.parse({ ...noPrice, sources: [unverified], price_note: "brief states 20 USD; not confirmed" });
    expect(ok.price_month_usd).toBeNull();
  });

  test("the label must be the product and tier, in the Product - Tier form", () => {
    expect(() => catalogRowSchema.parse({ ...base, label: "Max 20x" })).toThrow(/label/);
  });

  test("an excluded row must say why; a catalog row must not", () => {
    const excluded = { ...base, plan_id: "deepseek-api", product: "DeepSeek API", tier: "pay-as-you-go", label: "DeepSeek API - pay-as-you-go", price_month_usd: null, status: "excluded", sources: [unverified] };
    expect(() => catalogRowSchema.parse(excluded)).toThrow(/exclusion_reason/);
    expect(catalogRowSchema.parse({ ...excluded, exclusion_reason: "pay-as-you-go API, not a subscription" }).status).toBe("excluded");
    expect(() => catalogRowSchema.parse({ ...base, exclusion_reason: "x" })).toThrow(/exclusion_reason/);
  });

  test("a conversion needs a basis, and only credit-based allowances may carry one", () => {
    expect(() => catalogRowSchema.parse({ ...base, credits_to_usd: { usd_per_credit: 0.125, basis: "" } })).toThrow();
    expect(() => catalogRowSchema.parse({ ...base, credits_to_usd: { usd_per_credit: 0.125, basis: "$10/mo / $80" } })).toThrow(/credits/);
    const ok = catalogRowSchema.parse({ ...base, allowance_model: "credits", credits_to_usd: { usd_per_credit: 0.125, basis: "$10/mo / $80 of usage" } });
    expect(ok.credits_to_usd?.usd_per_credit).toBe(0.125);
  });

  test("a credit-based row with no published conversion must carry an unverified note", () => {
    const credits = { ...base, allowance_model: "credits", sources: [official] };
    expect(() => catalogRowSchema.parse(credits)).toThrow(/unverified source note/);
    const ok = catalogRowSchema.parse({ ...credits, sources: [official, unverified] });
    expect(ok.credits_to_usd).toBeNull();
  });

  test("a non-credit row with no conversion needs no credits note", () => {
    expect(catalogRowSchema.parse({ ...base, sources: [official] }).credits_to_usd).toBeNull();
  });

  test("native-currency price is kept as the displayed text and carries no USD figure", () => {
    const volc = { ...base, plan_id: "volc-ark-coding-lite", product: "Volcengine Ark", tier: "Coding Plan Lite", label: "Volcengine Ark - Coding Plan Lite", price_month_usd: null, price_native: "CNY 9.9 first month (limited), regular CNY 40", currency: "CNY", sources: [official] };
    expect(catalogRowSchema.parse(volc).currency).toBe("CNY");
    expect(() => catalogRowSchema.parse({ ...volc, price_month_usd: 10 })).toThrow(/CNY/);
  });
});

describe("catalog file", () => {
  test("plan ids are unique and do not reuse a ranked lane id", () => {
    const dup = { rows: [base, base], measured_at: T, source: "test" };
    expect(() => catalogFileSchema.parse(dup)).toThrow(/unique/);
    const ranked = { rows: [{ ...base, plan_id: "opencode-go" }], measured_at: T, source: "test" };
    expect(() => catalogFileSchema.parse(ranked)).toThrow(/ranked lane/);
  });
});

describe("catalog display guard", () => {
  test("a catalog row renders with a badge and no per-billion dollar figure", () => {
    const d = catalogDisplayRow(catalogRowSchema.parse(base));
    expect(d.badge).toBe("unmeasured");
    expect(d.fee).toBe("$200");
    expect(Object.keys(d).some((k) => /usd_per_b|per_b/i.test(k))).toBe(false);
    expect(JSON.stringify(d)).not.toContain("$/B");
  });

  test("an unverified price displays as unverified, not as zero", () => {
    const row = catalogRowSchema.parse({ ...base, price_month_usd: null, sources: [unverified], price_note: "brief states 20 USD" });
    const d = catalogDisplayRow(row);
    expect(d.fee).toBe("unverified");
    expect(d.fee).not.toContain("0");
  });

  test("per-credit values keep three significant figures, including very small ones", () => {
    expect(formatUsdPerCredit(0.125)).toBe("$0.125 / credit");
    expect(formatUsdPerCredit(10 / 25500)).toBe("$0.000392 / credit");
  });

  test("an owner-confirmed price is accepted, labelled as owner, and never shown as official", () => {
    const owner = { kind: "owner_confirmed", url: null, note: "owner-confirmed plan fee $10/mo" };
    const row = catalogRowSchema.parse({ ...base, price_month_usd: 10, sources: [owner] });
    expect(catalogDisplayRow(row).source_badge).toBe("owner");
    expect(catalogDisplayRow(row).source_badge).not.toBe("official");
  });

  test("a published conversion renders as dollars per credit with its basis kept", () => {
    const d = catalogDisplayRow(catalogRowSchema.parse({ ...base, allowance_model: "credits", credits_to_usd: { usd_per_credit: 0.125, basis: "$10/mo / $80" } }));
    expect(d.credits_text).toBe("$0.125 / credit");
    expect(d.credits_basis).toBe("$10/mo / $80");
  });

  test("the shipped catalog file keeps every guard: no per-B key, no per-B text on any row", () => {
    const file = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "data", "catalog.json"), "utf8"));
    const parsed = catalogFileSchema.parse(file);
    for (const r of parsed.rows) {
      expect(Object.keys(r).some((k) => /usd_per_b|per_b/i.test(k))).toBe(false);
      expect(JSON.stringify(catalogDisplayRow(r))).not.toContain("$/B");
    }
  });
});
