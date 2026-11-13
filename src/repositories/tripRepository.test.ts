import { describe, expect, it } from "vitest";
import { osakaLibrarySeed } from "../data/scheduleSeed";
import type { TripLibrary, TripWorkspace } from "../domain/workspace/types";
import { parseTripLibrary, TripWorkspaceDataError } from "./tripRepository";

const validPlace = {
  placeId: "ChIJ123",
  displayName: "우메다 스카이빌딩",
  formattedAddress: "오사카시 기타구",
  location: { latitude: 34.7055, longitude: 135.4903 },
  googleMapsUri: "https://maps.google.com/?cid=1",
  attachedAt: "2026-07-17T12:00:00+09:00",
};

const validSegment = {
  originActivityId: "a-1",
  destinationActivityId: "a-2",
  departureBasis: "plan",
  options: [
    {
      id: "opt-1",
      kind: "walk",
      label: "추천",
      routeDepartureAt: "2026-07-20T10:00:00+09:00",
      routeArrivalAt: "2026-07-20T10:10:00+09:00",
      durationMinutes: 10,
      walkingMinutes: 10,
      fetchedAt: "2026-07-20T09:55:00+09:00",
    },
  ],
  fetchedAt: "2026-07-20T09:55:00+09:00",
};

function libraryWith(change: (trip: TripWorkspace) => void): TripLibrary {
  const library = structuredClone(osakaLibrarySeed);
  change(library.trips[0]!);
  return library;
}

function withActivityPatch(patch: object): TripLibrary {
  return libraryWith((trip) => {
    trip.schedule.activities[0] = { ...trip.schedule.activities[0]!, ...patch };
  });
}

function withRouteSegments(routeSegments: unknown[]): TripLibrary {
  return libraryWith((trip) => {
    (trip as unknown as Record<string, unknown>).routeSegments = routeSegments;
  });
}

describe("parseTripLibrary 장소 연결", () => {
  it("올바른 장소가 붙은 일정을 받는다", () => {
    expect(() => parseTripLibrary(withActivityPatch({ place: validPlace }))).not.toThrow();
  });

  it("https가 아닌 지도 주소는 거부한다", () => {
    const library = withActivityPatch({
      place: { ...validPlace, googleMapsUri: "javascript:alert(1)" },
    });
    expect(() => parseTripLibrary(library)).toThrow(TripWorkspaceDataError);
  });

  it("장소에 모르는 키가 있으면 거부한다", () => {
    const library = withActivityPatch({
      place: { ...validPlace, photoUrl: "https://example.com" },
    });
    expect(() => parseTripLibrary(library)).toThrow(TripWorkspaceDataError);
  });
});

describe("parseTripLibrary 경로 캐시", () => {
  it("저장한 구간 경로를 받는다", () => {
    expect(() => parseTripLibrary(withRouteSegments([validSegment]))).not.toThrow();
  });

  it("대중교통 선택지에 필요한 필드가 없으면 거부한다", () => {
    const library = withRouteSegments([
      {
        ...validSegment,
        options: [
          {
            id: "opt-2",
            kind: "transit",
            label: "지하철",
            routeDepartureAt: "2026-07-20T10:00:00+09:00",
            routeArrivalAt: "2026-07-20T10:30:00+09:00",
            durationMinutes: 30,
            fetchedAt: "2026-07-20T09:55:00+09:00",
          },
        ],
      },
    ]);
    expect(() => parseTripLibrary(library)).toThrow(TripWorkspaceDataError);
  });

  it("출발 기준이 틀린 구간은 거부한다", () => {
    const library = withRouteSegments([{ ...validSegment, departureBasis: "guess" }]);
    expect(() => parseTripLibrary(library)).toThrow(TripWorkspaceDataError);
  });
});

describe("parseTripLibrary 기본 일정 판", () => {
  it("기본 일정 1판과 2판을 모두 받는다", () => {
    const versionOne = libraryWith((trip) => {
      trip.schedule.seedVersion = 1;
    });

    expect(parseTripLibrary(versionOne).trips[0]?.schedule.seedVersion).toBe(1);
    expect(parseTripLibrary(osakaLibrarySeed).trips[0]?.schedule.seedVersion).toBe(2);
  });

  it("모르는 미래 판은 거부한다", () => {
    const library = libraryWith((trip) => {
      (trip.schedule as unknown as Record<string, unknown>).seedVersion = 3;
    });
    expect(() => parseTripLibrary(library)).toThrow(TripWorkspaceDataError);
  });
});

describe("parseTripLibrary 저장 형식 1", () => {
  const legacy = {
    schemaVersion: 1,
    schedule: structuredClone(osakaLibrarySeed.trips[0]!.schedule),
    budget: { emergencyReserveMinor: 5_000 },
    expenses: [
      {
        id: "takoyaki",
        amountMinor: 800,
        category: "food",
        occurredAt: "2026-07-20T19:00:00+09:00",
      },
    ],
    routeSegments: [validSegment],
    updatedAt: "2026-07-21T09:00:00.000Z",
  };

  it("예전 백업을 수첩 한 권짜리 목록으로 옮긴다", () => {
    const library = parseTripLibrary(structuredClone(legacy));

    expect(library.schemaVersion).toBe(3);
    expect(library.activeTripId).toBe("osaka-2026");
    expect(library.trips).toHaveLength(1);
    expect(library.trips[0]?.ledger.expenses[0]).toMatchObject({
      id: "takoyaki",
      amount: 800,
      currency: "JPY",
      rateToBase: "1",
    });
    expect(library.trips[0]?.routeSegments).toEqual([validSegment]);
  });

  it("예전 백업에 허용하지 않은 키가 있으면 옮기지 않는다", () => {
    expect(() => parseTripLibrary({ ...legacy, accessToken: "secret" })).toThrow(
      TripWorkspaceDataError,
    );
  });

  it("모르는 저장 형식은 거부한다", () => {
    expect(() => parseTripLibrary({ ...legacy, schemaVersion: 999 })).toThrow(
      TripWorkspaceDataError,
    );
  });
});
