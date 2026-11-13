import { describe, expect, it } from "vitest";
import { osakaWorkspaceSeed } from "./scheduleSeed";

describe("osakaWorkspaceSeed", () => {
  it("승인된 5일 일정과 고정 항공편을 포함한다", () => {
    const dates = new Set(
      osakaWorkspaceSeed.schedule.activities.map((activity) =>
        activity.targetAt.slice(0, 10),
      ),
    );

    expect([...dates]).toEqual([
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
    ]);
    expect(
      osakaWorkspaceSeed.schedule.activities.find(
        (activity) => activity.id === "schedule-day1-cjj-checkin",
      ),
    ).toMatchObject({
      title: "청주공항 도착·국제선 수속",
      targetAt: "2026-07-20T09:00:00+09:00",
      timeKind: "target",
    });
    expect(
      osakaWorkspaceSeed.schedule.activities.find(
        (activity) => activity.id === "schedule-day1-checkin-deadline",
      ),
    ).toMatchObject({
      title: "국제선 체크인 마감",
      targetAt: "2026-07-20T10:05:00+09:00",
      timeKind: "reservation",
    });
    expect(
      osakaWorkspaceSeed.schedule.activities.find(
        (activity) => activity.id === "schedule-umeda-sky-observatory",
      )?.targetAt,
    ).toBe("2026-07-20T18:30:00+09:00");
    expect(
      osakaWorkspaceSeed.schedule.activities.find(
        (activity) => activity.id === "schedule-day1-hotel-return",
      ),
    ).toMatchObject({
      title: "우메다 스카이에서 호텔 이동",
      targetAt: "2026-07-20T20:10:00+09:00",
      kind: "transport",
    });
    expect(
      osakaWorkspaceSeed.schedule.activities.find(
        (activity) => activity.id === "schedule-return-flight",
      ),
    ).toMatchObject({
      title: "TW328 KIX T1 출발 → 청주",
      targetAt: "2026-07-24T13:40:00+09:00",
      timeKind: "reservation",
    });
  });

  it("승인된 Day 2 가이유칸·도톤보리 일정을 사용한다", () => {
    const dayTwo = osakaWorkspaceSeed.schedule.activities.filter((activity) =>
      activity.targetAt.startsWith("2026-07-21"),
    );

    expect(dayTwo.map((activity) => activity.id)).toEqual([
      "schedule-day2-lunch",
      "schedule-day2-to-kaiyukan",
      "schedule-day2-kaiyukan",
      "schedule-day2-to-dotonbori",
      "schedule-day2-dotonbori",
      "schedule-day2-hotel",
    ]);
    expect(dayTwo.map((activity) => activity.targetAt.slice(11, 16))).toEqual([
      "13:00",
      "14:10",
      "15:00",
      "18:10",
      "19:00",
      "21:30",
    ]);
    expect(dayTwo.some((activity) => /USJ|유니버설/.test(activity.title))).toBe(
      false,
    );
  });

  it("Day 4 기온마츠리 일정은 유지한다", () => {
    expect(
      osakaWorkspaceSeed.schedule.activities.find(
        (activity) => activity.id === "schedule-day4-yoiyama",
      ),
    ).toMatchObject({
      title: "기온마츠리 아토마츠리 요이야마",
      targetAt: "2026-07-23T18:15:00+09:00",
    });
  });

  it("Day 5는 쇼핑 한 곳 뒤 호텔에서 09:30 출발해 10:45 공항 도착을 목표로 한다", () => {
    const dayFive = osakaWorkspaceSeed.schedule.activities.filter((activity) =>
      activity.targetAt.startsWith("2026-07-24"),
    );
    const shopping = dayFive.filter((activity) => activity.kind === "shopping");

    expect(shopping.map((activity) => activity.id)).toEqual([
      "schedule-day5-donki",
    ]);
    expect(
      dayFive.find((activity) => activity.id === "schedule-day5-to-airport"),
    ).toMatchObject({
      targetAt: "2026-07-24T09:30:00+09:00",
      durationMinutes: 75,
    });
    expect(
      dayFive.find((activity) => activity.id === "schedule-day5-checkin"),
    ).toMatchObject({ targetAt: "2026-07-24T10:45:00+09:00" });
    expect(
      dayFive.find((activity) => activity.id === "schedule-day5-at-gate"),
    ).toMatchObject({
      title: "탑승구 대기 완료",
      targetAt: "2026-07-24T13:10:00+09:00",
      timeKind: "target",
    });
    expect(
      dayFive.find((activity) => activity.id === "schedule-return-flight"),
    ).toMatchObject({ targetAt: "2026-07-24T13:40:00+09:00" });
  });

  it("두 번째 기본 일정 버전을 표시한다", () => {
    expect(osakaWorkspaceSeed.schedule.seedVersion).toBe(2);
  });

  it("현재 기본 데이터 어디에도 취소한 USJ 일정 문구가 남지 않는다", () => {
    expect(JSON.stringify(osakaWorkspaceSeed)).not.toMatch(/USJ|유니버설/);
  });

  it("Day 1만 기존 서버 교통 ID에 명시적으로 연결한다", () => {
    const routeIds = osakaWorkspaceSeed.schedule.activities
      .map((activity) => activity.routeActivityId)
      .filter((id): id is string => id !== undefined);

    expect(routeIds).toEqual([
      "kix-arrival",
      "kix-to-bentencho",
      "hotel-check-in",
      "bentencho-to-umeda",
      "standard-products",
      "negiyaki-yamamoto",
      "walk-to-umeda-sky",
      "umeda-sky-observatory",
    ]);
    expect(new Set(routeIds).size).toBe(routeIds.length);
    expect(
      osakaWorkspaceSeed.schedule.activities
        .filter((activity) => activity.targetAt >= "2026-07-21")
        .every((activity) => activity.routeActivityId === undefined),
    ).toBe(true);
  });

  it("1인 기준 기본 예산을 제공한다", () => {
    expect(osakaWorkspaceSeed.budget.totalBudgetMinor).toBe(35_000);
    expect(osakaWorkspaceSeed.budget.emergencyReserveMinor).toBe(5_000);
    expect(osakaWorkspaceSeed.budget.mealBudgetPerPersonMinor).toBe(1_500);
    expect(osakaWorkspaceSeed.ledger).toEqual({ expenses: [], fundContributions: [], payments: [] });
  });
});
