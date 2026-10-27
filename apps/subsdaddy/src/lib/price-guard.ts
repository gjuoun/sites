import type { PriceTriple } from "./official-prices";

/**
 * The sanity rule for an OpenRouter listing: a refused listing never replaces the last verified snapshot.
 */
export function sanity(p: { in_per_m: number | null; out_per_m: number | null; cache_per_m: number | null }): string | null {
  const { in_per_m: i, out_per_m: o, cache_per_m: c } = p;
  if (i === null || o === null || c === null) return "a price is missing";
  if (![i, o, c].every((v) => Number.isFinite(v) && v > 0)) return "a price is zero or negative";
  if (o < i) return "listing shows completion < prompt (" + o + " < " + i + " per M)";
  if (c > i) return "listing shows cache read > prompt (" + c + " > " + i + " per M)";
  return null;
}

export type Reconciled = {
  status: "official" | "verified" | "anomaly" | "unavailable";
  values: PriceTriple;
  note: string | null;
};

const fmt = (p: PriceTriple) => p.in_per_m + " / " + p.out_per_m + " / " + p.cache_per_m;
const same = (a: PriceTriple, b: PriceTriple) => Math.abs(a.in_per_m - b.in_per_m) < 1e-9 && Math.abs(a.out_per_m - b.out_per_m) < 1e-9 && Math.abs(a.cache_per_m - b.cache_per_m) < 1e-9;

/**
 * Which price a reference model uses.
 *  official   the provider's own table is read: it is the price, and a disagreeing listing is rejected and recorded
 *  verified   no official table; the listing passed the sanity rule
 *  anomaly    no official table; the listing was refused; the last verified snapshot stays
 *  unavailable no listing; the snapshot stays
 */
export function reconcile(i: {
  official: PriceTriple | null;
  listing: PriceTriple | null;
  listingRefusal: string | null;
  snapshot: PriceTriple;
  snapshotDate: string;
}): Reconciled {
  if (i.official) {
    if (i.listing === null) return { status: "official", values: i.official, note: "listing not read; the official price table is the price" };
    if (same(i.listing, i.official)) return { status: "official", values: i.official, note: "listing agrees with the official price table" };
    return {
      status: "official",
      values: i.official,
      note: "Official documentation is authoritative for first-party models; the aggregator listing disagreed and was rejected (listing " + fmt(i.listing) + " per M; official " + fmt(i.official) + " per M)",
    };
  }
  if (i.listing && !i.listingRefusal) return { status: "verified", values: i.listing, note: null };
  if (i.listingRefusal) {
    return { status: "anomaly", values: i.snapshot, note: "price_anomaly: " + i.listingRefusal + "; using last verified snapshot " + i.snapshotDate };
  }
  return { status: "unavailable", values: i.snapshot, note: "listing not fetched; last verified " + i.snapshotDate };
}
