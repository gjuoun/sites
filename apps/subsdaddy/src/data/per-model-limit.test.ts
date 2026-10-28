import { describe, expect, test } from "bun:test";
import { perModelAllowance, PER_MODEL_MAIN_SHARE, pageLimitsFor, limitOfUpstream } from "./per-model-limit";

describe("per-model limits: a main model at 70% or more sets the allowance (r53)", () => {
  test("DeepSeek at 88% of tokens takes DeepSeek's $80 limit, not a blend", () => {
    const r = perModelAllowance([{ model: "deepseek-v4.1-flash", tokens: 88, limit_usd: 80 }, { model: "mimo-v2.6-flash", tokens: 12, limit_usd: 60 }]);
    expect(r.rule).toBe("single_model");
    if (r.rule !== "single_model") throw new Error("expected single_model");
    expect(r.main_model).toBe("deepseek-v4.1-flash");
    expect(r.usd).toBe(80);
    expect(r.parts[0].share).toBeCloseTo(0.88, 9);
  });
  test("the threshold is inclusive: exactly 70% is a main model", () => {
    expect(PER_MODEL_MAIN_SHARE).toBe(0.7);
    const r = perModelAllowance([{ model: "a", tokens: 70, limit_usd: 100 }, { model: "b", tokens: 30, limit_usd: 20 }]);
    expect(r.rule).toBe("single_model");
  });
  test("a main model with no published limit makes the rule unavailable, with the reason", () => {
    const r = perModelAllowance([{ model: "x", tokens: 90, limit_usd: null }, { model: "y", tokens: 10, limit_usd: 60 }]);
    expect(r.rule).toBe("unavailable");
    if (r.rule !== "unavailable") throw new Error("expected unavailable");
    expect(r.reason).toContain("publishes no monthly limit");
  });
});

describe("per-model limits: with no main model, the limits are weighted by token share (r53)", () => {
  test("a 60/40 split of two models with limits is 0.6 x $80 + 0.4 x $60 = $72", () => {
    const r = perModelAllowance([{ model: "deepseek-v4.1-flash", tokens: 60, limit_usd: 80 }, { model: "mimo-v2.6-flash", tokens: 40, limit_usd: 60 }]);
    expect(r.rule).toBe("weighted");
    if (r.rule !== "weighted") throw new Error("expected weighted");
    expect(r.usd).toBeCloseTo(72, 9);
    expect(r.parts.map((p) => p.share)).toEqual([0.6, 0.4]);
  });
  test("a model without a published limit in a split makes the weighted rule unavailable", () => {
    const r = perModelAllowance([{ model: "a", tokens: 50, limit_usd: 80 }, { model: "b", tokens: 50, limit_usd: null }]);
    expect(r.rule).toBe("unavailable");
  });
  test("no tokens is unavailable", () => {
    expect(perModelAllowance([{ model: "a", tokens: 0, limit_usd: 80 }]).rule).toBe("unavailable");
  });
});

describe("the official page supplies the limits (r53)", () => {
  const doc = { plans: [
    { plan: "Go", models: [
      { base: "DeepSeek V4.1 Flash", monthly_limit_usd: 80 }, { base: "DeepSeek V4.1 Flash", monthly_limit_usd: 80 },
      { base: "MiMo-V2.6-Flash", monthly_limit_usd: 60 }, { base: "Beam Free", monthly_limit_usd: null },
    ] },
    { plan: "Go Plus", models: [{ base: "DeepSeek V4.1 Flash", monthly_limit_usd: 160 }] },
  ] };
  test("Go's DeepSeek limit is $80 and MiMo's is $60; a model with no limit is absent", () => {
    const l = pageLimitsFor(doc, "Go");
    expect(limitOfUpstream("deepseek-v4.1-flash", l)).toBe(80);
    expect(limitOfUpstream("mimo-v2.6-flash", l)).toBe(60);
    expect(limitOfUpstream("some-unmapped-model", l)).toBeNull();
  });
  test("Go Plus's DeepSeek limit is $160", () => {
    expect(limitOfUpstream("deepseek-v4.1-flash", pageLimitsFor(doc, "Go Plus"))).toBe(160);
  });
  test("two rows for one model that disagree make the page refused", () => {
    const bad = { plans: [{ plan: "Go", models: [{ base: "X", monthly_limit_usd: 80 }, { base: "X", monthly_limit_usd: 90 }] }] };
    expect(() => pageLimitsFor(bad, "Go")).toThrow(/disagree/);
  });
});
