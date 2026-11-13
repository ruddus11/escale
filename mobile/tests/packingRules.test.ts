import { describe, expect, it } from "vitest";
import { packingSuggestions, seasonForTrip, tripLengthDays } from "../src/data/packingRules";

const settings = { destination: "Japan", timeZone: "Asia/Tokyo", localCurrency: "JPY" } as const;

describe("local packing rules", () => {
  it("uses the travel hemisphere and starting month for seasons", () => {
    expect(seasonForTrip("2026-01-10", "Asia/Tokyo")).toBe("winter");
    expect(seasonForTrip("2026-01-10", "Australia/Sydney")).toBe("summer");
    expect(seasonForTrip("2026-10-10", "Europe/Lisbon")).toBe("autumn");
    expect(seasonForTrip("2026-07-10", "America/Santiago")).toBe("winter");
  });
  it("counts both endpoints and scales clothing for longer trips", () => {
    expect(tripLengthDays("2026-01-01", "2026-01-01")).toBe(1);
    const short = packingSuggestions({ ...settings, startDate: "2026-01-01", endDate: "2026-01-02" }, "en-US", [], []);
    const long = packingSuggestions({ ...settings, startDate: "2026-01-01", endDate: "2026-01-09" }, "en-US", [], []);
    expect(short.some((x) => x.includes("3 changes"))).toBe(false);
    expect(long.some((x) => x.includes("7 changes"))).toBe(true);
  });
  it("carries only unchecked past items and deduplicates against current items", () => {
    const result = packingSuggestions({ ...settings, startDate: "2026-07-01", endDate: "2026-07-03" }, "en-US", [{ title: "  SUNSCREEN " }], [
      { tripId: "old", title: "Rain jacket", done: false },
      { tripId: "old", title: "rain  jacket", done: false },
      { tripId: "old", title: "Checked", done: true },
      { tripId: "current", title: "Current only", done: false },
    ], "current");
    expect(result.filter((x) => x.toLowerCase() === "rain jacket")).toHaveLength(1);
    expect(result).not.toContain("Checked");
    expect(result).not.toContain("Current only");
    expect(result.some((x) => x.toLowerCase() === "sunscreen")).toBe(false);
  });
});
