import { describe, expect, it } from "vitest";
import { osakaWorkspaceSeed } from "../../data/scheduleSeed";
import type { StoredRouteSegment } from "../workspace/types";
import { invalidateChangedRouteSegments } from "./invalidateRouteSegments";

const segment = (
  originActivityId: string,
  destinationActivityId: string,
): StoredRouteSegment => ({
  originActivityId,
  destinationActivityId,
  departureBasis: "plan",
  options: [],
  fetchedAt: "2026-07-19T00:00:00+09:00",
});

describe("invalidateChangedRouteSegments", () => {
  it("서로 다른 UTC 날짜여도 여행지의 같은 날이면 구간을 유지한다", () => {
    const before = structuredClone(osakaWorkspaceSeed.schedule);
    before.timeZone = "Europe/Paris";
    before.activities = before.activities.slice(0, 2);
    before.activities[0]!.targetAt = "2026-07-01T23:30:00Z";
    before.activities[1]!.targetAt = "2026-07-02T00:30:00Z";
    const after = structuredClone(before);
    after.activities[0]!.notes = "메모만 수정";
    const routes = [segment(before.activities[0]!.id, before.activities[1]!.id)];
    expect(invalidateChangedRouteSegments(before, after, routes)).toEqual(routes);
  });

  it("다른 오프셋의 문자열도 실제 순간 순서로 인접 구간을 판단한다", () => {
    const before = structuredClone(osakaWorkspaceSeed.schedule);
    before.timeZone = "Europe/Paris";
    before.activities = before.activities.slice(0, 2);
    before.activities[0]!.targetAt = "2026-07-02T09:00:00+02:00";
    before.activities[1]!.targetAt = "2026-07-02T08:00:00Z";
    const routes = [segment(before.activities[0]!.id, before.activities[1]!.id)];
    expect(invalidateChangedRouteSegments(before, before, routes)).toEqual(routes);
  });
  it("경로에 영향을 주는 변경이 없으면 저장 경로를 유지한다", () => {
    const before = structuredClone(osakaWorkspaceSeed.schedule);
    const after = structuredClone(before);
    const routeSegments = [
      segment("schedule-kix-arrival", "schedule-kix-to-bentencho"),
    ];

    expect(
      invalidateChangedRouteSegments(before, after, routeSegments),
    ).toEqual(routeSegments);
  });

  it("장소나 출발 기준 시각이 바뀐 일정과 맞닿은 경로만 폐기한다", () => {
    const before = structuredClone(osakaWorkspaceSeed.schedule);
    const after = structuredClone(before);
    const changed = after.activities.find(
      (activity) => activity.id === "schedule-hotel-check-in",
    );
    if (changed === undefined) throw new Error("missing activity");
    changed.targetAt = "2026-07-20T15:40:00+09:00";
    changed.placeName = "직접 고른 다른 호텔";

    const unaffected = segment(
      "schedule-standard-products",
      "schedule-negiyaki-yamamoto",
    );
    const routeSegments = [
      segment("schedule-kix-to-bentencho", "schedule-hotel-check-in"),
      segment("schedule-hotel-check-in", "schedule-bentencho-to-umeda"),
      unaffected,
    ];

    expect(
      invalidateChangedRouteSegments(before, after, routeSegments),
    ).toEqual([unaffected]);
  });

  it("일정을 삭제하면 해당 ID를 사용하는 경로를 폐기한다", () => {
    const before = structuredClone(osakaWorkspaceSeed.schedule);
    const after = {
      ...structuredClone(before),
      activities: before.activities.filter(
        (activity) => activity.id !== "schedule-standard-products",
      ),
    };

    expect(
      invalidateChangedRouteSegments(before, after, [
        segment("schedule-bentencho-to-umeda", "schedule-standard-products"),
      ]),
    ).toEqual([]);
  });

  it("두 일정 사이에 새 일정을 넣으면 더 이상 인접하지 않은 저장 경로를 폐기한다", () => {
    const before = structuredClone(osakaWorkspaceSeed.schedule);
    const after = structuredClone(before);
    const origin = after.activities.find(
      (activity) => activity.id === "schedule-standard-products",
    );
    if (origin === undefined) throw new Error("missing activity");

    after.activities.push({
      ...origin,
      id: "schedule-inserted-stop",
      title: "새로 추가한 경유지",
      targetAt: "2026-07-20T16:25:00+09:00",
      placeName: "우메다역",
    });

    expect(
      invalidateChangedRouteSegments(before, after, [
        segment("schedule-standard-products", "schedule-negiyaki-yamamoto"),
      ]),
    ).toEqual([]);
  });
});
