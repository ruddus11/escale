import { describe, expect, it } from "vitest";
import { monthGrid, weekGrid, shiftWeek } from "../src/data/planCalendar";

describe("plan calendar grid", () => {
  it("starts weeks on Sunday and pads the month", () => {
    const [nov] = monthGrid("2026-11-12", "2026-11-15");
    expect(nov.key).toBe("2026-11");
    // 2026-11-01은 일요일
    expect(nov.weeks[0][0]).toBe("2026-11-01");
    expect(nov.weeks.every((w) => w.length === 7)).toBe(true);
    expect(nov.weeks.flat().filter(Boolean)).toHaveLength(30);
  });
  it("spans months and years", () => {
    expect(monthGrid("2026-12-28", "2027-01-03").map((m) => m.key)).toEqual(["2026-12", "2027-01"]);
  });
  it("caps very long ranges", () => {
    expect(monthGrid("2026-01-01", "2027-12-31")).toHaveLength(6);
  });
});

describe("weekly calendar", () => {
  it("keeps the selected week's dates across year boundaries", () => {
    expect(weekGrid("2027-01-01")).toEqual(["2026-12-27", "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });
  it("moves one week and clamps navigation to the trip range", () => {
    expect(shiftWeek("2026-11-13", 1, "2026-11-12", "2026-11-16")).toBe("2026-11-16");
    expect(shiftWeek("2026-11-13", -1, "2026-11-12", "2026-11-16")).toBe("2026-11-12");
    expect(shiftWeek("2026-12-29", 1, "2026-12-20", "2027-01-15")).toBe("2027-01-05");
  });
  it("does not depend on daylight saving changes", () => {
    expect(weekGrid("2026-03-08")).toEqual(["2026-03-08", "2026-03-09", "2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13", "2026-03-14"]);
  });
});
