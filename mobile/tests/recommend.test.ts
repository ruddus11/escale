import { describe, expect, it } from "vitest";
import type { Reservation } from "../../src/domain/reservations/types";
import type { PageEntry } from "../src/data/model";
import {
  buildDraft,
  chooseBase,
  dayWindow,
  departureLead,
  directionsUrl,
  distanceM,
  draftToPages,
  fitSlot,
  isOpenAt,
  knownPlaces,
  pickToPage,
  placeKind,
  qualityPrior,
  reasonLine,
  recommendDay,
  scorePlace,
  swapDraftItem,
  walkMinutes,
  wantsDraft,
  parseTaste,
  type Candidate,
  type DayBase,
  type Taste,
} from "../src/data/recommend";

// 가상의 도시. 기준점에서 위도 0.001도는 약 111m.
const origin = { latitude: 10, longitude: 20 };
const at = (northM: number, eastM = 0) => ({ latitude: 10 + northM / 111_320, longitude: 20 + eastM / (111_320 * Math.cos((10 * Math.PI) / 180)) });
const stayBase: DayBase = { kind: "stay", point: origin, label: "Sample Inn" };
const taste: Taste = { pace: "normal", interests: [], budget: "mid" };
// 2030-06-03은 월요일. 월요일 0시 = 1440분.
const MONDAY = "2030-06-03";
const mon = (h: number) => 1440 + h * 60;
let n = 0;
const place = (extra: Partial<Candidate> = {}): Candidate => {
  n += 1;
  return { placeId: `ChIJtest${String(n).padStart(6, "0")}`, name: `Place ${n}`, address: `${n} Test Street`, type: "", location: at(300), rating: 4.4, reviews: 800, ...extra };
};
const page = (extra: Partial<PageEntry>): PageEntry => ({ id: `p${++n}`, tripId: "trip", kind: "plan", title: "Some plan", date: MONDAY, body: "", address: "", done: false, ...extra });
const flight = (extra: Partial<Reservation>): Reservation => ({ id: `f${++n}`, kind: "flight", title: "Flight", startDate: MONDAY, timeZone: "Etc/GMT-9", updatedAt: "2030-01-01T00:00:00Z", ...extra });

describe("distance and walking time", () => {
  it("turns straight-line meters into walking minutes with a detour factor", () => {
    expect(distanceM(origin, at(500))).toBeCloseTo(500, -1);
    // 500m × 1.3 ÷ 80m/분 ≈ 8분
    expect(walkMinutes(500)).toBe(8);
  });
});

describe("opening hours", () => {
  const lunchOnly = [{ open: mon(11), close: mon(15) }];
  it("checks the destination weekday and a minimum stay", () => {
    expect(isOpenAt(lunchOnly, MONDAY, 12 * 60)).toBe(true);
    expect(isOpenAt(lunchOnly, MONDAY, 14 * 60 + 30)).toBe(false);
    expect(isOpenAt(lunchOnly, "2030-06-04", 12 * 60)).toBe(false);
    expect(isOpenAt(undefined, MONDAY, 12 * 60)).toBeUndefined();
  });
  it("handles 24 hours and periods that wrap past Saturday midnight", () => {
    expect(isOpenAt([{ open: 0, close: 10080 }], MONDAY, 3 * 60)).toBe(true);
    // 토 22:00 ~ 일 02:00. 2030-06-09는 일요일.
    const late = [{ open: 6 * 1440 + 22 * 60, close: 120 }];
    expect(isOpenAt(late, "2030-06-08", 23 * 60)).toBe(true);
    expect(isOpenAt(late, "2030-06-09", 60)).toBe(true);
    expect(isOpenAt(late, "2030-06-09", 90)).toBe(false);
  });
  it("does not bridge a closing break between two opening periods", () => {
    const split = [{ open: mon(12), close: mon(12) + 20 }, { open: mon(12) + 35, close: mon(14) }];
    expect(isOpenAt(split, MONDAY, 12 * 60, 45)).toBe(false);
    expect(isOpenAt(split, MONDAY, 12 * 60 + 35, 45)).toBe(true);
  });
});

