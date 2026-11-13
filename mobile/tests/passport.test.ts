import { describe, expect, it } from "vitest";
import { createTrip } from "../../src/domain/workspace/tripForm";
import type { TripWorkspace } from "../../src/domain/workspace/types";
import { emptyPassport, issueStamps, parsePassport, setTripCancelled, setTripCompleted, tripCountries } from "../src/data/passport";
import { STAMP_COUNTRIES } from "../src/data/stampCountries";

const trip = (id: string, timeZone: string, startDate: string, endDate: string, destination?: string): TripWorkspace =>
  createTrip({ title: `Trip ${id}`, destination, startDate, endDate, timeZone, baseCurrency: "KRW", members: [{ name: "나" }], coverColor: "ink" }, { id, now: new Date("2026-01-01T00:00:00Z") });

describe("passport stamps", () => {
  const osaka = trip("osaka", "Asia/Tokyo", "2026-11-10", "2026-11-14", "오사카, 교토");

  const completedPassport = (...ids: string[]) => ids.reduce((state, id) => setTripCompleted(state, id, true), emptyPassport());

  it("does not infer successful completion from an elapsed return date", () => {
    expect(issueStamps([osaka], emptyPassport(), new Date("2026-11-20T00:00:00Z")).issued).toEqual([]);
  });

  it("persists completion and requires confirmation again after cancellation", () => {
    const state = completedPassport("osaka");
    expect(parsePassport(JSON.stringify(state))).toEqual(state);
    const restored = setTripCancelled(setTripCancelled(state, "osaka", true), "osaka", false);
    expect(issueStamps([osaka], restored, new Date("2026-11-20T00:00:00Z")).issued).toEqual([]);
  });

  it("reads legacy storage without inventing completion", () => {
    expect(parsePassport(JSON.stringify({ stamps: [], cancelled: [] }))).toEqual(emptyPassport());
    expect(parsePassport("null")).toEqual(emptyPassport());
  });

  it("waits for the return day in the trip's time zone", () => {
    // 11/13 23:00 KST = 11/13 23:00 JST, 아직 귀국일 전
    expect(issueStamps([osaka], completedPassport("osaka"), new Date("2026-11-13T14:00:00Z")).issued).toEqual([]);
    // 11/14 00:10 JST
    const { issued } = issueStamps([osaka], completedPassport("osaka"), new Date("2026-11-13T15:10:00Z"));
    expect(issued).toHaveLength(1);
    expect(issued[0]).toMatchObject({ id: "osaka:JP", country: "JP", city: "오사카", date: "2026-11-14" });
  });

  it("stamps once even when run again", () => {
    const now = new Date("2026-11-20T00:00:00Z");
    const first = issueStamps([osaka], completedPassport("osaka"), now);
    const again = issueStamps([osaka], first.state, new Date("2026-11-21T00:00:00Z"));
    expect(again.issued).toEqual([]);
    expect(again.state).toBe(first.state);
    expect(again.state.stamps).toHaveLength(1);
  });

  it("gives a revisit on another trip its own stamp", () => {
    const tokyo = trip("tokyo", "Asia/Tokyo", "2027-03-01", "2027-03-03", "도쿄");
    const { state } = issueStamps([osaka, tokyo], completedPassport("osaka", "tokyo"), new Date("2027-03-04T00:00:00Z"));
    expect(state.stamps.map((s) => s.id)).toEqual(["osaka:JP", "tokyo:JP"]);
  });

  it("adds a stamp for each country with a stay", () => {
    const euro = trip("euro", "Europe/Paris", "2026-05-01", "2026-05-08", "파리");
    euro.reservations = [{ id: "r1", kind: "stay", title: "Hotel Roma", startDate: "2026-05-05", endDate: "2026-05-08", timeZone: "Europe/Rome", status: "booked" } as never];
    expect(tripCountries(euro).map((c) => c.country.code)).toEqual(["FR", "IT"]);
  });

  it("does not stamp a cancelled trip and takes back an issued one", () => {
    const now = new Date("2026-11-20T00:00:00Z");
    const issued = issueStamps([osaka], completedPassport("osaka"), now).state;
    const cancelled = issueStamps([osaka], setTripCancelled(issued, "osaka", true), now);
    expect(cancelled.state.stamps).toEqual([]);
    const restored = issueStamps([osaka], setTripCompleted(setTripCancelled(cancelled.state, "osaka", false), "osaka", true), now);
    expect(restored.issued).toHaveLength(1);
  });

  it("skips zones without a stamp design", () => {
    const unknown = trip("x", "Antarctica/Troll", "2026-01-01", "2026-01-02");
    expect(issueStamps([unknown], emptyPassport(), new Date("2026-02-01T00:00:00Z")).issued).toEqual([]);
  });

  it("reads broken storage as an empty passport", () => {
    expect(parsePassport("{bad")).toEqual(emptyPassport());
    expect(parsePassport(JSON.stringify({ stamps: [{ id: 1 }], cancelled: ["a", 2] }))).toEqual({ stamps: [], cancelled: ["a"], completed: [] });
  });

  it("has a unique design for every country code and zone", () => {
    const codes = STAMP_COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    const zones = STAMP_COUNTRIES.flatMap((c) => c.zones);
    expect(new Set(zones).size).toBe(zones.length);
  });
});
