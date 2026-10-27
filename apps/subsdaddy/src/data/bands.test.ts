import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blendedUsdPerB, priceAt, type RefPrice } from "./estimate";
import { catalogFileSchema, catalogRowSchema } from "./catalog";
import { modelsFileSchema } from "./schema";
import { LMC_CONTEXT_LONG, LMC_CONTEXT_SHORT } from "./context";

const DATA = join(import.meta.dir, "..", "..", "data");
const read = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const models = modelsFileSchema.parse(read("models.json"));
const catalog = catalogFileSchema.parse(read("catalog.json"));
const ref = (id: string): RefPrice => {
  const r = models.reference.find((x) => x.ref === id)!;
  return { in_per_m: r.in_per_m, out_per_m: r.out_per_m, cache_per_m: r.cache_per_m, cache_write_per_m: r.cache_write_per_m ?? null, overrides: r.overrides };
};
const HAIKU = ref("claude-haiku-5.5");
const LUNA = ref("gpt-6-luna");
const SHORT = LMC_CONTEXT_SHORT; // 100K
const LONG = LMC_CONTEXT_LONG; // 350K

describe("standard contexts select the price band", () => {
  test("the standards are 100K and 350K", () => {
    expect(SHORT).toBe(100_000);
    expect(LONG).toBe(350_000);
  });





  test("a model with no override is priced at its base at any context, and says so", () => {
    const ds = ref("deepseek-v4.1-flash");
    expect(priceAt(ds, LONG).band).toBe("base price (no prompt-length band)");
    expect(priceAt(ds, LONG).price.in_per_m).toBe(ds.in_per_m);
  });




  test("the basis of a shipped estimate names the two standards and the p75 sensitivity point", () => {
    const oc = catalog.rows.find((r) => r.plan_id === "opencode-go-go")!;
    expect(oc.estimate!.basis).toContain("standard contexts: 100K (table) and 350K");
    expect(oc.estimate!.basis).toContain("p75");
    expect(oc.estimate!.basis).toContain("cache write share");
  });
});

describe("cache writes are priced, not folded into input", () => {
  test("a cache-write share raises the blend when the write price is above input (Haiku: 0.125 vs 0.1)", () => {
    const none = blendedUsdPerB(HAIKU, { output_share: 0.01, cache_share: 0.5, cache_write_share: 0 });
    const some = blendedUsdPerB(HAIKU, { output_share: 0.01, cache_share: 0.5, cache_write_share: 0.2 });
    expect(some).toBeGreaterThan(none);
  });

  test("with no write share the blend is exactly the old formula", () => {
    const ds = ref("deepseek-v4.1-flash");
    const o = 0.0063;
    const c = 0.84;
    const old = ((1 - o) * (1 - c) * ds.in_per_m + (1 - o) * c * ds.cache_per_m + o * ds.out_per_m) / 1e6 * 1e9;
    expect(blendedUsdPerB(ds, { output_share: o, cache_share: c })).toBeCloseTo(old, 9);
  });

  test("read plus write may not exceed the prompt", () => {
    expect(() => blendedUsdPerB(HAIKU, { output_share: 0.1, cache_share: 0.8, cache_write_share: 0.5 })).toThrow();
  });
});