describe("scoring", () => {
  it("prefers food at dinner and cafés in the morning", () => {
    const ramen = place({ primaryType: "ramen_restaurant" });
    const cafe = place({ primaryType: "coffee_shop" });
    const dinner = (p: Candidate) => scorePlace(p, { slot: "dinner", date: MONDAY, base: stayBase, taste })!.score;
    const morning = (p: Candidate) => scorePlace(p, { slot: "morning", date: MONDAY, base: stayBase, taste })!.score;
    expect(dinner(ramen)).toBeGreaterThan(dinner(cafe));
    expect(morning(cafe)).toBeGreaterThan(morning(ramen));
  });
  it("drops places that are certainly closed and never suggests bars in the morning", () => {
    const closedAtNight = place({ primaryType: "restaurant", hours: [{ open: mon(11), close: mon(15) }] });
    expect(scorePlace(closedAtNight, { slot: "dinner", date: MONDAY, base: stayBase, taste })).toBeNull();
    expect(scorePlace(place({ primaryType: "bar" }), { slot: "morning", date: MONDAY, base: stayBase, taste })).toBeNull();
  });
  it("gives closer places a higher score, and relaxed travellers a steeper penalty", () => {
    const near = place({ primaryType: "museum", location: at(400) });
    const far = place({ primaryType: "museum", location: at(3000) });
    const score = (p: Candidate, t: Taste) => scorePlace(p, { slot: "afternoon", date: MONDAY, base: stayBase, taste: t })!;
    expect(score(near, taste).score).toBeGreaterThan(score(far, taste).score);
    expect(score(far, { ...taste, pace: "relaxed" }).factors.distance).toBeLessThan(score(far, { ...taste, pace: "packed" }).factors.distance);
  });
  it("follows interests and budget", () => {
    const museum = place({ primaryType: "museum" });
    const mall = place({ primaryType: "shopping_mall" });
    const culture: Taste = { ...taste, interests: ["culture"] };
    const s = (p: Candidate, t: Taste) => scorePlace(p, { slot: "afternoon", date: MONDAY, base: stayBase, taste: t })!.score;
    expect(s(museum, culture)).toBeGreaterThan(s(mall, culture));
    const pricey = place({ primaryType: "restaurant", priceLevel: 4 });
    const cheap = place({ primaryType: "restaurant", priceLevel: 1 });
    const thrifty: Taste = { ...taste, budget: "save" };
    const d = (p: Candidate) => scorePlace(p, { slot: "dinner", date: MONDAY, base: stayBase, taste: thrifty })!.score;
    expect(d(cheap)).toBeGreaterThan(d(pricey));
  });
  it("multiplies rating by log review count", () => {
    expect(qualityPrior(4.5, 999)).toBeCloseTo(0.9 * 0.75, 2);
    expect(qualityPrior(4.9, 3)).toBeLessThan(qualityPrior(4.2, 2000));
    expect(qualityPrior(undefined, undefined)).toBe(0.35);
  });
  it("never suggests stays or stations as stops", () => {
    const input = { slot: "afternoon" as const, date: MONDAY, base: stayBase, taste };
    expect(scorePlace(place({ primaryType: "hotel" }), input)).toBeNull();
    expect(scorePlace(place({ primaryType: "train_station" }), input)).toBeNull();
    expect(scorePlace(place({ type: "호텔", hint: "sights" }), input)).toBeNull();
    expect(scorePlace(place({ primaryType: "museum", type: "Museum" }), input)).not.toBeNull();
  });
  it("classifies Google types and falls back to the requested category", () => {
    expect(placeKind(place({ primaryType: "sushi_restaurant" }))).toBe("food");
    expect(placeKind(place({ primaryType: "botanical_garden" }))).toBe("nature");
    expect(placeKind(place({ primaryType: "shoe_store" }))).toBe("shopping");
    expect(placeKind(place({ hint: "food" }))).toBe("food");
  });
});

