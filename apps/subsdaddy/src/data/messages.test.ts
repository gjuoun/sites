import { describe, expect, test } from "bun:test";
import { CONTEXTS, DAYS_PER_MONTH, WINDOWS_PER_DAY, midpointMessages, monthlyTokens, tokensPerMessage, usdPerBOfTokens } from "./messages";

describe("message to token conversion", () => {
  test("1 message = 100,467 tokens at the 100K standard (100,000 context + 467 output)", () => {
    expect(tokensPerMessage(CONTEXTS.short)).toBe(100_467);
  });

  test("350K standard: 350,467 tokens per message", () => {
    expect(tokensPerMessage(CONTEXTS.long)).toBe(350_467);
  });

  test("the ceiling rhythm is 24 hours over 5-hour windows: 4.8 windows a day, not 33.6", () => {
    expect(WINDOWS_PER_DAY.ceiling).toBeCloseTo(4.8, 9);
    expect(WINDOWS_PER_DAY.realistic).toBe(3);
    expect(DAYS_PER_MONTH).toBe(30);
  });

  test("a range is shown at its midpoint: 350-3,000 is 1,675 messages per window", () => {
    expect(midpointMessages(350, 3000)).toBe(1675);
  });

  test("Codex Plus on GPT-6 Luna, realistic at 100K: 1,675 × 3 × 30 × 100,467 tokens a month", () => {
    expect(monthlyTokens({ low: 350, high: 3000 }, CONTEXTS.short, WINDOWS_PER_DAY.realistic)).toBeCloseTo(1675 * 3 * 30 * 100_467, 3);
  });

  test("the $/B of a token capacity is the fee over its billions of tokens", () => {
    const t = monthlyTokens({ low: 350, high: 3000 }, CONTEXTS.short, WINDOWS_PER_DAY.realistic);
    expect(usdPerBOfTokens(20, t)).toBeCloseTo(20 / (t / 1e9), 9);
  });

  test("a longer context gives fewer messages' worth of value per dollar: $/B at 350K is below $/B at 100K", () => {
    const a = usdPerBOfTokens(20, monthlyTokens({ low: 350, high: 3000 }, CONTEXTS.short, 3));
    const b = usdPerBOfTokens(20, monthlyTokens({ low: 350, high: 3000 }, CONTEXTS.long, 3));
    expect(b).toBeLessThan(a);
  });
});
