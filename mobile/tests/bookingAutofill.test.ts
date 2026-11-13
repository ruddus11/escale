import { afterEach, describe, expect, it } from "vitest";
import { createTrip } from "../../src/domain/workspace/tripForm";
import { createTripLibrary } from "../../src/domain/workspace/library";
import type { Reservation } from "../../src/domain/reservations/types";
import type { TripWorkspace } from "../../src/domain/workspace/types";
import { parseNotebook, type PageEntry } from "../src/data/model";
import { dayPlan, mapTargets } from "../src/data/dayPlan";
import { freeTimeSlots } from "../src/data/firstPage";
import { dayWindow } from "../src/data/recommend";
import {
  applySuggestions,
  autofillId,
  autofillSource,
  bookingSuggestions,
  isStayAutofill,
  parseHandled,
  plannedLines,
  rememberHandled,
  type Suggestion,
} from "../src/data/bookingAutofill";

const tokyo = (reservations: Reservation[], extra: Partial<TripWorkspace["settings"]> = {}): TripWorkspace => {
  const trip = createTrip({ title: "오사카", startDate: "2026-11-05", endDate: "2026-11-08", timeZone: "Asia/Tokyo", baseCurrency: "KRW", members: [{ name: "나" }], coverColor: "ink" }, { id: "trip", now: new Date("2026-11-01T00:00:00Z") });
  return { ...trip, settings: { ...trip.settings, ...extra }, reservations };
};
const res = (r: Partial<Reservation> & Pick<Reservation, "id" | "kind">): Reservation => ({ title: r.id, startDate: "2026-11-05", timeZone: "Asia/Tokyo", updatedAt: "2026-11-01T00:00:00Z", ...r });
const hotel = res({ id: "h1", kind: "stay", title: "Hotel Umeda", startDate: "2026-11-05", startTime: "15:00", endDate: "2026-11-08", endTime: "11:00", address: "Umeda 1-1, Osaka" });
const inbound = res({ id: "f1", kind: "flight", title: "KE723", serviceNumber: "KE723", startDate: "2026-11-05", startTime: "12:00", timeZone: "Asia/Seoul", endDate: "2026-11-05", endTime: "14:10", endTimeZone: "Asia/Tokyo", departure: "ICN", arrival: "KIX" });
const outbound = res({ id: "f2", kind: "flight", title: "KE724", serviceNumber: "KE724", startDate: "2026-11-08", startTime: "16:00", timeZone: "Asia/Tokyo", endDate: "2026-11-08", endTime: "18:00", endTimeZone: "Asia/Seoul", departure: "KIX", arrival: "ICN" });
const pagesFrom = (trip: TripWorkspace, pages: PageEntry[] = []) => applySuggestions(pages, bookingSuggestions(trip, pages, {}, "ko"), trip.id);
const brief = (list: { id: string; date: string; time?: string; minutes?: number }[]) => list.map((l) => [l.id, l.date, l.time, l.minutes]);

describe("lodging check-in and check-out", () => {
  it("adds a check-in on the first night and a check-out on the last date at the booked times", () => {
    const lines = plannedLines(tokyo([hotel]), "ko");
    expect(brief(lines)).toEqual([
      ["booking-checkin-h1", "2026-11-05", "15:00", 30],
      ["booking-checkout-h1", "2026-11-08", "11:00", 30],
    ]);
    expect(lines[0]).toMatchObject({ title: "체크인 · Hotel Umeda", address: "Umeda 1-1, Osaka", body: "" });
    expect(plannedLines(tokyo([hotel]), "en-US")[1].title).toBe("Check out · Hotel Umeda");
  });

  it("uses 15:00 / 10:00 when the booking has no times and says so in the note", () => {
    const lines = plannedLines(tokyo([res({ id: "h2", kind: "stay", title: "Inn", endDate: "2026-11-07" })]), "ko");
    expect(brief(lines)).toEqual([
      ["booking-checkin-h2", "2026-11-05", "15:00", 30],
      ["booking-checkout-h2", "2026-11-07", "10:00", 30],
    ]);
    expect(lines[0].body).toContain("15:00");
  });

  it("skips the check-out when the stay has no end date", () => {
    expect(plannedLines(tokyo([res({ id: "h3", kind: "stay", title: "Inn" })]), "ko").map((l) => l.role)).toEqual(["checkIn"]);
  });

  it("pins the hotel once on check-in day when the check-in line is in the plan", () => {
    const trip = tokyo([hotel]);
    const targets = mapTargets(dayPlan(trip, pagesFrom(trip), "2026-11-05"));
    expect(targets.map((t) => t.id)).toEqual(["page-booking-checkin-h1"]);
  });

  it("keeps the hotel pin when the user's own plan uses the hotel address", () => {
    const trip = tokyo([hotel]);
    const breakfast: PageEntry = { id: "breakfast", tripId: "trip", kind: "plan", title: "호텔 조식", date: "2026-11-06", body: "", address: "Umeda 1-1, Osaka", done: false, time: "08:00" };
    const targets = mapTargets(dayPlan(trip, [...pagesFrom(trip), breakfast], "2026-11-06"));
    expect(targets.map((t) => t.id)).toEqual(["page-breakfast", "sleep-h1"]);
  });

  it("marks lodging lines so recommendations can use them as the day's base", () => {
    expect(isStayAutofill("booking-checkin-h1")).toBe(true);
    expect(isStayAutofill("booking-arrive-f1")).toBe(false);
    expect(isStayAutofill("some-uuid")).toBe(false);
    expect(autofillSource(autofillId("checkOut", "r-1"))).toEqual({ role: "checkOut", reservationId: "r-1" });
  });
});

