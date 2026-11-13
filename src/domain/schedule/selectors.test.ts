import { describe, expect, it } from "vitest";
import { osakaWorkspaceSeed } from "../../data/scheduleSeed";
import { tripSeed } from "../../data/tripSeed";
import type { ScheduleActivity } from "./types";
import {
  isFixedScheduleActivity,
  resolveRouteActivity,
  selectCurrentScheduleActivityForToday,
  selectDisplayedRouteActivityForToday,
  selectNextScheduleActivity,
  selectFixedScheduleActivityForToday,
  selectNextTransitRouteActivity,
} from "./selectors";

describe("schedule selectors", () => {
  it("배열 순서와 무관하게 다음 로컬 일정을 선택한다", () => {
    const activities = [...osakaWorkspaceSeed.schedule.activities].reverse();
    expect(
      selectNextScheduleActivity(
        { ...osakaWorkspaceSeed.schedule, activities },
        new Date("2026-07-20T15:33:01+09:00"),
      )?.routeActivityId,
    ).toBe("bentencho-to-umeda");
  });

  it("검증된 routeActivityId만 정적 교통 활동으로 해석한다", () => {
    const scheduleActivity: ScheduleActivity = {
      ...osakaWorkspaceSeed.schedule.activities[3]!,
      id: "user-local-id",
      title: "수정한 우메다 이동",
      targetAt: "2026-07-20T16:00:00+09:00",
    };

    const resolved = resolveRouteActivity(scheduleActivity, tripSeed);

    expect(resolved).toMatchObject({
      id: "bentencho-to-umeda",
      title: "수정한 우메다 이동",
      targetAt: "2026-07-20T16:00:00+09:00",
    });
  });

  it("수동 일정은 건너뛰고 서버 registry의 live ID만 반환한다", () => {
    const manual: ScheduleActivity = {
      id: "user-manual",
      routeTimingStale: false,
      title: "수동 일정",
      targetAt: "2026-07-20T13:00:00+09:00",
      placeName: "직접 입력",
      kind: "note",
      durationMinutes: 10,
      priority: "flexible",
      timeKind: "estimate",
    };
    const plan = {
      ...osakaWorkspaceSeed.schedule,
      activities: [manual, ...osakaWorkspaceSeed.schedule.activities],
    };

    expect(
      selectNextTransitRouteActivity(
        plan,
        tripSeed,
        new Date("2026-07-17T03:00:00+09:00"),
      )?.id,
    ).toBe("kix-to-bentencho");
  });

  it("이동 일정이 진행 중이면 미래 이동보다 현재 경로를 우선한다", () => {
    expect(
      selectNextTransitRouteActivity(
        osakaWorkspaceSeed.schedule,
        tripSeed,
        new Date("2026-07-20T14:30:00+09:00"),
      )?.id,
    ).toBe("kix-to-bentencho");
  });

  it("Today는 출국 전 청주공항 앵커를 우선하고 이동 중에는 현재 구간을 표시한다", () => {
    expect(
      selectDisplayedRouteActivityForToday(
        osakaWorkspaceSeed.schedule,
        tripSeed,
        new Date("2026-07-20T06:00:00+09:00"),
      )?.id,
    ).toBeUndefined();
    expect(
      selectDisplayedRouteActivityForToday(
        osakaWorkspaceSeed.schedule,
        tripSeed,
        new Date("2026-07-20T14:30:00+09:00"),
      )?.id,
    ).toBe("kix-to-bentencho");
  });

  it("시작한 일정은 종료 시각 전까지 오늘의 현재 일정으로 유지한다", () => {
    const selected = selectCurrentScheduleActivityForToday(
      osakaWorkspaceSeed.schedule,
      new Date("2026-07-23T18:16:00+09:00"),
    );

    expect(selected?.id).toBe("schedule-day4-yoiyama");
  });

  it("진행 중 일정이 끝나면 같은 시각에 시작하는 다음 일정을 선택한다", () => {
    const selected = selectCurrentScheduleActivityForToday(
      osakaWorkspaceSeed.schedule,
      new Date("2026-07-23T20:45:00+09:00"),
    );

    expect(selected?.id).toBe("schedule-day4-hotel");
  });

  it("required이면서 예약 또는 도착 목표인 활동을 그날의 고정 앵커로 선택한다", () => {
    const anchor = selectFixedScheduleActivityForToday(
      osakaWorkspaceSeed.schedule,
      new Date("2026-07-23T18:16:00+09:00"),
    );

    expect(anchor?.id).toBe("schedule-day4-yoiyama");
    expect(anchor === undefined ? false : isFixedScheduleActivity(anchor)).toBe(true);
  });
});