describe("a day of picks", () => {
  const window = { start: 0, end: 1440 };
  it("returns no sections for an empty API result", () => {
    expect(recommendDay({ candidates: [], date: MONDAY, base: stayBase, taste, window, known: knownPlaces([]) })).toEqual([]);
  });
  it("skips places already saved or planned, by ID or by name", () => {
    const saved = place({ primaryType: "restaurant" });
    const sameName = place({ primaryType: "restaurant", name: "  place  SHARED " });
    const fresh = place({ primaryType: "restaurant" });
    const known = knownPlaces([page({ kind: "place", placeId: saved.placeId, title: "Other" }), page({ title: "Place shared" })]);
    const result = recommendDay({ candidates: [saved, sameName, fresh], date: MONDAY, base: stayBase, taste, window, known, slots: ["lunch"] });
    expect(result[0].picks.map((p) => p.place.placeId)).toEqual([fresh.placeId]);
  });
  it("does not fill a day with one category", () => {
    const restaurants = Array.from({ length: 8 }, () => place({ primaryType: "restaurant", rating: 4.8, reviews: 5000 }));
    const others = [place({ primaryType: "museum", rating: 4.0, reviews: 200 }), place({ primaryType: "coffee_shop", rating: 4.0, reviews: 200 }), place({ primaryType: "park", rating: 4.0, reviews: 200 })];
    const result = recommendDay({ candidates: [...restaurants, ...others], date: MONDAY, base: stayBase, taste, window, known: knownPlaces([]), perSlot: 2, slots: ["lunch", "afternoon", "dinner"] });
    const all = result.flatMap((s) => s.picks);
    expect(new Set(all.map((p) => p.place.placeId)).size).toBe(all.length);
    const food = all.filter((p) => p.kind === "food").length;
    expect(food).toBeLessThan(all.length);
    expect(result.find((s) => s.slot === "afternoon")!.picks[0].kind).not.toBe("food");
  });
  it("keeps only slots that fit the day's window", () => {
    const candidates = [place({ primaryType: "restaurant" }), place({ primaryType: "museum" }), place({ primaryType: "bar" })];
    const result = recommendDay({ candidates, date: MONDAY, base: stayBase, taste, window: { start: 17 * 60, end: 1440 }, known: knownPlaces([]), perSlot: 1 });
    expect(result.map((s) => s.slot)).toEqual(["dinner", "night"]);
  });
});

describe("reason line", () => {
  it("reads like a short note in each language", () => {
    const pick = scorePlace(place({ primaryType: "restaurant", location: at(500), hours: [{ open: 0, close: 10080 }] }), { slot: "dinner", date: MONDAY, base: stayBase, taste })!;
    expect(reasonLine(pick.reason, "ko")).toBe("숙소에서 도보 8분 · 저녁 시간에 열어요");
    expect(reasonLine(pick.reason, "en-US")).toBe("8 min walk from your stay · Open at dinnertime");
    expect(reasonLine(pick.reason, "ja")).toBe("宿から徒歩8分 · 夜ごはんの時間に営業");
  });
  it("switches to kilometres when walking is too long and mentions interests when hours are unknown", () => {
    const pick = scorePlace(place({ primaryType: "museum", location: at(4000) }), { slot: "afternoon", date: MONDAY, base: { ...stayBase, kind: "plan" }, taste: { ...taste, interests: ["culture"] } })!;
    expect(reasonLine(pick.reason, "ko")).toBe("이날 일정에서 4km · 고른 취향과 맞아요");
  });
});

describe("base point", () => {
  it("uses the median of the day's plans, then the stay, then the city centre", () => {
    const base = chooseBase({ plan: [at(0), at(200), at(90_000)], stay: { point: at(5000), title: "Inn" }, destination: "Sample City" })!;
    expect(base.kind).toBe("plan");
    expect(base.point.latitude).toBeCloseTo(at(200).latitude, 6);
    expect(chooseBase({ plan: [], stay: { point: at(5000), title: "Inn" }, destination: "Sample City" })!.kind).toBe("stay");
    expect(chooseBase({ plan: [], center: origin, destination: "Sample City" })).toMatchObject({ kind: "center", label: "Sample City" });
    expect(chooseBase({ plan: [], destination: "Sample City" })).toBeNull();
  });
});