describe("flights", () => {
  it("adds a 90-minute arrival line at the trip-local landing time", () => {
    const [line] = plannedLines(tokyo([inbound]), "ko");
    expect(brief([line])).toEqual([["booking-arrive-f1", "2026-11-05", "14:10", 90]]);
    expect(line.title).toBe("KIX 도착 · 입국과 이동");
    // 공항 주소는 넣지 않는다(추천 기준점이 공항으로 끌려가지 않게).
    expect(line.address).toBe("");
  });

  it("opens the first day's free time at arrival + 90 minutes (14:10 → 15:40)", () => {
    const trip = tokyo([inbound]);
    const pages = [...pagesFrom(trip), { id: "dinner", tripId: "trip", kind: "plan" as const, title: "저녁", date: "2026-11-05", body: "", address: "", done: false, time: "18:00", minutes: 60 }];
    const slots = freeTimeSlots(dayPlan(trip, pages, "2026-11-05"), 0);
    expect(slots).toEqual([{ start: 15 * 60 + 40, end: 18 * 60, category: "food" }]);
    expect(dayWindow(trip.reservations, "2026-11-05", "Asia/Tokyo")).toMatchObject({ arrival: 850, start: 940 });
  });

  it("leaves three hours before an international departure", () => {
    const lines = plannedLines(tokyo([outbound]), "ko");
    expect(brief(lines)).toEqual([["booking-airport-f2", "2026-11-08", "13:00", 180]]);
    expect(lines[0].title).toBe("공항으로 출발 · KE724");
    expect(lines[0].body).toContain("국제선");
  });

  it("leaves two hours before a domestic flight and also adds its arrival", () => {
    const domestic = res({ id: "d1", kind: "flight", title: "NH21", startDate: "2026-11-06", startTime: "09:30", endDate: "2026-11-06", endTime: "11:00", endTimeZone: "Asia/Tokyo" });
    expect(brief(plannedLines(tokyo([domestic]), "ko"))).toEqual([
      ["booking-airport-d1", "2026-11-06", "07:30", 120],
      ["booking-arrive-d1", "2026-11-06", "11:00", 90],
    ]);
    // 국내선 도착에는 입국 문구를 쓰지 않는다.
    const arrive = plannedLines(tokyo([domestic]), "ja").find((l) => l.role === "arrive");
    expect(arrive?.title).toBe("NH21到着・荷物と移動");
    expect(arrive?.body).not.toContain("入国");
  });

  it("rolls the airport line back to the previous day for an early departure", () => {
    const early = res({ id: "e1", kind: "flight", title: "MM1", startDate: "2026-11-08", startTime: "01:30", endDate: "2026-11-08", endTime: "04:00", endTimeZone: "Asia/Seoul" });
    expect(brief(plannedLines(tokyo([early]), "ko"))).toEqual([["booking-airport-e1", "2026-11-07", "22:30", 180]]);
  });

  it("keeps lines without a time when the flight time is missing", () => {
    const noTimes = res({ id: "n1", kind: "flight", title: "OZ112", startDate: "2026-11-05", timeZone: "Asia/Seoul", endDate: "2026-11-05", endTimeZone: "Asia/Tokyo" });
    const [line] = plannedLines(tokyo([noTimes]), "ko");
    expect(line).toMatchObject({ role: "arrive", date: "2026-11-05" });
    expect(line.time).toBeUndefined();
    expect(line.minutes).toBeUndefined();
  });

  describe("legs left at the default time zone (Seoul → Osaka, no time difference)", () => {
    // 새 예약은 출발 시간대 = 수첩 시간대, 도착 시간대는 비어 있다. 시차가 없으니 사용자가 고치지 않는 경우다.
    const autumn = (reservations: Reservation[]) => tokyo(reservations, { startDate: "2026-11-10", endDate: "2026-11-13" });
    const ke721 = res({ id: "ke721", kind: "flight", title: "KE721", serviceNumber: "KE721", startDate: "2026-11-10", startTime: "09:00", endDate: "2026-11-10", endTime: "11:00", departure: "ICN", arrival: "KIX" });
    const ke722 = res({ id: "ke722", kind: "flight", title: "KE722", serviceNumber: "KE722", startDate: "2026-11-13", startTime: "16:00", endDate: "2026-11-13", endTime: "18:00", departure: "KIX", arrival: "ICN" });

    it("gives the way in only an arrival line and the way home only an airport line", () => {
      const lines = plannedLines(autumn([ke722, ke721]), "ko");
      expect(brief(lines)).toEqual([
        ["booking-arrive-ke721", "2026-11-10", "11:00", 90],
        ["booking-airport-ke722", "2026-11-13", "13:00", 180],
      ]);
      expect(lines[0].title).toBe("KIX 도착 · 입국과 이동");
      expect(lines[1].body).toContain("국제선");
    });

    it("decides the direction from every flight even when asking about one booking", () => {
      const trip = autumn([ke721, ke722]);
      expect(bookingSuggestions(trip, [], {}, "ko", "ke722").map((s) => s.id)).toEqual(["booking-airport-ke722"]);
      expect(bookingSuggestions(trip, [], {}, "ko", "ke721").map((s) => s.id)).toEqual(["booking-arrive-ke721"]);
    });

    it("treats a single leg by the trip date it sits on", () => {
      expect(plannedLines(autumn([ke721]), "ko").map((l) => l.id)).toEqual(["booking-arrive-ke721"]);
      expect(plannedLines(autumn([ke722]), "ko").map((l) => l.id)).toEqual(["booking-airport-ke722"]);
      // 수첩 첫날 다음 날에 들어와도(하루 여유) 집에서 떠나는 공항 줄은 만들지 않는다.
      const late = res({ ...ke721, startDate: "2026-11-11", endDate: "2026-11-11" });
      expect(plannedLines(autumn([late, ke722]), "ko").map((l) => l.id)).toEqual(["booking-arrive-ke721", "booking-airport-ke722"]);
    });

    it("keeps both lines with domestic wording for a flight in the middle of the trip", () => {
      const hop = res({ id: "hop", kind: "flight", title: "NH1", serviceNumber: "NH1", startDate: "2026-11-11", startTime: "10:00", endDate: "2026-11-11", endTime: "11:30", departure: "ITM", arrival: "CTS" });
      const lines = plannedLines(autumn([ke721, hop, ke722]), "ko").filter((l) => l.reservationId === "hop");
      expect(brief(lines)).toEqual([
        ["booking-airport-hop", "2026-11-11", "08:00", 120],
        ["booking-arrive-hop", "2026-11-11", "11:30", 90],
      ]);
      expect(lines[1].title).toBe("CTS 도착 · 짐 찾고 이동");
      expect(lines[1].body).not.toContain("입국");
    });
  });

  it("drops lines outside the trip dates and ignores flights that never touch the trip zone", () => {
    const later = res({ id: "x", kind: "flight", title: "late", startDate: "2026-11-10", startTime: "10:00", endDate: "2026-11-10", endTime: "12:00", endTimeZone: "Asia/Seoul" });
    const elsewhere = res({ id: "y", kind: "flight", title: "elsewhere", timeZone: "Europe/London", startTime: "10:00", endDate: "2026-11-05", endTime: "13:00", endTimeZone: "Europe/Paris" });
    expect(plannedLines(tokyo([later, elsewhere]), "ko")).toEqual([]);
  });
});

