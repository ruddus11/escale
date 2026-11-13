import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { osakaWorkspaceSeed } from "../../data/scheduleSeed";
import type { ScheduleActivity } from "../../domain/schedule/types";
import {
  addTrip,
  createTripLibrary,
  getActiveTrip,
} from "../../domain/workspace/library";
import type { TripLibrary, TripWorkspace } from "../../domain/workspace/types";
import type { TripLibraryRepository } from "../../repositories/tripRepository";
import { useTripWorkspace } from "./useTripWorkspace";

function createRepository(stored: TripWorkspace | null = null) {
  return {
    load: vi.fn().mockResolvedValue(stored === null ? null : createTripLibrary(stored)),
    save: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
    exportJson: vi.fn(),
    importJson: vi.fn(),
  } satisfies TripLibraryRepository;
}

function savedTrip(repository: ReturnType<typeof createRepository>, call = 0): TripWorkspace {
  return getActiveTrip(repository.save.mock.calls[call]![0] as TripLibrary);
}

function versionOneActivity(
  id: string,
  title: string,
  targetAt: string,
  kind: ScheduleActivity["kind"],
): ScheduleActivity {
  return {
    id,
    routeTimingStale: false,
    title,
    targetAt,
    placeName: title,
    kind,
    durationMinutes: 30,
    priority: "flexible",
    timeKind: "estimate",
  };
}