describe("flight windows", () => {
  const zone = "Etc/GMT-9";
  it("starts the arrival day after landing plus a transfer buffer", () => {
    const window = dayWindow([flight({ startDate: MONDAY, startTime: "09:00", timeZone: "Etc/GMT-8", endDate: MONDAY, endTime: "14:10", endTimeZone: zone })], MONDAY, zone);
    expect(window).toMatchObject({ arrival: 850, start: 940, end: 1440 });
    expect(fitSlot("afternoon", window)).toEqual({ start: 940, minutes: 80 });
    expect(fitSlot("lunch", window)).toBeNull();
  });
  it("ends the departure day three hours before the flight", () => {
    const window = dayWindow([flight({ startDate: MONDAY, startTime: "18:00", timeZone: zone, endTime: "20:00", endTimeZone: "Etc/GMT-8" })], MONDAY, zone);
    expect(window).toMatchObject({ departure: 1080, start: 0, end: 900 });
  });
  it("ignores an earlier same-day departure from home on a domestic trip", () => {
    const window = dayWindow([flight({ startDate: MONDAY, startTime: "08:00", timeZone: zone, endTime: "10:00", endTimeZone: zone })], MONDAY, zone);
    expect(window).toEqual({ arrival: 600, start: 690, end: 1440 });
  });
  it("ends a domestic departure day two hours before the flight", () => {
    const window = dayWindow([flight({ startDate: MONDAY, startTime: "18:00", timeZone: zone, endTimeZone: zone })], MONDAY, zone);
    expect(window).toMatchObject({ departure: 1080, end: 960 });
    expect(departureLead(flight({ timeZone: zone }))).toBe(180);
  });
  it("uses destination local time across a daylight saving change", () => {
    const newYork = "America/New_York";
    const date = "2030-03-10";
    const window = dayWindow([flight({ startDate: date, startTime: "08:00", timeZone: "Europe/London", endDate: date, endTime: "14:00", endTimeZone: newYork })], date, newYork);
    expect(window).toMatchObject({ arrival: 840, start: 930, end: 1440 });
  });
});

describe("saving a pick", () => {
  it("adds it to the day at the slot time unless that time is taken", () => {
    const pick = scorePlace(place({ primaryType: "restaurant" }), { slot: "lunch", date: MONDAY, base: stayBase, taste })!;
    const free = pickToPage(pick, { start: 750, minutes: 60 }, { tripId: "trip", id: "new", date: MONDAY, pages: [] });
    expect(free).toMatchObject({ kind: "plan", date: MONDAY, time: "12:30", minutes: 60, placeId: pick.place.placeId });
    const taken = pickToPage(pick, { start: 750, minutes: 60 }, { tripId: "trip", id: "new", date: MONDAY, pages: [page({ time: "12:00", minutes: 90 })] });
    expect(taken.time).toBeUndefined();
  });
  it("hands off directions to Google Maps with the place ID", () => {
    const p = place({ name: "Spot A", address: "1 Road" });
    const url = new URL(directionsUrl(origin, p));
    expect(url.host).toBe("www.google.com");
    expect(url.searchParams.get("destination_place_id")).toBe(p.placeId);
    expect(url.searchParams.get("origin")).toBe("10,20");
    expect(url.searchParams.get("travelmode")).toBe("transit");
  });
});

describe("taste", () => {
  it("reads only known answers", () => {
    expect(parseTaste('{"pace":"packed","budget":"save","interests":["food","bogus","nature"]}')).toEqual({ pace: "packed", budget: "save", interests: ["food", "nature"] });
    expect(parseTaste('{"pace":"fast"}')).toBeNull();
    expect(parseTaste("not json")).toBeNull();
  });
});