describe("time zones", () => {
  const previousTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = previousTz;
  });

  it("does not depend on the device time zone", () => {
    const expected = brief(plannedLines(tokyo([hotel, inbound, outbound]), "ko"));
    process.env.TZ = "America/Los_Angeles";
    expect(brief(plannedLines(tokyo([hotel, inbound, outbound]), "ko"))).toEqual(expected);
  });

  it("converts a lodging written in another zone into trip-local time", () => {
    // 수첩은 Asia/Tokyo(UTC+9), 숙소는 Asia/Bangkok(UTC+7)으로 적혔다. 14:00 방콕 = 16:00 도쿄.
    const stay = res({ id: "bkk", kind: "stay", title: "Sukhumvit Inn", timeZone: "Asia/Bangkok", startTime: "14:00", endDate: "2026-11-07", endTime: "12:00" });
    expect(brief(plannedLines(tokyo([stay]), "ko"))).toEqual([
      ["booking-checkin-bkk", "2026-11-05", "16:00", 30],
      ["booking-checkout-bkk", "2026-11-07", "14:00", 30],
    ]);
  });

  it("handles a date-line flight that lands the day before it left", () => {
    // 도쿄 11/05 20:00 출발 → 호놀룰루 11/05 08:30 도착. 수첩은 호놀룰루.
    const trip = tokyo([], { timeZone: "Pacific/Honolulu" });
    const hop = res({ id: "hnl", kind: "flight", title: "JL74", startDate: "2026-11-05", startTime: "20:00", timeZone: "Asia/Tokyo", endDate: "2026-11-05", endTime: "08:30", endTimeZone: "Pacific/Honolulu" });
    expect(brief(plannedLines({ ...trip, reservations: [hop] }, "ko"))).toEqual([["booking-arrive-hnl", "2026-11-05", "08:30", 90]]);
  });

  it("uses the destination's daylight-saving offset for the airport line", () => {
    // 2026-11-01 뉴욕 서머타임 종료. 11/02 01:30 출발 3시간 전 = 11/01 22:30(EST).
    const trip = tokyo([], { timeZone: "America/New_York", startDate: "2026-10-30", endDate: "2026-11-02" });
    const leave = res({ id: "jfk", kind: "flight", title: "KE82", startDate: "2026-11-02", startTime: "01:30", timeZone: "America/New_York", endDate: "2026-11-03", endTime: "05:00", endTimeZone: "Asia/Seoul" });
    expect(brief(plannedLines({ ...trip, reservations: [leave] }, "ko"))).toEqual([["booking-airport-jfk", "2026-11-01", "22:30", 180]]);
  });
});

