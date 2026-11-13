import { describe, expect, it } from "vitest";
import type { Reservation } from "../../src/domain/reservations/types";
import type { DayPlan, TimelineItem } from "../src/data/dayPlan";
import { createTrip } from "../../src/domain/workspace/tripForm";
import type { PageEntry } from "../src/data/model";
import { overviewPlan, overviewStay, pickNowNext } from "../src/data/overviewItems";

const outbound: Reservation = { id: "out", kind: "flight", title: "Outbound", departure: "CJJ", arrival: "KIX", startDate: "2026-12-21", startTime: "16:40", timeZone: "Asia/Seoul", updatedAt: "" };
const inbound: Reservation = { ...outbound, id: "back", title: "Return", startDate: "2026-12-24", startTime: "20:20", timeZone: "Asia/Tokyo" };
const schedule: TimelineItem = { id: "plan", kind: "imported", title: "Museum", detail: "", done: false, start: 660, startAt: Date.parse("2026-12-22T02:00:00Z") };
const plan = (...timed: TimelineItem[]): DayPlan => ({ timed, untimed: [], links: [] });

describe("overview now and next", () => {
  it("shows departure then return before the trip in both modes", () => {
    for (const mode of ["j", "p"] as const) {
      const result = pickNowNext([inbound, outbound], plan(), new Date("2026-11-05T00:00:00Z"), "before", mode);
      expect(result.map((item) => item.kind === "flight" ? item.reservation.id : item.item.id)).toEqual(["out", "back"]);
    }
  });
  it("shows a timed schedule before a distant return flight during the trip", () => {
    const result = pickNowNext([outbound, inbound], plan(schedule), new Date("2026-12-22T00:00:00Z"), "during", "j");
    expect(result.map((item) => item.kind)).toEqual(["schedule", "flight"]);
  });
  it("uses the return flight as now after departure when nothing else is scheduled", () => {
    expect(pickNowNext([outbound, inbound], plan(), new Date("2026-12-22T00:00:00Z"), "during", "p")[0]).toMatchObject({ kind: "flight", reservation: { id: "back" } });
  });
  it("falls back to schedule without flights and never repeats a flight from the plan", () => {
    const flightItem: TimelineItem = { id: "move-out", kind: "move", title: "Outbound", detail: "", done: false, reservation: outbound, start: 1000, startAt: Date.parse("2026-12-21T07:40:00Z") };
    expect(pickNowNext([], plan(schedule), new Date("2026-12-22T00:00:00Z"), "during", "j")[0]?.kind).toBe("schedule");
    expect(pickNowNext([outbound, inbound], plan(flightItem), new Date("2026-12-21T00:00:00Z"), "during", "j")).toHaveLength(2);
    expect(pickNowNext([outbound, inbound], plan(), new Date("2026-12-25T00:00:00Z"), "after", "j")).toEqual([]);
  });
  it("finds a timed plan on a later day when today has no remaining schedule", () => {
    const trip = createTrip({ title: "Osaka", startDate: "2026-12-21", endDate: "2026-12-24", timeZone: "Asia/Tokyo", baseCurrency: "KRW", members: [{ name: "Me" }], coverColor: "ink" }, { id: "trip", now: new Date("2026-12-01T00:00:00Z") });
    const page: PageEntry = { id: "later", tripId: trip.id, kind: "plan", title: "Museum", date: "2026-12-23", time: "11:00", body: "", address: "", done: false };
    const now = new Date("2026-12-22T00:00:00Z");
    expect(pickNowNext([], overviewPlan(trip, [page], now), now, "during", "j")[0]).toMatchObject({ kind: "schedule", item: { id: "page-later" } });
  });
});

describe("overview stay", () => {
  const stay = (id: string, startDate: string, endDate?: string, extra: Partial<Reservation> = {}): Reservation => ({ id, kind: "stay", title: id, startDate, endDate, timeZone: "Asia/Tokyo", updatedAt: "", ...extra });
  const first = stay("A", "2026-12-21", "2026-12-23");
  const second = stay("B", "2026-12-23", "2026-12-24", { startTime: "18:00" });
  // 도쿄 시각 = UTC+9. 예: 12/23 09:00 도쿄 = 12/23 00:00Z.
  const shown = (reservations: Reservation[], at: string) => {
    const result = overviewStay(reservations, new Date(at));
    return result && [result.stay.id, result.when];
  };

  it("keeps the old stay without a checkout time until the next stay's check-in", () => {
    expect(shown([first, second], "2026-12-23T00:00:00Z")).toEqual(["A", "checkout"]);
    expect(shown([first, second], "2026-12-23T12:00:00Z")).toEqual(["B", "tonight"]);
  });
  it("switches at the saved checkout time on a hotel-change day", () => {
    const timed = { ...first, endTime: "11:00" };
    expect(shown([timed, second], "2026-12-23T00:00:00Z")).toEqual(["A", "checkout"]);
    expect(shown([timed, second], "2026-12-23T03:00:00Z")).toEqual(["B", "tonight"]);
  });
  it("keeps a saved checkout even when the next stay has already checked in", () => {
    const timed = { ...first, endTime: "12:00" };
    expect(shown([timed, { ...second, startTime: "11:00" }], "2026-12-23T02:30:00Z")).toEqual(["A", "checkout"]);
  });
  it("uses the next stay all day when its check-in time is unknown and the old checkout too", () => {
    expect(shown([first, { ...second, startTime: undefined }], "2026-12-23T00:00:00Z")).toEqual(["B", "tonight"]);
  });
  it("shows the last stay on checkout day and hides it afterwards", () => {
    const timed = { ...first, endTime: "11:00" };
    expect(shown([timed], "2026-12-23T00:00:00Z")).toEqual(["A", "checkout"]);
    expect(shown([timed], "2026-12-23T03:00:00Z")).toBeUndefined();
  });
  it("shows tonight for a stay in progress or checking in later today", () => {
    expect(shown([first], "2026-12-22T00:00:00Z")).toEqual(["A", "tonight"]);
    expect(shown([{ ...first, startTime: "15:00" }], "2026-12-21T00:00:00Z")).toEqual(["A", "tonight"]);
    expect(shown([stay("open", "2026-12-21")], "2026-12-21T00:00:00Z")).toEqual(["open", "tonight"]);
  });
  it("shows the next check-in between stays and never a finished stay", () => {
    const later = stay("C", "2026-12-26", "2026-12-27");
    expect(shown([first, later], "2026-12-24T00:00:00Z")).toEqual(["C", "upcoming"]);
    expect(shown([first], "2026-12-24T00:00:00Z")).toBeUndefined();
    expect(shown([stay("open", "2026-12-21")], "2026-12-24T00:00:00Z")).toBeUndefined();
    expect(shown([], "2026-12-24T00:00:00Z")).toBeUndefined();
  });
});