function createVersionOneWorkspace(): TripWorkspace {
  const workspace = structuredClone(osakaWorkspaceSeed);
  workspace.schedule.seedVersion = 1;
  workspace.schedule.activities = workspace.schedule.activities.filter(
    (activity) =>
      !activity.targetAt.startsWith("2026-07-21") &&
      !activity.targetAt.startsWith("2026-07-23") &&
      !activity.targetAt.startsWith("2026-07-24"),
  );
  workspace.schedule.activities.push(
    versionOneActivity(
      "schedule-day2-to-usj",
      "호텔에서 USJ 이동",
      "2026-07-21T07:00:00+09:00",
      "transport",
    ),
    versionOneActivity(
      "schedule-day2-usj-open",
      "USJ 입장",
      "2026-07-21T08:00:00+09:00",
      "sightseeing",
    ),
    versionOneActivity(
      "user-day2-note",
      "내가 추가한 Day 2 메모",
      "2026-07-21T12:00:00+09:00",
      "note",
    ),
    versionOneActivity(
      "schedule-day4-to-kyoto",
      "호텔에서 교토역으로 이동",
      "2026-07-23T10:00:00+09:00",
      "transport",
    ),
    versionOneActivity(
      "schedule-day4-to-higashi",
      "교토역에서 히가시혼간지로 이동",
      "2026-07-23T11:00:00+09:00",
      "transport",
    ),
    versionOneActivity(
      "schedule-day4-higashi",
      "히가시혼간지 목조 법당·회랑",
      "2026-07-23T11:15:00+09:00",
      "sightseeing",
    ),
    versionOneActivity(
      "schedule-day4-to-sando",
      "교토타워 산도로 이동",
      "2026-07-23T12:00:00+09:00",
      "transport",
    ),
    versionOneActivity(
      "schedule-day4-lunch",
      "교토타워 산도 B1 점심",
      "2026-07-23T12:15:00+09:00",
      "meal",
    ),
    versionOneActivity(
      "schedule-day4-market",
      "교토타워 산도 1F 마켓",
      "2026-07-23T13:15:00+09:00",
      "shopping",
    ),
    versionOneActivity(
      "schedule-day4-ayanokoji",
      "AYANOKOJI 코토치카 교토점",
      "2026-07-23T14:00:00+09:00",
      "shopping",
    ),
    versionOneActivity(
      "user-day4-note",
      "내가 추가한 Day 4 메모",
      "2026-07-23T14:30:00+09:00",
      "note",
    ),
    versionOneActivity(
      "schedule-day4-porta",
      "교토 포르타 소품샵",
      "2026-07-23T14:45:00+09:00",
      "shopping",
    ),
    versionOneActivity(
      "schedule-day4-fukucha",
      "Saryo FUKUCHA 교토역점",
      "2026-07-23T15:30:00+09:00",
      "cafe",
    ),
    versionOneActivity(
      "schedule-day4-isetan",
      "JR 교토 이세탄 생활·소품 층",
      "2026-07-23T16:15:00+09:00",
      "shopping",
    ),
    versionOneActivity(
      "schedule-day4-to-hotel",
      "교토역에서 호텔로 이동",
      "2026-07-23T17:30:00+09:00",
      "transport",
    ),
    versionOneActivity(
      "schedule-day4-dinner",
      "호텔 근처 저녁",
      "2026-07-23T19:00:00+09:00",
      "meal",
    ),
    versionOneActivity(
      "schedule-day5-checkout",
      "체크아웃·짐 보관",
      "2026-07-24T07:25:00+09:00",
      "accommodation",
    ),
    versionOneActivity(
      "schedule-day5-donki",
      "MEGA 돈키호테 벤텐초점",
      "2026-07-24T08:00:00+09:00",
      "shopping",
    ),
    versionOneActivity(
      "schedule-day5-drugstore",
      "드럭스토어 쇼핑",
      "2026-07-24T08:50:00+09:00",
      "shopping",
    ),
    versionOneActivity(
      "schedule-day5-hotel-return",
      "호텔 복귀·짐 수령·최종 정리",
      "2026-07-24T09:35:00+09:00",
      "accommodation",
    ),
    versionOneActivity(
      "schedule-day5-to-airport",
      "벤텐초에서 간사이공항 이동",
      "2026-07-24T10:25:00+09:00",
      "transport",
    ),
    versionOneActivity(
      "schedule-day5-checkin",
      "공항 체크인·출국 수속",
      "2026-07-24T11:30:00+09:00",
      "transport",
    ),
    versionOneActivity(
      "schedule-return-flight",
      "TW328 KIX T1 출발 → 청주",
      "2026-07-24T13:40:00+09:00",
      "flight",
    ),
  );
  Object.assign(
    workspace.schedule.activities.find(
      (activity) => activity.id === "schedule-day5-hotel-return",
    )!,
    {
      placeName: "아트 호텔 오사카 베이 타워",
      durationMinutes: 35,
      priority: "required",
      notes:
        "보조배터리·전자담배는 기내수하물, 액체·날카로운 물건은 위탁수하물",
    },
  );
  Object.assign(
    workspace.schedule.activities.find(
      (activity) => activity.id === "schedule-day5-to-airport",
    )!,
    {
      placeName: "간사이국제공항 T1",
      durationMinutes: 65,
      priority: "required",
      notes:
        "JR 간쿠쾌속, Kansai-airport·関西空港 방향 확인. 늦어도 10:10 출발",
    },
  );
  Object.assign(
    workspace.schedule.activities.find(
      (activity) => activity.id === "schedule-day5-checkin",
    )!,
    {
      placeName: "간사이국제공항 T1",
      durationMinutes: 60,
      priority: "required",
      notes:
        "티웨이 카운터→위탁수하물→보안검색→출국심사. 11:30 전후 도착 목표",
    },
  );
  workspace.budget = {
    totalBudgetMinor: 80_000,
    emergencyReserveMinor: 0,
  };
  workspace.ledger.expenses = [
    {
      id: "expense-kept",
      amount: 1_200,
      currency: "JPY",
      rateToBase: "1",
      paidBy: { kind: "member", memberId: "me" },
      split: { kind: "even", memberIds: ["me"] },
      category: "food",
      note: "사용자 지출",
      occurredAt: "2026-07-20T12:00:00+09:00",
    },
  ];
  workspace.routeSegments = [
    {
      originActivityId: "schedule-day2-to-usj",
      destinationActivityId: "schedule-day2-usj-open",
      departureBasis: "plan",
      options: [],
      fetchedAt: "2026-07-20T12:00:00+09:00",
    },
    {
      originActivityId: "schedule-day4-to-higashi",
      destinationActivityId: "schedule-day4-higashi",
      departureBasis: "plan",
      options: [],
      fetchedAt: "2026-07-20T12:00:00+09:00",
    },
    {
      originActivityId: "schedule-day3-bape",
      destinationActivityId: "schedule-day3-stussy",
      departureBasis: "plan",
      options: [],
      fetchedAt: "2026-07-20T12:00:00+09:00",
    },
  ];
  return workspace;
}