describe("itinerary draft", () => {
  const zone = "Etc/GMT-9";
  const dates = ["2030-06-03", "2030-06-04", "2030-06-05", "2030-06-06"];
  const flights = [
    flight({ startDate: "2030-06-03", startTime: "09:00", timeZone: "Etc/GMT-8", endDate: "2030-06-03", endTime: "13:00", endTimeZone: zone }),
    flight({ startDate: "2030-06-06", startTime: "17:00", timeZone: zone, endDate: "2030-06-06", endTime: "19:00", endTimeZone: "Etc/GMT-8" }),
  ];
  // 두 동네: 북쪽 2km와 동쪽 2km. 동네마다 볼거리·식당·카페가 있다.
  const area = (north: number, east: number) => [
    place({ primaryType: "museum", location: at(north, east), rating: 4.6, reviews: 4000 }),
    place({ primaryType: "park", location: at(north + 150, east) }),
    place({ primaryType: "restaurant", location: at(north - 100, east) }),
    place({ primaryType: "restaurant", location: at(north + 100, east + 100) }),
    place({ primaryType: "coffee_shop", location: at(north, east + 150) }),
    place({ primaryType: "shopping_mall", location: at(north + 200, east - 100) }),
  ];
  const candidates = [...area(2000, 0), ...area(0, 2000), ...area(300, 300)];
  const draft = () => buildDraft({ dates, busyDates: new Set(), candidates, base: stayBase, taste, reservations: flights, tripZone: zone, known: knownPlaces([]) });

  it("keeps the arrival day light and the departure day short", () => {
    const days = draft();
    const arrival = days.find((d) => d.date === dates[0])!;
    expect(arrival.items.length).toBeLessThanOrEqual(2);
    expect(arrival.items.every((i) => i.start >= 13 * 60 + 90)).toBe(true);
    const departure = days.find((d) => d.date === dates[3]);
    for (const item of departure?.items ?? []) expect(item.start + item.minutes).toBeLessThanOrEqual(14 * 60);
  });
  it("gives each full day its own neighbourhood and never repeats a place", () => {
    const days = draft();
    const middle = days.filter((d) => d.date === dates[1] || d.date === dates[2]);
    expect(middle).toHaveLength(2);
    expect(middle[0].area).not.toBe(middle[1].area);
    for (const day of middle) {
      expect(day.items.length).toBe(4);
      const center = candidates.find((c) => c.name === day.area)!.location!;
      for (const item of day.items) expect(distanceM(center, item.pick.place.location!)).toBeLessThanOrEqual(1600);
    }
    const ids = days.flatMap((d) => d.items.map((i) => i.pick.place.placeId));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("uses three stops for relaxed pace and skips days that already have plans", () => {
    const days = buildDraft({ dates, busyDates: new Set([dates[2]]), candidates, base: stayBase, taste: { ...taste, pace: "relaxed" }, reservations: flights, tripZone: zone, known: knownPlaces([]) });
    expect(days.map((d) => d.date)).not.toContain(dates[2]);
    expect(days.find((d) => d.date === dates[1])!.items).toHaveLength(3);
  });
  it("swaps a stop for an alternative and turns the confirmed draft into timed plans", () => {
    const [day] = draft().filter((d) => d.date === dates[1]);
    const item = day.items[0];
    const swapped = swapDraftItem(item);
    expect(swapped.pick.place.placeId).not.toBe(item.pick.place.placeId);
    expect(swapped.alternatives.at(-1)!.place.placeId).toBe(item.pick.place.placeId);
    // 다른 줄에 이미 들어간 후보는 건너뛴다.
    const blocked = swapDraftItem(item, new Set(item.alternatives.map((p) => p.place.placeId)));
    expect(blocked).toBe(item);
    let id = 0;
    const pages = draftToPages([day], "trip", () => `new-${++id}`);
    expect(pages).toHaveLength(day.items.length);
    expect(pages[0]).toMatchObject({ kind: "plan", tripId: "trip", date: dates[1], time: expect.stringMatching(/^\d{2}:\d{2}$/), placeId: item.pick.place.placeId });
  });
  it("still drafts from candidates without coordinates (older server)", () => {
    const loose = [place({ hint: "sights", location: undefined }), place({ hint: "food", location: undefined }), place({ hint: "food", location: undefined }), place({ hint: "sights", location: undefined }), place({ hint: "food", location: undefined })];
    const days = buildDraft({ dates: [dates[1]], busyDates: new Set(), candidates: loose, base: stayBase, taste, reservations: [], tripZone: zone, known: knownPlaces([]) });
    expect(days[0].items.length).toBeGreaterThanOrEqual(3);
  });
  it("drafts from a city centre when there is no stay or existing plan", () => {
    const base = chooseBase({ plan: [], center: origin, destination: "Sample City" })!;
    const days = buildDraft({ dates: [dates[1]], busyDates: new Set(), candidates, base, taste, reservations: [], tripZone: "America/New_York", known: knownPlaces([]) });
    expect(base.kind).toBe("center");
    expect(days[0].items.length).toBe(4);
  });
  it("offers a draft only when there are flights and few planned days", () => {
    expect(wantsDraft(flights, [], dates)).toBe(true);
    expect(wantsDraft([], [], dates)).toBe(false);
    expect(wantsDraft(flights, dates.slice(0, 2).map((date) => page({ date })), dates)).toBe(false);
  });
});
