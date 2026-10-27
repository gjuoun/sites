import { describe, expect, test } from "bun:test";
import { CONTEXTS, DAYS_PER_MONTH, OUTPUT_TOKENS_PER_MESSAGE, WINDOWS_PER_DAY, boundMessages, monthlyTokens, tokensPerMessage, usdPerBOfTokens } from "./messages";

describe("message to token conversion", () => {
  test("the output per message is the 462-token recount, not the earlier 467", () => {
    expect(OUTPUT_TOKENS_PER_MESSAGE).toBe(462);
  });

  test("1 message = 100,462 tokens at the 100K standard (100,000 context + 462 output)", () => {
    expect(tokensPerMessage(CONTEXTS.short)).toBe(100_462);
  });

  test("350K standard: 350,462 tokens per message", () => {
    expect(tokensPerMessage(CONTEXTS.long)).toBe(350_462);
  });

  test("the ceiling rhythm is 24 hours over 5-hour windows: 4.8 windows a day, not 33.6", () => {
    expect(WINDOWS_PER_DAY.ceiling).toBeCloseTo(4.8, 9);
    expect(WINDOWS_PER_DAY.realistic).toBe(3);
    expect(DAYS_PER_MONTH).toBe(30);
  });

  test("the front page uses the lower bound of the vendor range: 350 of 350-3,000", () => {
    expect(boundMessages({ low: 350, high: 3000 }, "low")).toBe(350);
    expect(boundMessages({ low: 350, high: 3000 }, "high")).toBe(3000);
  });

  test("Codex Plus on GPT-6 Luna, lower bound, realistic, at 100K: 350 × 3 × 30 × 100,462 tokens a month", () => {
    expect(monthlyTokens({ low: 350, high: 3000 }, CONTEXTS.short, WINDOWS_PER_DAY.realistic)).toBeCloseTo(350 * 3 * 30 * 100_462, 3);
  });

  test("the upper bound gives more tokens than the lower bound, at the same context", () => {
    const lo = monthlyTokens({ low: 350, high: 3000 }, CONTEXTS.short, 3, "low");
    const hi = monthlyTokens({ low: 350, high: 3000 }, CONTEXTS.short, 3, "high");
    expect(hi).toBeGreaterThan(lo);
  });

  test("the $/B of a token capacity is the fee over its billions of tokens", () => {
    const t = monthlyTokens({ low: 350, high: 3000 }, CONTEXTS.short, WINDOWS_PER_DAY.realistic);
    expect(usdPerBOfTokens(20, t)).toBeCloseTo(20 / (t / 1e9), 9);
  });

  test("at the lower bound, Codex Plus is no longer cheaper than OpenCode Go per billion tokens at 100K", () => {
    const t = monthlyTokens({ low: 350, high: 3000 }, CONTEXTS.short, WINDOWS_PER_DAY.realistic);
    expect(usdPerBOfTokens(20, t)).toBeGreaterThan(2.72);
  });
});
