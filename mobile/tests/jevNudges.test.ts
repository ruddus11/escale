import { describe, expect, it } from "vitest";
import { jevNudges, LEAD, type NudgeInput } from "../src/data/jevNudges";
import type { TimelineItem } from "../src/data/dayPlan";

const now = new Date("2027-01-02T03:00:00Z");
const plan = (minutesAhead: number, title = "오사카성"): TimelineItem =>
  ({ kind: "plan", id: "p", title, detail: "", start: 12 * 60 + minutesAhead, done: false, page: {} as never, startAt: now.getTime() + minutesAhead * 60000 }) as TimelineItem;
const base: NudgeInput = { phase: "during", now, spent: 0, until: 0, packingLeft: 0, packingTotal: 0, reservations: 1 };

describe("JEV nudges", () => {
  it("says to leave now inside the lead time", () => {
    expect(jevNudges({ ...base, next: plan(LEAD.plan) })[0]).toEqual({ kind: "leave", title: "오사카성", minutes: 30, time: "12:30" });
  });
  it("only announces the next plan when there is time", () => {
    expect(jevNudges({ ...base, next: plan(90) })[0].kind).toBe("next");
  });
  it("gives flights a longer lead", () => {
    const flight = { ...plan(150, "KE724"), kind: "move", reservation: { kind: "flight" } } as unknown as TimelineItem;
    expect(jevNudges({ ...base, next: flight })[0].kind).toBe("leave");
  });
  it("reports budget use from 70% and overspending first", () => {
    expect(jevNudges({ ...base, next: plan(120), spent: 70000, dailyBudget: 100000 })).toEqual([
      { kind: "next", title: "오사카성", minutes: 120, time: "14:00" },
      { kind: "budget", percent: 70 },
    ]);
    expect(jevNudges({ ...base, next: plan(120), spent: 69999, dailyBudget: 100000 }).map((n) => n.kind)).toEqual(["next"]);
    expect(jevNudges({ ...base, next: plan(120), spent: 120000, dailyBudget: 100000 })[0]).toEqual({ kind: "overBudget", over: 20000 });
  });
  it("tells when the day is clear", () => {
    expect(jevNudges(base)).toEqual([{ kind: "dayClear" }]);
  });
  it("counts down before the trip and asks for bookings first", () => {
    expect(jevNudges({ ...base, phase: "before", until: 5, reservations: 0, packingLeft: 3, packingTotal: 5 })).toEqual([{ kind: "countdown", days: 5 }, { kind: "addBookings" }]);
    expect(jevNudges({ ...base, phase: "before", until: 5, packingLeft: 3, packingTotal: 5 })[1]).toEqual({ kind: "packing", left: 3 });
  });
  it("closes the trip after the return day", () => {
    expect(jevNudges({ ...base, phase: "after" })).toEqual([{ kind: "tripDone" }]);
  });
});
