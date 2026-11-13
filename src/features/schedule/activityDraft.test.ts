import { describe, expect, it } from "vitest";
import { osakaWorkspaceSeed } from "../../data/scheduleSeed";
import {
  createActivityDraft,
  saveActivityDraft,
  validateActivityDraft,
} from "./activityDraft";

const plan = osakaWorkspaceSeed.schedule;
const boundActivity = plan.activities.find(
  (activity) => activity.routeActivityId === "bentencho-to-umeda",
);

if (boundActivity === undefined) throw new Error("missing test activity");

describe("activityDraft", () => {
  it("새 일정은 사용자 ID를 만들고 교통 route ID를 갖지 않는다", () => {
    const draft = {
      ...createActivityDraft(undefined, "2026-07-22"),
      title: "편의점 들르기",
      time: "19:30",
      placeName: "호텔 근처 편의점",
      durationMinutes: "15",
      estimatedCostMinor: "500",
    };

    const saved = saveActivityDraft(draft, plan, undefined, () => "fixed-id");

    expect(saved).toMatchObject({
      id: "user-fixed-id",
      title: "편의점 들르기",
      targetAt: "2026-07-22T19:30:00+09:00",
      durationMinutes: 15,
      estimatedCostMinor: 500,
      routeTimingStale: false,
    });
    expect(saved.routeActivityId).toBeUndefined();
  });

  it("장소를 바꾸면 기존 교통 연결을 제거한다", () => {
    const draft = {
      ...createActivityDraft(boundActivity, "2026-07-20"),
      placeName: "다른 장소",
    };

    const saved = saveActivityDraft(draft, plan, boundActivity);

    expect(saved.id).toBe(boundActivity.id);
    expect(saved.routeActivityId).toBeUndefined();
    expect(saved.routeTimingStale).toBe(false);
  });

  it("시간만 바꾸면 교통 연결은 보존하고 시간표 stale을 표시한다", () => {
    const draft = {
      ...createActivityDraft(boundActivity, "2026-07-20"),
      time: "16:00",
    };

    const saved = saveActivityDraft(draft, plan, boundActivity);

    expect(saved.routeActivityId).toBe("bentencho-to-umeda");
    expect(saved.routeTimingStale).toBe(true);
  });

  it("날짜 범위와 필수·숫자 입력을 검증한다", () => {
    const errors = validateActivityDraft(
      {
        ...createActivityDraft(undefined, "2026-07-22"),
        title: " ",
        date: "2026-07-30",
        time: "25:90",
        durationMinutes: "-1",
        estimatedCostMinor: "1.5",
      },
      plan,
    );

    expect(errors).toMatchObject({
      title: expect.any(String),
      date: expect.any(String),
      time: expect.any(String),
      durationMinutes: expect.any(String),
      estimatedCostMinor: expect.any(String),
    });
  });
});

describe("activity draft place binding", () => {
  const attachedPlace = {
    placeId: "ChIJ123",
    displayName: "우메다 스카이빌딩",
    formattedAddress: "오사카시 기타구",
    location: { latitude: 34.7055, longitude: 135.4903 },
    googleMapsUri: "https://maps.google.com/?cid=1",
    attachedAt: "2026-07-17T12:00:00+09:00",
  };

  it("keeps the attached place through save", () => {
    const draft = createActivityDraft(undefined, "2026-07-21");
    const withPlace = {
      ...draft,
      title: "전망대",
      place: attachedPlace,
      placeName: attachedPlace.displayName,
    };
    const saved = saveActivityDraft(withPlace, plan, undefined, () => "fixed");
    expect(saved.place).toEqual(attachedPlace);
    expect(saved.placeName).toBe("우메다 스카이빌딩");
  });

  it("restores the place when editing an existing activity", () => {
    const draft = createActivityDraft(
      {
        id: "user-1",
        routeTimingStale: false,
        title: "전망대",
        targetAt: "2026-07-21T10:00:00+09:00",
        placeName: "우메다 스카이빌딩",
        kind: "sightseeing",
        durationMinutes: 60,
        priority: "flexible",
        timeKind: "estimate",
        place: attachedPlace,
      },
      "2026-07-21",
    );
    expect(draft.place).toEqual(attachedPlace);
  });
});
