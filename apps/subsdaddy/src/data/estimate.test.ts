import { describe, expect, test } from "bun:test";
import { REF_IDS, blendedUsdPerB, cacheFor, estimateOne, pooledMix } from "./estimate";

const MIX = { output_share: 0.5, agent_cache_share: 0.8 };

describe("blended list-price cost", () => {
  test("a 50/50 output and input mix with no cache is the average of the two prices, per billion", () => {
    // (1−0.5)(1−0)·1 + 0.5·0 ... -> 0.5·in + 0.5·out = 0.5·1 + 0.5·2 = 1.5 $/M = 1500 $/B
    expect(blendedUsdPerB({ in_per_m: 1, out_per_m: 2, cache_per_m: 0.1 }, { output_share: 0.5, cache_share: 0 })).toBeCloseTo(1500, 6);
  });

  test("cache reads replace fresh input at the cache price", () => {
    // o=0, c=1 -> cache price only: 0.1 $/M = 100 $/B
    expect(blendedUsdPerB({ in_per_m: 1, out_per_m: 2, cache_per_m: 0.1 }, { output_share: 0, cache_share: 1 })).toBeCloseTo(100, 6);
  });

  test("share outside [0,1] is refused, not clamped", () => {
    expect(() => blendedUsdPerB({ in_per_m: 1, out_per_m: 2, cache_per_m: 0.1 }, { output_share: 1.2, cache_share: 0 })).toThrow();
  });
});

describe("estimate formula", () => {
  test("estimate = (fee / allowance) × blended", () => {
    // fee $10, allowance $80 -> 0.125; blended 1500 $/B -> 187.5
    const e = estimateOne({ fee_usd: 10, allowance_usd: 80, allowance_reason: null, price: { in_per_m: 1, out_per_m: 2, cache_per_m: 0.1 }, mix: { output_share: 0.5, agent_cache_share: 0 }, shape: "interactive" });
    expect(e.fee_over_allowance).toBeCloseTo(0.125, 9);
    expect(e.usd_per_b).toBeCloseTo(187.5, 6);
    expect(e.reason).toBeNull();
  });

  test("no allowance means null with a reason, never a number and never zero", () => {
    const e = estimateOne({ fee_usd: 10, allowance_usd: null, allowance_reason: "token allowance only", price: { in_per_m: 1, out_per_m: 2, cache_per_m: 0.1 }, mix: MIX, shape: "agent" });
    expect(e.usd_per_b).toBeNull();
    expect(e.reason).toBe("token allowance only");
  });

  test("a zero or negative allowance is refused as unavailable", () => {
    const e = estimateOne({ fee_usd: 10, allowance_usd: 0, allowance_reason: null, price: { in_per_m: 1, out_per_m: 2, cache_per_m: 0.1 }, mix: MIX, shape: "agent" });
    expect(e.usd_per_b).toBeNull();
    expect(e.reason).toBe("no published usage-dollar allowance");
  });
});

describe("per-model matrix", () => {
  const flash = { in_per_m: 0.02, out_per_m: 1.0, cache_per_m: 0.015 };
  const gemini = { in_per_m: 0.825, out_per_m: 4.125, cache_per_m: 0.0825 };
  const haiku = { in_per_m: 0.1, out_per_m: 0.5, cache_per_m: 0.01 };
  const agentMix = { output_share: 0.0056, agent_cache_share: 0.9176 };
  const at = (price: { in_per_m: number; out_per_m: number; cache_per_m: number }) =>
    estimateOne({ fee_usd: 10, allowance_usd: 80, allowance_reason: null, price, mix: agentMix, shape: "agent" }).usd_per_b!;

  test("the same plan gives a different $/B for each reference model, ordered by the blended cost at the agent mix", () => {
    // Under the agent mix cache reads dominate, so Haiku's cache price ($0.010/M) puts it below DeepSeek V4.1 Flash
    // ($0.015/M) even though DeepSeek's input price is lower. The ranking follows the blend, not the input price alone.
    expect(at(gemini)).toBeGreaterThan(at(flash));
    expect(at(flash)).toBeGreaterThan(at(haiku));
  });

  test("each model's value is (fee/allowance) x its own blended cost", () => {
    const p = { in_per_m: 1, out_per_m: 2, cache_per_m: 0.1 };
    const e = estimateOne({ fee_usd: 10, allowance_usd: 80, allowance_reason: null, price: p, mix: { output_share: 0.5, agent_cache_share: 0 }, shape: "interactive" });
    expect(e.usd_per_b).toBeCloseTo(0.125 * 1500, 6);
  });

  test("a model with no allowance in a plan is refused with its reason, never zero", () => {
    const e = estimateOne({ fee_usd: 10, allowance_usd: null, allowance_reason: "no published allowance for this model in this plan", price: gemini, mix: agentMix, shape: "agent" });
    expect(e.usd_per_b).toBeNull();
    expect(e.reason).toBe("no published allowance for this model in this plan");
  });

  test("the reference set is exactly the five models the page names, in display order", () => {
    expect([...REF_IDS]).toEqual(["deepseek-v4.1-flash", "gemini-3.8-flash", "claude-haiku-5.5", "gpt-6-luna", "glm-5.3-flash"]);
  });

  test("GLM-5.3-Flash has a cache price three times Haiku's, so it is higher than Haiku on the cache-heavy mix", () => {
    const glm = { in_per_m: 0.15, out_per_m: 0.5, cache_per_m: 0.03 };
    const haiku = { in_per_m: 0.1, out_per_m: 0.5, cache_per_m: 0.01 };
    const heavy = { output_share: 0.0056, cache_share: 0.94 };
    expect(blendedUsdPerB(glm, heavy)).toBeGreaterThan(blendedUsdPerB(haiku, heavy));
    expect(glm.cache_per_m / haiku.cache_per_m).toBeCloseTo(3, 9);
  });
});

describe("credits folding", () => {
  test("a fixed credit count times the usage dollars per credit gives the real fee per usage dollar", () => {
    // QwenCloud: $10 for 25,500 credits, 1 credit = $1 of usage (stated assumption): fee per usage $ = 10/25500
    const usdPerCredit = 10 / 25500;
    const allowance = 25500 * 1;
    const folded = estimateOne({ fee_usd: 10, allowance_usd: allowance, allowance_reason: null, price: { in_per_m: 1, out_per_m: 2, cache_per_m: 0.1 }, mix: { output_share: 0.5, agent_cache_share: 0 }, shape: "interactive" });
    expect(folded.fee_over_allowance).toBeCloseTo(usdPerCredit, 12);
  });
});

describe("measured mix", () => {
  test("pooled output share and agent cache share come from the summed lanes", () => {
    const mix = pooledMix([
      { tokens: { input: 100, cache_creation: 0, cache_read: 800, output: 100 } },
      { tokens: { input: 100, cache_creation: 0, cache_read: 0, output: 0 } },
    ]);
    expect(mix.output_share).toBeCloseTo(100 / 1100, 9);
    expect(mix.agent_cache_share).toBeCloseTo(800 / 1000, 9);
  });

  test("cache share for each shape: interactive 0, cache_heavy 0.94, agent measured", () => {
    expect(cacheFor("interactive", MIX)).toBe(0);
    expect(cacheFor("cache_heavy", MIX)).toBe(0.94);
    expect(cacheFor("agent", MIX)).toBe(0.8);
  });
});
