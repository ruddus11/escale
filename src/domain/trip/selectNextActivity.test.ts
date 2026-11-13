import { describe, expect, it } from "vitest";
import type { Activity, TripPlan } from "./types";
import {
  selectNextActivity,
  selectNextLiveTransitActivity,
} from "./selectNextActivity";

function makeActivity(
  id: string,
  targetAt: string,
  liveTransitEnabled = true,
): Activity {
  return {
    id,
    title: id,
    targetAt,
    placeName: id,
    liveTransitEnabled,
    destination: { latitude: 34.7, longitude: 135.5 },
    plannedOrigin: { latitude: 34.68, longitude: 135.46 },
    plannedRoute: {
      originLabel: "출발지",
      destinationLabel: "도착지",
      modeLabel: "JR",
      transferCount: 0,
      leaveCurrentLocationAt: targetAt,
      firstTransitDepartureAt: targetAt,
    },
    staticRouteSteps: [],
  };
}

const plan: TripPlan = {
  timeZone: "Asia/Tokyo",
  activities: [
    makeActivity("호텔 체크인", "2026-07-20T15:25:00+09:00"),
    makeActivity("우메다 이동", "2026-07-20T15:45:00+09:00"),
    makeActivity("전망대", "2026-07-20T18:30:00+09:00"),
  ],
};

describe("selectNextActivity", () => {
  it("현재 시각 이후의 첫 활동을 고른다", () => {
    expect(
      selectNextActivity(plan, new Date("2026-07-20T15:33:01+09:00"))?.id,
    ).toBe("우메다 이동");
  });

  it("모든 활동이 끝났으면 undefined를 반환한다", () => {
    expect(
      selectNextActivity(plan, new Date("2026-07-20T20:00:00+09:00")),
    ).toBeUndefined();
  });
});

describe("selectNextLiveTransitActivity", () => {
  it("다음 일정이 실시간 교통 대상이 아니면 이후 첫 교통 가능 활동을 고른다", () => {
    const preTripPlan: TripPlan = {
      timeZone: "Asia/Tokyo",
      activities: [
        makeActivity("입국 항공편", "2026-07-20T12:40:00+09:00", false),
        makeActivity("공항에서 호텔", "2026-07-20T14:10:00+09:00"),
      ],
    };

    expect(
      selectNextLiveTransitActivity(
        preTripPlan,
        new Date("2026-07-20T10:00:00+09:00"),
      )?.id,
    ).toBe("공항에서 호텔");
  });
});
