import { deviceTimeZone } from "../time/zoned";
import { describe, expect, it } from "vitest";
import { osakaWorkspaceSeed } from "../../data/scheduleSeed";
import { isTripLibrary } from "../../repositories/tripLibrarySchema";
import {
  createTrip,
  tripFormFromSettings,
  updateTripSettings,
  validateTripForm,
  type TripFormInput,
} from "./tripForm";

function form(overrides: Partial<TripFormInput> = {}): TripFormInput {
  return {
    title: "겨울 여행",
    startDate: "2026-12-20",
    endDate: "2026-12-24",
    baseCurrency: "KRW",
    members: [{ name: "나" }, { name: "민지" }, { name: "준호" }],
    coverColor: "cobalt",
    ...overrides,
  };
}

const now = new Date("2026-10-02T12:00:00+09:00");

describe("validateTripForm", () => {
  it("올바른 양식에는 문제가 없다", () => {
    expect(validateTripForm(form())).toEqual([]);
  });

  it.each<[string, Partial<TripFormInput>, string]>([
    ["이름이 비어 있음", { title: "  " }, "title"],
    ["날짜 형식이 틀림", { startDate: "12월 20일" }, "dates"],
    ["도착이 출발보다 빠름", { endDate: "2026-12-19" }, "dates"],
    ["60일을 넘음", { endDate: "2027-03-01" }, "too-long"],
    ["동행자가 없음", { members: [] }, "members"],
    ["이름이 빈 동행자", { members: [{ name: "나" }, { name: " " }] }, "member-name"],
    ["같은 이름 두 번", { members: [{ name: "나" }, { name: "민지" }, { name: "민지 " }] }, "duplicate-member"],
  ])("%s", (_name, overrides, issue) => {
    expect(validateTripForm(form(overrides))).toContain(issue);
  });

  it("수정할 때 총무를 빼거나 장부에 있는 사람을 빼면 막는다", () => {
    const trip = createTrip(form(), { id: "winter", now });
    trip.ledger.expenses.push({
      id: "lunch",
      amount: 12_000,
      currency: "KRW",
      rateToBase: "1",
      paidBy: { kind: "member", memberId: "member-1" },
      split: { kind: "even", memberIds: ["me", "member-1"] },
      category: "food",
      occurredAt: "2026-12-20T12:00:00+09:00",
    });
    const members = tripFormFromSettings(trip.settings).members;

    expect(validateTripForm(form({ members: members.slice(1) }), trip)).toContain(
      "owner-removed",
    );
    expect(
      validateTripForm(form({ members: [members[0]!, members[2]!] }), trip),
    ).toContain("member-in-use");
    expect(
      validateTripForm(form({ members: [members[0]!, members[1]!] }), trip),
    ).toEqual([]);
  });
});

describe("createTrip", () => {
  it("첫 사람을 총무로 두고 빈 수첩을 만든다", () => {
    const trip = createTrip(form(), { id: "winter", now });

    expect(trip.settings).toEqual({
      title: "겨울 여행",
      startDate: "2026-12-20",
      endDate: "2026-12-24",
      timeZone: deviceTimeZone(),
      baseCurrency: "KRW",
      localCurrency: "KRW",
      members: [
        { id: "me", name: "나" },
        { id: "member-1", name: "민지" },
        { id: "member-2", name: "준호" },
      ],
      ownerId: "me",
      coverColor: "cobalt",
    });
    expect(trip.schedule).toMatchObject({
      id: "winter",
      title: "겨울 여행",
      startDate: "2026-12-20",
      endDate: "2026-12-24",
      travelerCount: 3,
      activities: [],
    });
    expect(trip.ledger).toEqual({ expenses: [], fundContributions: [], payments: [] });
    expect(trip.updatedAt).toBe(now.toISOString());
  });

  it("이름 앞뒤 공백을 지우고 저장 형식 검사를 통과한다", () => {
    const trip = createTrip(form({ title: " 겨울 여행 ", members: [{ name: " 나 " }] }), {
      id: "winter",
      now,
    });

    expect(trip.settings.title).toBe("겨울 여행");
    expect(trip.settings.members).toEqual([{ id: "me", name: "나" }]);
    expect(isTripLibrary({ schemaVersion: 3, activeTripId: trip.id, trips: [trip], updatedAt: now.toISOString() })).toBe(true);
  });
});

describe("updateTripSettings", () => {
  it("설정과 일정의 같은 필드를 함께 바꾸고, 자리를 지킨 동행자는 id를 유지한다", () => {
    const later = new Date("2026-10-03T09:00:00+09:00");
    const members = tripFormFromSettings(osakaWorkspaceSeed.settings).members;
    const updated = updateTripSettings(
      osakaWorkspaceSeed,
      form({
        title: "오사카 다시",
        startDate: "2026-07-20",
        endDate: "2026-07-25",
        baseCurrency: "JPY",
        members: [members[0]!, { ...members[1]!, name: "민지" }, { name: "준호" }],
        coverColor: "ink",
      }),
      later,
    );

    expect(updated.settings.members).toEqual([
      { id: "me", name: "나" },
      { id: "companion-1", name: "민지" },
      { id: "member-1", name: "준호" },
    ]);
    expect(updated.settings).toMatchObject({ title: "오사카 다시", coverColor: "ink" });
    expect(updated.schedule).toMatchObject({
      title: "오사카 다시",
      startDate: "2026-07-20",
      endDate: "2026-07-25",
      travelerCount: 3,
    });
    expect(updated.schedule.activities).toEqual(osakaWorkspaceSeed.schedule.activities);
    expect(updated.updatedAt).toBe(later.toISOString());
  });

  it("양식 검사에 걸리면 바꾸지 않는다", () => {
    expect(() =>
      updateTripSettings(osakaWorkspaceSeed, form({ title: "" }), now),
    ).toThrow(RangeError);
  });
});

 describe("optional destination", () => {
  it("빈 여행지와 다른 국가를 저장하고 설정 수정으로 지울 수 있다", () => {
    const empty = createTrip(form(), { id: "empty", now });
    expect(empty.settings.destination).toBeUndefined();
    const trip = createTrip(form({ destination: "  프랑스 파리  " }), { id: "paris", now });
    expect(trip.settings.destination).toBe("프랑스 파리");
    expect(isTripLibrary({ schemaVersion: 3, activeTripId: trip.id, trips: [trip], updatedAt: now.toISOString() })).toBe(true);
    const input = tripFormFromSettings(trip.settings);
    expect(input.destination).toBe("프랑스 파리");
    expect(updateTripSettings(trip, { ...input, destination: " " }, now).settings.destination).toBeUndefined();
    expect(validateTripForm(form({ destination: "x".repeat(121) }))).toContain("destination");
  });
});
