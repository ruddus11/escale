import { describe, expect, it } from "vitest";
import { readDevNow } from "./devNow";

describe("readDevNow", () => {
  it("reads a fixed clock from the now query parameter", () => {
    expect(readDevNow("?now=2026-07-21T10:00:00%2B09:00")?.toISOString()).toBe(
      "2026-07-21T01:00:00.000Z",
    );
  });

  it("ignores a missing or invalid value", () => {
    expect(readDevNow("")).toBeUndefined();
    expect(readDevNow("?now=tomorrow")).toBeUndefined();
  });
});
