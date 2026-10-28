import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { commandcodeLive } from "./live";

const lanes = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "data", "lanes.json"), "utf8")).lanes;
const cc = lanes.find((l: { lane: string }) => l.lane === "commandcode-goat");

describe("CommandCode live reading (r59)", () => {
  test("the live flag matches the lane: a binding window means a reading, none means N/A", () => {
    expect(commandcodeLive).toBe(cc.capacity.window !== null);
  });
  test("with no live reading, CommandCode is not ranked and its reason is recorded", () => {
    if (commandcodeLive) return;
    expect(cc.usd_per_b).toBeNull();
    expect(cc.capacity.reason).toBeTruthy();
  });
});