describe("useTripWorkspace", () => {
  it("불러오기 실패 후 일반 편집은 원본을 덮지 않고 명시적인 백업 복구만 허용한다", async () => {
    const repository = createRepository();
    repository.load.mockRejectedValue(new Error("invalid saved data"));
    repository.importJson.mockReturnValue(createTripLibrary(osakaWorkspaceSeed));
    const { result } = renderHook(() => useTripWorkspace({ repository }));
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    act(() => result.current.updateLibrary(() => createTripLibrary(osakaWorkspaceSeed)));
    expect(repository.save).not.toHaveBeenCalled();
    expect(result.current.library.trips).toHaveLength(0);
    act(() => result.current.importWorkspace("valid backup"));
    await waitFor(() => expect(repository.save).toHaveBeenCalledOnce());
    expect(result.current.library.trips).toHaveLength(1);
  });
  it("기본 저장소를 렌더마다 다시 만들지 않고 hydration을 유지한다", async () => {
    window.localStorage.clear();
    const { result } = renderHook(() => useTripWorkspace());

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    await act(async () => Promise.resolve());

    expect(result.current.isHydrated).toBe(true);
  });

  it("시드를 즉시 표시한 뒤 저장된 workspace로 한 번만 hydration한다", async () => {
    const stored = structuredClone(osakaWorkspaceSeed);
    stored.schedule.title = "저장된 여행";
    const repository = createRepository(stored);

    const { result } = renderHook(() =>
      useTripWorkspace({ repository, seed: osakaWorkspaceSeed }),
    );

    expect(result.current.workspace.schedule.title).toBe("오사카·교토 4박 5일");
    expect(result.current.isHydrated).toBe(false);

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.workspace.schedule.title).toBe("저장된 여행");
    expect(repository.load).toHaveBeenCalledOnce();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("저장된 v1의 사용자 데이터는 보존하고 알려진 Day 2·4·5 기본 일정만 v2로 갱신한다", async () => {
    const stored = createVersionOneWorkspace();
    const repository = createRepository(stored);

    const { result } = renderHook(() =>
      useTripWorkspace({ repository, seed: osakaWorkspaceSeed }),
    );
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    const migrated = result.current.workspace;
    expect(migrated.schedule.seedVersion).toBe(2);
    expect(
      migrated.schedule.activities.some(
        (activity) => activity.id === "schedule-day2-kaiyukan",
      ),
    ).toBe(true);
    expect(
      migrated.schedule.activities.some(
        (activity) => activity.id === "schedule-day1-hotel-return",
      ),
    ).toBe(true);
    expect(
      migrated.schedule.activities.map((activity) => activity.id),
    ).toEqual(
      expect.arrayContaining([
        "schedule-day1-cjj-checkin",
        "schedule-day1-checkin-deadline",
        "schedule-day5-at-gate",
      ]),
    );
    expect(
      migrated.schedule.activities.find(
        (activity) => activity.id === "schedule-day2-hotel",
      ),
    ).toMatchObject({ targetAt: "2026-07-21T21:30:00+09:00" });
    expect(
      migrated.schedule.activities.some((activity) => /USJ/.test(activity.title)),
    ).toBe(false);
    expect(
      migrated.schedule.activities.some(
        (activity) => activity.id === "schedule-day5-drugstore",
      ),
    ).toBe(false);
    expect(
      migrated.schedule.activities.find(
        (activity) => activity.id === "schedule-day5-to-airport",
      )?.targetAt,
    ).toBe("2026-07-24T09:30:00+09:00");
    expect(
      migrated.schedule.activities.some(
        (activity) => activity.id === "user-day2-note",
      ),
    ).toBe(true);
    expect(
      migrated.schedule.activities.some(
        (activity) => activity.id === "schedule-day4-yoiyama",
      ),
    ).toBe(true);
    expect(
      migrated.schedule.activities.some(
        (activity) =>
          activity.id === "schedule-day4-higashi" ||
          activity.id === "schedule-day4-porta",
      ),
    ).toBe(false);
    expect(
      migrated.schedule.activities.some(
        (activity) => activity.id === "user-day4-note",
      ),
    ).toBe(true);
    expect(
      migrated.schedule.activities.some(
        (activity) => activity.id === "schedule-day3-bape",
      ),
    ).toBe(true);
    expect(migrated.budget).toEqual(stored.budget);
    expect(migrated.ledger).toEqual(stored.ledger);
    expect(migrated.routeSegments).toEqual([
      expect.objectContaining({
        originActivityId: "schedule-day3-bape",
        destinationActivityId: "schedule-day3-stussy",
      }),
    ]);
    await waitFor(() => expect(repository.save).toHaveBeenCalledOnce());
    expect(savedTrip(repository)).toEqual(migrated);
  });

  it("v1 예산이 완전 기본값일 때만 v2 기본 예산으로 갱신한다", async () => {
    const stored = createVersionOneWorkspace();
    stored.budget = { emergencyReserveMinor: 0 };
    const repository = createRepository(stored);

    const { result } = renderHook(() =>
      useTripWorkspace({ repository, seed: osakaWorkspaceSeed }),
    );
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(result.current.workspace.budget).toEqual({
      totalBudgetMinor: 35_000,
      emergencyReserveMinor: 5_000,
      mealBudgetPerPersonMinor: 1_500,
    });
  });

  it("같은 기본 ID에 사용자가 수정한 기온 일정과 장소·경로는 마이그레이션에서 보존한다", async () => {
    const stored = structuredClone(osakaWorkspaceSeed);
    stored.schedule.seedVersion = 1;
    stored.schedule.activities = stored.schedule.activities.filter(
      (activity) => activity.id !== "schedule-day1-hotel-return",
    );
    const yoiyama = stored.schedule.activities.find(
      (activity) => activity.id === "schedule-day4-yoiyama",
    );
    if (yoiyama === undefined) throw new Error("missing yoiyama");
    yoiyama.targetAt = "2026-07-23T18:25:00+09:00";
    yoiyama.notes = "내가 수정한 축제 메모";
    yoiyama.place = {
      placeId: "my-gion-place",
      displayName: "내가 고른 축제 출발점",
      formattedAddress: "京都府京都市中京区",
      location: { latitude: 35.008, longitude: 135.76 },
      googleMapsUri: "https://maps.google.com/?cid=my-gion-place",
      attachedAt: "2026-07-19T12:00:00+09:00",
    };
    const airport = stored.schedule.activities.find(
      (activity) => activity.id === "schedule-day5-to-airport",
    );
    if (airport === undefined) throw new Error("missing airport route");
    airport.targetAt = "2026-07-24T09:20:00+09:00";
    airport.notes = "내가 정한 공항 출발 시각";
    stored.routeSegments = [
      {
        originActivityId: "schedule-day4-yoiyama",
        destinationActivityId: "schedule-day4-hotel",
        departureBasis: "plan",
        options: [],
        fetchedAt: "2026-07-19T12:00:00+09:00",
      },
    ];
    const repository = createRepository(stored);

    const { result } = renderHook(() =>
      useTripWorkspace({ repository, seed: osakaWorkspaceSeed }),
    );
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(
      result.current.workspace.schedule.activities.find(
        (activity) => activity.id === "schedule-day4-yoiyama",
      ),
    ).toMatchObject({
      targetAt: "2026-07-23T18:25:00+09:00",
      notes: "내가 수정한 축제 메모",
      place: { placeId: "my-gion-place" },
    });
    expect(result.current.workspace.routeSegments).toEqual(stored.routeSegments);
    expect(
      result.current.workspace.schedule.activities.find(
        (activity) => activity.id === "schedule-day5-to-airport",
      ),
    ).toMatchObject({
      targetAt: "2026-07-24T09:20:00+09:00",
      notes: "내가 정한 공항 출발 시각",
    });
  });

  it("기본 ID의 시간만 바꾼 Day 4 일정도 사용자 수정으로 보존한다", async () => {
    const stored = structuredClone(osakaWorkspaceSeed);
    stored.schedule.seedVersion = 1;
    stored.schedule.activities = stored.schedule.activities.filter(
      (activity) =>
        activity.id !== "schedule-day1-cjj-checkin" &&
        activity.id !== "schedule-day1-checkin-deadline" &&
        activity.id !== "schedule-day1-hotel-return" &&
        activity.id !== "schedule-day5-at-gate",
    );
    const breakfast = stored.schedule.activities.find(
      (activity) => activity.id === "schedule-day4-breakfast",
    );
    if (breakfast === undefined) throw new Error("missing breakfast");
    breakfast.notes = "USJ·쇼핑 피로 회복 위해 늦게 출발";
    breakfast.targetAt = "2026-07-23T10:00:00+09:00";
    const repository = createRepository(stored);

    const { result } = renderHook(() =>
      useTripWorkspace({ repository, seed: osakaWorkspaceSeed }),
    );
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(
      result.current.workspace.schedule.activities.find(
        (activity) => activity.id === "schedule-day4-breakfast",
      )?.targetAt,
    ).toBe("2026-07-23T10:00:00+09:00");
  });

  it("기본 ID에 장소만 붙인 Day 5 이동도 사용자 수정으로 보존한다", async () => {
    const stored = structuredClone(osakaWorkspaceSeed);
    stored.schedule.seedVersion = 1;
    stored.schedule.activities = stored.schedule.activities.filter(
      (activity) =>
        activity.id !== "schedule-day1-cjj-checkin" &&
        activity.id !== "schedule-day1-checkin-deadline" &&
        activity.id !== "schedule-day1-hotel-return" &&
        activity.id !== "schedule-day5-at-gate",
    );
    const airport = stored.schedule.activities.find(
      (activity) => activity.id === "schedule-day5-to-airport",
    );
    if (airport === undefined) throw new Error("missing airport route");
    Object.assign(airport, {
      targetAt: "2026-07-24T10:25:00+09:00",
      durationMinutes: 65,
      timeKind: "estimate",
      notes:
        "JR 간쿠쾌속, Kansai-airport·関西空港 방향 확인. 늦어도 10:10 출발",
      place: {
        placeId: "my-airport-place",
        displayName: "내가 붙인 공항 위치",
        formattedAddress: "関西国際空港",
        location: { latitude: 34.4353, longitude: 135.2441 },
        googleMapsUri: "https://maps.google.com/?cid=my-airport-place",
        attachedAt: "2026-07-19T12:00:00+09:00",
      },
    });
    const repository = createRepository(stored);

    const { result } = renderHook(() =>
      useTripWorkspace({ repository, seed: osakaWorkspaceSeed }),
    );
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(
      result.current.workspace.schedule.activities.find(
        (activity) => activity.id === "schedule-day5-to-airport",
      )?.place,
    ).toMatchObject({ placeId: "my-airport-place" });
  });

  it("v1 JSON을 가져오면 다음 실행을 기다리지 않고 즉시 v2로 교체한다", async () => {
    const importedVersionOne = createVersionOneWorkspace();
    const repository = createRepository();
    repository.importJson.mockReturnValue(createTripLibrary(importedVersionOne));
    const { result } = renderHook(() =>
      useTripWorkspace({ repository, seed: osakaWorkspaceSeed }),
    );
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    let imported!: TripLibrary;
    act(() => {
      imported = result.current.importWorkspace("version-one-json");
    });

    expect(getActiveTrip(imported).schedule.seedVersion).toBe(2);
    expect(
      result.current.workspace.schedule.activities.some(
        (activity) => activity.id === "schedule-day4-yoiyama",
      ),
    ).toBe(true);
    expect(
      result.current.workspace.schedule.activities.some(
        (activity) => activity.id === "schedule-day4-higashi",
      ),
    ).toBe(false);
    await waitFor(() => expect(repository.save).toHaveBeenCalledOnce());
  });

  it("수정한 workspace에 갱신시각을 넣고 저장한다", async () => {
    const repository = createRepository();
    const { result } = renderHook(() =>
      useTripWorkspace({
        repository,
        seed: osakaWorkspaceSeed,
        clock: { now: () => new Date("2026-07-17T04:00:00+09:00") },
      }),
    );
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    act(() => {
      result.current.updateWorkspace((workspace) => ({
        ...workspace,
        schedule: { ...workspace.schedule, title: "내 일정" },
      }));
    });

    await waitFor(() => expect(repository.save).toHaveBeenCalledOnce());
    expect(result.current.workspace.schedule.title).toBe("내 일정");
    expect(savedTrip(repository)).toEqual(
      expect.objectContaining({
        updatedAt: "2026-07-16T19:00:00.000Z",
        schedule: expect.objectContaining({
          title: "내 일정",
          updatedAt: "2026-07-16T19:00:00.000Z",
        }),
      }),
    );
    expect(repository.save.mock.calls[0]![0]).toMatchObject({
      schemaVersion: 3,
      updatedAt: "2026-07-16T19:00:00.000Z",
    });
  });

  it("불러오기 실패를 표시하되 시드 일정은 유지한다", async () => {
    const repository = createRepository();
    repository.load.mockRejectedValueOnce(new Error("broken"));

    const { result } = renderHook(() =>
      useTripWorkspace({ repository, seed: osakaWorkspaceSeed }),
    );

    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.error).toContain("저장된 여행 데이터를 불러오지 못했습니다.");
    expect(result.current.loadFailed).toBe(true);
    expect(result.current.workspace.schedule.title).toBe("오사카·교토 4박 5일");
  });

  it("진행 중인 저장 뒤에 reset을 직렬화해 삭제한 데이터가 되살아나지 않게 한다", async () => {
    let finishSave!: () => void;
    const pendingSave = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const repository = createRepository();
    repository.save.mockReturnValueOnce(pendingSave);
    const { result } = renderHook(() =>
      useTripWorkspace({ repository, seed: osakaWorkspaceSeed }),
    );
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    act(() => {
      result.current.updateWorkspace((workspace) => ({
        ...workspace,
        schedule: { ...workspace.schedule, title: "곧 지울 일정" },
      }));
    });
    await waitFor(() => expect(repository.save).toHaveBeenCalledOnce());

    let resetPromise!: Promise<void>;
    act(() => {
      resetPromise = result.current.resetWorkspace();
    });
    expect(repository.reset).not.toHaveBeenCalled();

    finishSave();
    await act(async () => resetPromise);
    expect(repository.reset).toHaveBeenCalledOnce();
    expect(result.current.workspace).toEqual(osakaWorkspaceSeed);
  });

  it("reset이 진행되는 동안 새 수정을 저장하지 않는다", async () => {
    let finishReset!: () => void;
    const pendingReset = new Promise<void>((resolve) => {
      finishReset = resolve;
    });
    const repository = createRepository();
    repository.reset.mockReturnValueOnce(pendingReset);
    const { result } = renderHook(() =>
      useTripWorkspace({ repository, seed: osakaWorkspaceSeed }),
    );
    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    let resetPromise!: Promise<void>;
    act(() => {
      resetPromise = result.current.resetWorkspace();
    });
    await waitFor(() => expect(repository.reset).toHaveBeenCalledOnce());

    act(() => {
      result.current.updateWorkspace((workspace) => ({
        ...workspace,
        schedule: { ...workspace.schedule, title: "초기화 중 수정" },
      }));
    });
    expect(repository.save).not.toHaveBeenCalled();

    finishReset();
    await act(async () => resetPromise);
    expect(result.current.workspace).toEqual(osakaWorkspaceSeed);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("기본 일정 갱신은 기본 수첩에만 하고, 수정은 펼친 수첩에만 한다", async () => {
    const osaka = structuredClone(osakaWorkspaceSeed);
    osaka.schedule.seedVersion = 1;
    const autumn: TripWorkspace = {
      ...structuredClone(osakaWorkspaceSeed),
      id: "autumn-2026",
      settings: { ...osakaWorkspaceSeed.settings, title: "가을 여행" },
    };
    autumn.schedule.seedVersion = 1;
    const repository = createRepository();
    repository.load.mockResolvedValue(
      addTrip(createTripLibrary(osaka), autumn),
    );
    const { result } = renderHook(() =>
      useTripWorkspace({
        repository,
        seed: osakaWorkspaceSeed,
        clock: { now: () => new Date("2026-10-02T09:00:00+09:00") },
      }),
    );
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    await waitFor(() => expect(repository.save).toHaveBeenCalledOnce());

    expect(result.current.workspace.id).toBe("autumn-2026");
    expect(result.current.library.trips[0]?.schedule.seedVersion).toBe(2);
    expect(result.current.workspace.schedule.seedVersion).toBe(1);

    act(() => {
      result.current.updateWorkspace((workspace) => ({
        ...workspace,
        budget: { ...workspace.budget, emergencyReserveMinor: 9_000 },
      }));
    });

    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(2));
    const saved = repository.save.mock.calls[1]![0] as TripLibrary;
    expect(saved.activeTripId).toBe("autumn-2026");
    expect(saved.trips[1]?.budget.emergencyReserveMinor).toBe(9_000);
    expect(saved.trips[0]).toEqual(
      (repository.save.mock.calls[0]![0] as TripLibrary).trips[0],
    );
  });
});
