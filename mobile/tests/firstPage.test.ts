import { describe, expect, it } from "vitest";
import { createTrip } from "../../src/domain/workspace/tripForm";
import type { Reservation } from "../../src/domain/reservations/types";
import { dayPlan } from "../src/data/dayPlan";
import type { PackingItem, PageEntry } from "../src/data/model";
import { freeTimeSlots, heroFileName, heroSource, isJapanTrip, pendingFirstSteps, starterTitles } from "../src/data/firstPage";

const item = (id: string, title = id, done = false, tripId = "trip"): PackingItem => ({ id, tripId, title, done });
const page = (id: string, kind: PageEntry["kind"], extra: Partial<PageEntry> = {}): PageEntry => ({ id, tripId: "trip", kind, title: id, date: "2026-10-29", body: "", address: "", done: false, ...extra });

const tokyo = { timeZone: "Asia/Tokyo", localCurrency: "JPY" } as const;
const lisbon = { timeZone: "Europe/Lisbon", localCurrency: "EUR" } as const;

describe("starter packing list", () => {
  it("treats a Tokyo time zone or yen as a Japan trip", () => {
    expect(isJapanTrip(tokyo)).toBe(true);
    expect(isJapanTrip({ timeZone: "Asia/Seoul", localCurrency: "JPY" })).toBe(true);
    expect(isJapanTrip(lisbon)).toBe(false);
  });

  it("adds four Japan items to the twelve common ones unless the app is in Japanese", () => {
    const ko = starterTitles(tokyo, "ko", []);
    expect(ko).toHaveLength(16);
    expect(ko).toContain("여권");
    expect(ko).toContain("Visit Japan Web 등록");
    expect(starterTitles(lisbon, "ko", [])).toHaveLength(12);
    expect(starterTitles(lisbon, "ko", [])).not.toContain("Visit Japan Web 등록");
    expect(starterTitles(tokyo, "ja", [])).toHaveLength(12);
    expect(starterTitles(lisbon, "en-GB", [])[0]).toBe("Passport");
  });

  it("skips titles the list already has, ignoring case and spaces", () => {
    const titles = starterTitles(tokyo, "en-US", [{ title: "  passport " }, { title: "POWER   BANK" }]);
    expect(titles).toHaveLength(14);
    expect(titles).not.toContain("Passport");
    expect(titles).not.toContain("Power bank");
  });
});

describe("first page steps", () => {

  it("lists only the steps still to do, keeping packing while its undo is open", () => {
    expect(pendingFirstSteps({ packing: false, places: false }, false)).toEqual(["packing", "places"]);
    expect(pendingFirstSteps({ packing: true, places: false }, false)).toEqual(["places"]);
    expect(pendingFirstSteps({ packing: true, places: true }, true)).toEqual(["packing"]);
    expect(pendingFirstSteps({ packing: true, places: true }, false)).toEqual([]);
  });
});

const trip = createTrip({ title: "도쿄", startDate: "2026-10-28", endDate: "2026-11-02", timeZone: "Asia/Tokyo", baseCurrency: "KRW", members: [{ name: "나" }], coverColor: "ink" }, { id: "trip", now: new Date("2026-10-01T00:00:00Z") });
const stay: Reservation = { id: "hotel", kind: "stay", title: "LDK 니시카사이", startDate: "2026-10-28", endDate: "2026-11-02", timeZone: "Asia/Tokyo", updatedAt: "2026-10-01T00:00:00Z", address: "Nishikasai, Tokyo" };

describe("today map and free time", () => {
  it("finds free hours that have not ended and suggests food around meal times", () => {
    const plans = [page("a", "plan", { time: "08:00", minutes: 30 }), page("b", "plan", { time: "10:00", minutes: 60 }), page("c", "plan", { time: "12:30" })];
    const day = dayPlan(trip, plans, "2026-10-29");
    // a 08:30 끝 → b 10:00 시작(90분, 식사 시간 밖), b 11:00 끝 → c 12:30 시작(90분, 점심과 겹침)
    expect(freeTimeSlots(day, 0)).toEqual([{ start: 510, end: 600, category: "cafe" }, { start: 660, end: 750, category: "food" }]);
    expect(freeTimeSlots(day, 600)).toEqual([{ start: 660, end: 750, category: "food" }]);
  });
});

describe("first page photo", () => {
  it("shows the saved photo only while its file is still on the device", () => {
    expect(heroSource(null, () => true)).toEqual({ kind: "cover" });
    expect(heroSource("trip-1.jpg", () => false)).toEqual({ kind: "cover" });
    expect(heroSource("trip-1.jpg", (name) => name === "trip-1.jpg")).toEqual({ kind: "photo", name: "trip-1.jpg" });
  });

  it("names each copy after the notebook and the time so it never overwrites the previous photo", () => {
    expect(heroFileName("trip", new Date("2026-10-16T09:00:00Z"))).toBe(`trip-${Date.parse("2026-10-16T09:00:00Z")}.jpg`);
  });
});