describe("third-party figures: labelled, linked, or refused", () => {
  const base = catalog.rows.find((r) => r.plan_id === "claude-code-pro")!;

  test("a third-party source without a link is refused", () => {
    const bad = { ...base, sources: [...base.sources, { kind: "third_party_measured", url: null, note: "third-party measured, no link" }] };
    expect(catalogRowSchema.safeParse(bad).success).toBe(false);
  });

  test("a third-party source with a link is accepted", () => {
    const ok = { ...base, sources: [...base.sources, { kind: "third_party_measured", url: "https://example.com/measured", note: "third-party measured (example)" }] };
    expect(catalogRowSchema.safeParse(ok).success).toBe(true);
  });

  test("a third-party allowance without a third-party source is refused", () => {
    const bad = { ...base, allowance: [{ ref: "*", usd: 1000, basis: "third-party measured weekly API equivalent" }] };
    expect(catalogRowSchema.safeParse(bad).success).toBe(false);
  });

  test("no shipped row uses an unlinked third-party figure", () => {
    for (const r of catalog.rows) for (const s of r.sources) if (s.kind === "third_party_measured") expect(s.url).toBeTruthy();
  });

  test("Haiku at 100K is the low tier: the base price, not the 5x band (100K is at the threshold, so it stays below)", () => {
    const a = priceAt(HAIKU, SHORT);
    expect(a.band).toBe("band: ≤100k base");
    expect([a.price.in_per_m, a.price.out_per_m, a.price.cache_per_m]).toEqual([0.1, 0.5, 0.01]);
  });

  test("a prompt of exactly 100,000 tokens takes the low tier; 100,001 takes the high tier", () => {
    expect(priceAt(HAIKU, 100_000).price.in_per_m).toBe(0.1);
    expect(priceAt(HAIKU, 100_001).price.in_per_m).toBe(0.5);
    expect(priceAt(HAIKU, 100_001).band).toBe("band: >100k ×5");
  });

  test("Haiku at 350K is the high tier: 5x input, output, cache and cache write", () => {
    const a = priceAt(HAIKU, LONG);
    expect(a.band).toBe("band: >100k ×5");
    expect([a.price.in_per_m, a.price.out_per_m, a.price.cache_per_m, a.price.cache_write_per_m]).toEqual([0.5, 2.5, 0.05, 0.625]);
  });

  test("Luna at 100K is at base (its band starts above 272K); 272,000 is base, 272,001 is the high tier", () => {
    expect(priceAt(LUNA, SHORT).band).toBe("band: ≤272k base");
    expect(priceAt(LUNA, 272_000).price.in_per_m).toBe(0.1);
    expect(priceAt(LUNA, 272_001).band).toBe("band: >272k ×2");
  });

  test("Luna at 350K is the high tier: 2x input, 1.5x output", () => {
    const a = priceAt(LUNA, LONG);
    expect(a.band).toBe("band: >272k ×2");
    expect([a.price.in_per_m, a.price.out_per_m]).toEqual([0.2, 0.75]);
  });

  test("at 100K, Haiku and Luna are at the same base price", () => {
    expect(priceAt(HAIKU, SHORT).price.in_per_m).toBe(priceAt(LUNA, SHORT).price.in_per_m);
    expect(priceAt(HAIKU, SHORT).price.out_per_m).toBe(priceAt(LUNA, SHORT).price.out_per_m);
  });

  test("the shipped OpenCode Go estimate at 100K: Haiku and Luna both at base, so equal $/B", () => {
    const oc = catalog.rows.find((r) => r.plan_id === "opencode-go-go")!;
    const h = oc.estimate!.values.find((v) => v.ref === "claude-haiku-5.5" && v.shape === "agent")!;
    const l = oc.estimate!.values.find((v) => v.ref === "gpt-6-luna" && v.shape === "agent")!;
    expect(h.band_short).toBe("band: ≤100k base");
    expect(l.band_short).toBe("band: ≤272k base");
    expect(h.usd_per_b!).toBeCloseTo(l.usd_per_b!, 9);
  });

  test("the shipped 350K values: Haiku at its 5x band, Luna at its 2x band", () => {
    const oc = catalog.rows.find((r) => r.plan_id === "opencode-go-go")!;
    const h = oc.estimate!.values.find((v) => v.ref === "claude-haiku-5.5" && v.shape === "agent")!;
    const l = oc.estimate!.values.find((v) => v.ref === "gpt-6-luna" && v.shape === "agent")!;
    expect(h.band_long).toBe("band: >100k ×5");
    expect(l.band_long).toBe("band: >272k ×2");
    expect(l.usd_per_b_long!).toBeGreaterThan(l.usd_per_b!);
  });
});
