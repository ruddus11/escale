import { describe, it, expect } from "vitest";
import {
  emptyMemory,
  isDiaryMemory,
  passportStats,
} from "../src/data/diaryMemory";
import type { TripWorkspace } from "../../src/domain/workspace/types";
describe("diary memory", () => {
  it("validates dates, file paths and sensor data", () => {
    const d = emptyMemory("a", "2026-11-12");
    expect(isDiaryMemory(d)).toBe(true);
    expect(isDiaryMemory({ ...d, date: "2026-02-30" })).toBe(false);
    expect(
      isDiaryMemory({ ...d, voices: [{ file: "../private", seconds: 2 }] }),
    ).toBe(false);
    expect(isDiaryMemory({ ...d, steps: -1 })).toBe(false);
    expect(
      isDiaryMemory({
        ...d,
        route: [{ latitude: 91, longitude: 0, timestamp: 1 }],
      }),
    ).toBe(false);
  });
  it("deduplicates cities and excludes future trips without guessing countries", () => {
    const t = (destination: string, startDate = "2026-11-01") =>
      ({
        settings: { destination, startDate, endDate: "2026-11-03" },
      }) as TripWorkspace;
    const s = passportStats(
      [t("도쿄 / 교토"), t("도쿄"), t("Unknown"), t("파리", "2027-01-01")],
      new Date("2026-11-12"),
    );
    expect(s.countries).toEqual(["일본"]);
    expect(s.cities).toHaveLength(3);
    expect(s.trips).toBe(3);
  });
});

it("recognizes country names in three languages and separates country-only destinations from cities", () => {
  const trip = (destination: string) =>
    ({
      settings: {
        destination,
        startDate: "2026-11-01",
        endDate: "2026-11-02",
        timeZone: "Asia/Tokyo",
      },
    }) as TripWorkspace;
  const stats = passportStats(
    [trip("Japan / 일본 오사카 / オーストラリア / France Paris / Brazil")],
    new Date("2026-11-12"),
  );
  expect(stats.countries).toEqual([
    "일본",
    "오스트레일리아",
    "프랑스",
    "브라질",
  ]);
  expect(stats.cities).toEqual(["오사카", "Paris"]);
});