describe("suggestions", () => {
  const trip = tokyo([hotel, inbound, outbound]);

  it("suggests every missing line once and adds nothing twice", () => {
    const first = bookingSuggestions(trip, [], {}, "ko");
    expect(first.map((s) => s.state)).toEqual(["new", "new", "new", "new"]);
    const pages = applySuggestions([], first, trip.id);
    expect(pages).toHaveLength(4);
    expect(bookingSuggestions(trip, pages, {}, "ko")).toEqual([]);
    // 같은 제안을 한 번 더 반영해도(두 번 누름·다시 저장) 줄이 늘지 않는다.
    expect(applySuggestions(pages, first, trip.id)).toHaveLength(4);
  });

  it("does not suggest a line the user already wrote by hand on the same day", () => {
    const own: PageEntry = { id: "mine", tripId: "trip", kind: "plan", title: "체크인 ·  Hotel Umeda", date: "2026-11-05", body: "", address: "", done: false, time: "16:00" };
    expect(bookingSuggestions(tokyo([hotel]), [own], {}, "ko").map((s) => s.role)).toEqual(["checkOut"]);
  });

  it("can be scoped to the booking that was just saved", () => {
    expect(bookingSuggestions(trip, [], {}, "ko", "h1").map((s) => s.id)).toEqual(["booking-checkin-h1", "booking-checkout-h1"]);
  });

  it("offers to move a generated line when the booking time changes, then updates it in place", () => {
    const pages = pagesFrom(trip);
    const edited = { ...trip, reservations: [hotel, { ...inbound, endTime: "15:30" }, outbound] };
    const changed = bookingSuggestions(edited, pages, {}, "ko");
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({ id: "booking-arrive-f1", state: "changed", time: "15:30", previous: { date: "2026-11-05", time: "14:10" } });
    const renamed = pages.map((p) => (p.id === "booking-arrive-f1" ? { ...p, title: "간사이 도착", body: "내 메모" } : p));
    const next = applySuggestions(renamed, changed, trip.id);
    expect(next).toHaveLength(4);
    expect(next.find((p) => p.id === "booking-arrive-f1")).toMatchObject({ time: "15:30", minutes: 90, title: "간사이 도착", body: "내 메모" });
    expect(bookingSuggestions(edited, next, {}, "ko")).toEqual([]);
  });

  it("moves a line to a new date when the stay dates change", () => {
    const pages = pagesFrom(tokyo([hotel]));
    const later = tokyo([{ ...hotel, startDate: "2026-11-06" }]);
    const [s] = bookingSuggestions(later, pages, {}, "ko");
    expect(s).toMatchObject({ id: "booking-checkin-h1", state: "changed", date: "2026-11-06" });
    expect(applySuggestions(pages, [s], "trip").find((p) => p.id === s.id)?.date).toBe("2026-11-06");
  });

  it("remembers dismissed suggestions on the device until the booking time changes", () => {
    const all = bookingSuggestions(trip, [], {}, "ko");
    const handled = rememberHandled({}, all, plannedLines(trip, "ko"));
    expect(bookingSuggestions(trip, [], handled, "ko")).toEqual([]);
    const moved = { ...trip, reservations: [{ ...hotel, startTime: "16:00" }, inbound, outbound] };
    expect(bookingSuggestions(moved, [], handled, "ko").map((s) => [s.id, s.time])).toEqual([["booking-checkin-h1", "16:00"]]);
    // 저장 값은 JSON으로 왕복하고, 형식이 틀리면 빈 값으로 본다.
    expect(parseHandled(JSON.stringify(handled))).toEqual(handled);
    expect(parseHandled("{bad")).toEqual({});
    expect(parseHandled(JSON.stringify({ x: "1", "booking-arrive-f1": 3 }))).toEqual({});
  });

  it("does not nag about a generated line the user moved by hand", () => {
    const first = bookingSuggestions(trip, [], {}, "ko");
    const handled = rememberHandled({}, first, plannedLines(trip, "ko"));
    const pages = applySuggestions([], first, trip.id).map((p) => (p.id === "booking-checkin-h1" ? { ...p, time: "17:00" } : p));
    expect(bookingSuggestions(trip, pages, handled, "ko")).toEqual([]);
  });

  it("forgets handled entries for bookings that no longer exist", () => {
    const handled = rememberHandled({ "booking-checkin-gone": "2026-11-05|15:00" }, [], plannedLines(trip, "ko"));
    expect(handled).toEqual({});
  });

  it("never touches a page with the same id in another notebook", () => {
    const other: PageEntry = { id: "booking-checkin-h1", tripId: "other", kind: "plan", title: "x", date: "2026-11-01", body: "", address: "", done: false };
    expect(bookingSuggestions(tokyo([hotel]), [other], {}, "ko").map((s) => s.id)).toEqual(["booking-checkout-h1"]);
  });

  it("writes pages that the backup format still accepts", () => {
    const pages = pagesFrom(trip);
    const backup = JSON.stringify({ version: 1, library: createTripLibrary(trip), pages });
    expect(() => parseNotebook(backup)).not.toThrow();
    for (const page of pages) expect(Object.keys(page).every((k) => ["id", "tripId", "kind", "title", "date", "body", "address", "done", "time", "minutes"].includes(k))).toBe(true);
  });

  it("turns an untimed suggestion into an untimed page", () => {
    const noTimes = tokyo([res({ id: "n1", kind: "flight", title: "OZ112", timeZone: "Asia/Seoul", endDate: "2026-11-05", endTimeZone: "Asia/Tokyo" })]);
    const [page] = pagesFrom(noTimes);
    expect(page.time).toBeUndefined();
    expect(page.minutes).toBeUndefined();
    const s: Suggestion[] = bookingSuggestions(noTimes, [page], {}, "ko");
    expect(s).toEqual([]);
  });
});
