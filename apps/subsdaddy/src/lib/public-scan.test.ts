import { describe, expect, test } from "bun:test";
import { findLocalIdentifiers } from "./public-scan";

describe("local identifier scan", () => {
  test("plan ids and plan names pass", () => {
    expect(findLocalIdentifiers('data-lane-row="zai-glm-max" data-lane-row="qwen-cloud-token" OpenCode Go CommandCode GOAT')).toEqual([]);
  });

  test("account labels and pre-plan lane ids are caught", () => {
    expect(findLocalIdentifiers("subscription jun1 and jun2")).toEqual(["jun1", "jun2"]);
    expect(findLocalIdentifiers('{"lane":"go-1"} go-2')).toEqual(["go-1", "go-2"]);
    expect(findLocalIdentifiers("lane cc is wrong")).toEqual(["cc"]);
  });

  test("a match inside a longer word is not a local identifier", () => {
    expect(findLocalIdentifiers("account ccxyz, zaiglm, mojun1x")).toEqual([]);
  });
});
