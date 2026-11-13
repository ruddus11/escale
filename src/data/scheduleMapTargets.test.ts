import { describe, expect, it } from "vitest";
import type { ScheduleActivity } from "../domain/schedule/types";
import { osakaWorkspaceSeed } from "./scheduleSeed";
import {
  createScheduleFallbackDirectionsUrl,
  createScheduleDirectionsUrl,
  getScheduleMapTarget,
} from "./scheduleMapTargets";

function historicalActivity(
  id: string,
  title: string,
  placeName: string,
): ScheduleActivity {
  return {
    id,
    routeTimingStale: false,
    title,
    targetAt: "2026-07-21T12:00:00+09:00",
    placeName,
    kind: "sightseeing",
    durationMinutes: 60,
    priority: "flexible",
    timeKind: "estimate",
  };
}

const historicalSeedVariants = [
  historicalActivity(
    "schedule-day2-lunch",
    "호텔 근처 늦은 점심",
    "호텔 근처 · 현장 선택",
  ),
  historicalActivity(
    "schedule-day2-to-kaiyukan",
    "호텔에서 가이유칸으로 이동",
    "가이유칸",
  ),
  historicalActivity(
    "schedule-day2-kaiyukan",
    "가이유칸",
    "오사카 가이유칸",
  ),
  historicalActivity(
    "schedule-day2-to-dotonbori",
    "가이유칸에서 도톤보리로 이동",
    "도톤보리",
  ),
  historicalActivity(
    "schedule-day2-dotonbori",
    "도톤보리 저녁·산책",
    "도톤보리",
  ),

  historicalActivity(
    "schedule-day3-to-horie",
    "호텔에서 미나미호리에로 이동",
    "미나미호리에",
  ),
  historicalActivity(
    "schedule-day3-brunch",
    "미나미호리에 브런치",
    "미나미호리에 · 현장 선택",
  ),
  historicalActivity(
    "schedule-day3-bape",
    "BAPE STORE OSAKA",
    "BAPE STORE OSAKA",
  ),
  historicalActivity(
    "schedule-day3-stussy",
    "Stüssy Osaka",
    "Stüssy Osaka",
  ),
  historicalActivity(
    "schedule-day3-gu",
    "GU 신사이바시점",
    "GU 신사이바시점",
  ),
  historicalActivity(
    "schedule-day3-edion",
    "에디온 난바 본점",
    "에디온 난바 본점",
  ),
  historicalActivity(
    "schedule-day3-namba-parks",
    "난바 파크스",
    "난바 파크스",
  ),
  historicalActivity(
    "schedule-day3-gacha",
    "가챠가챠의 숲 닛폰바시 오타로드점",
    "가챠가챠의 숲 닛폰바시 오타로드점",
  ),
  historicalActivity(
    "schedule-day3-dinner",
    "난바 저녁",
    "난바 · 현장 선택",
  ),
  historicalActivity(
    "schedule-day3-hotel",
    "난바에서 호텔로 이동",
    "아트 호텔 오사카 베이 타워",
  ),

  historicalActivity(
    "schedule-day4-to-kyoto",
    "호텔에서 교토역으로 이동",
    "교토역",
  ),
  historicalActivity(
    "schedule-day4-to-higashi",
    "교토역에서 히가시혼간지로 이동",
    "히가시혼간지",
  ),
  historicalActivity(
    "schedule-day4-higashi",
    "히가시혼간지 목조 법당·회랑",
    "히가시혼간지",
  ),
  historicalActivity(
    "schedule-day4-to-sando",
    "교토타워 산도로 이동",
    "교토타워 산도",
  ),
  historicalActivity(
    "schedule-day4-lunch",
    "교토타워 산도 B1 점심",
    "교토타워 산도 B1",
  ),
  historicalActivity(
    "schedule-day4-market",
    "교토타워 산도 1F 마켓",
    "교토타워 산도 1F",
  ),
  historicalActivity(
    "schedule-day4-ayanokoji",
    "AYANOKOJI 코토치카 교토점",
    "AYANOKOJI 코토치카 교토점",
  ),
  historicalActivity(
    "schedule-day4-porta",
    "교토 포르타 소품샵",
    "교토 포르타",
  ),
  historicalActivity(
    "schedule-day4-fukucha",
    "Saryo FUKUCHA 교토역점",
    "Saryo FUKUCHA 교토역점",
  ),
  historicalActivity(
    "schedule-day4-isetan",
    "JR 교토 이세탄 생활·소품 층",
    "JR 교토 이세탄",
  ),
  historicalActivity(
    "schedule-day4-to-hotel",
    "교토역에서 호텔로 이동",
    "아트 호텔 오사카 베이 타워",
  ),
  historicalActivity(
    "schedule-day4-dinner",
    "호텔 근처 저녁",
    "호텔 근처 · 현장 선택",
  ),
];

describe("scheduleMapTargets", () => {
  it("44개 기본 일정의 지도 정책을 모두 명시한다", () => {
    const unresolved = osakaWorkspaceSeed.schedule.activities
      .filter((activity) => {
        const target = getScheduleMapTarget(activity);
        return target === null || target.kind === "unverified";
      })
      .map((activity) => activity.id);

    expect(osakaWorkspaceSeed.schedule.activities).toHaveLength(44);
    expect(unresolved).toEqual([]);
  });

  it("현재 Day 2 가이유칸 일정은 검증된 공식 주소를 사용한다", () => {
    const kaiyukan = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-day2-kaiyukan",
    );

    expect(kaiyukan && getScheduleMapTarget(kaiyukan)).toMatchObject({
      kind: "exact",
      query: "海遊館, 大阪府大阪市港区海岸通1-1-10",
    });
  });

  it("Day 2 도톤보리 뒤 호텔 복귀는 정확한 숙소를 목적지로 사용한다", () => {
    const hotelReturn = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-day2-hotel",
    );

    expect(hotelReturn && getScheduleMapTarget(hotelReturn)).toMatchObject({
      kind: "exact",
      query: "アートホテル大阪ベイタワー, 大阪府大阪市港区弁天1-2-1",
      travelModeFromPrevious: "transit",
    });
  });

  it("IndexedDB에 남은 과거 Day 2~4 일정도 모두 검증된 정책으로 해석한다", () => {
    const unresolved = historicalSeedVariants
      .filter((activity) => {
        const target = getScheduleMapTarget(activity);
        return target === null || target.kind === "unverified";
      })
      .map((activity) => activity.id);

    expect(historicalSeedVariants).toHaveLength(27);
    expect(unresolved).toEqual([]);
  });

  it("과거 가이유칸·교토역·BAPE 일정은 정확한 위치로 복원한다", () => {
    const kaiyukan = historicalSeedVariants.find(
      (activity) => activity.id === "schedule-day2-kaiyukan",
    );
    const kyotoStation = historicalSeedVariants.find(
      (activity) => activity.id === "schedule-day4-to-kyoto",
    );
    const bape = historicalSeedVariants.find(
      (activity) => activity.id === "schedule-day3-bape",
    );

    expect(kaiyukan && getScheduleMapTarget(kaiyukan)).toMatchObject({
      kind: "exact",
      query: "海遊館, 大阪府大阪市港区海岸通1-1-10",
    });
    expect(kyotoStation && getScheduleMapTarget(kyotoStation)).toMatchObject({
      kind: "exact",
      query: "JR京都駅, 京都府京都市下京区東塩小路町901",
    });
    expect(bape && getScheduleMapTarget(bape)).toMatchObject({
      kind: "exact",
      query: "BAPE STORE OSAKA, 大阪府大阪市西区南堀江1-19-2",
    });
  });

  it("고정 장소는 공식 일본어 상호와 주소를 사용한다", () => {
    const hotel = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-hotel-check-in",
    );
    const bentencho = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-kix-to-bentencho",
    );
    const standardProducts = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-standard-products",
    );
    const negiyaki = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-negiyaki-yamamoto",
    );
    const horieTransport = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-day3-to-horie",
    );
    const kawaramachi = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-day4-to-kyoto",
    );

    expect(hotel && getScheduleMapTarget(hotel)).toMatchObject({
      kind: "exact",
      query:
        "アートホテル大阪ベイタワー, 大阪府大阪市港区弁天1-2-1",
    });
    expect(bentencho && getScheduleMapTarget(bentencho)).toMatchObject({
      kind: "exact",
      query: "JR弁天町駅, 大阪府大阪市港区波除3-11-6",
    });
    expect(
      standardProducts && getScheduleMapTarget(standardProducts),
    ).toMatchObject({
      kind: "exact",
      query:
        "Standard Products 梅田エスト店, 大阪府大阪市北区角田町3-25 EST 2F",
      routeGroup: "umeda-est",
    });
    expect(negiyaki && getScheduleMapTarget(negiyaki)).toMatchObject({
      kind: "exact",
      query:
        "ねぎ焼やまもと 梅田エスト店, 大阪府大阪市北区角田町3-25 EST E27",
      routeGroup: "umeda-est",
    });
    expect(horieTransport && getScheduleMapTarget(horieTransport)).toMatchObject(
      {
        kind: "exact",
        query: "Osaka Metro 四ツ橋駅, 大阪府大阪市西区北堀江1-1-29",
      },
    );
    expect(kawaramachi && getScheduleMapTarget(kawaramachi)).toMatchObject({
      kind: "exact",
      query:
        "阪急 京都河原町駅, 京都府京都市下京区四条通河原町西入真町52",
    });
  });

  it("현장 선택과 다중 코스는 거짓 단일 위치를 만들지 않는다", () => {
    const choice = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-day3-lunch",
    );
    const multiStop = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-day4-walk",
    );

    expect(choice && getScheduleMapTarget(choice)).toMatchObject({
      kind: "choice",
      placeUrl: null,
    });
    expect(multiStop && getScheduleMapTarget(multiStop)).toMatchObject({
      kind: "multi-stop",
      placeUrl: null,
    });
  });

  it("축제 다중 지점을 호텔 경로의 고정 출발점으로 쓰지 않는다", () => {
    const yoiyama = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-day4-yoiyama",
    );
    const hotel = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-day4-hotel",
    );
    if (yoiyama === undefined || hotel === undefined) {
      throw new Error("missing Day 4 activities");
    }

    expect(getScheduleMapTarget(yoiyama)).toMatchObject({
      kind: "multi-stop",
      allowAsOrigin: false,
    });
    expect(createScheduleDirectionsUrl(yoiyama, hotel)).toBeNull();
    const fallback = new URL(
      createScheduleFallbackDirectionsUrl(yoiyama, hotel) ?? "",
    );
    expect(fallback.searchParams.has("origin")).toBe(false);
    expect(fallback.searchParams.get("destination")).toContain("アートホテル");
    expect(fallback.searchParams.get("travelmode")).toBe("transit");
  });

  it("현장 선택 점심 뒤에는 현재 위치에서 가이유칸으로 가는 경로를 제공한다", () => {
    const lunch = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-day2-lunch",
    );
    const transport = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-day2-to-kaiyukan",
    );
    if (lunch === undefined || transport === undefined) {
      throw new Error("missing Day 2 activities");
    }

    expect(createScheduleDirectionsUrl(lunch, transport)).toBeNull();
    const fallback = new URL(
      createScheduleFallbackDirectionsUrl(lunch, transport) ?? "",
    );
    expect(fallback.searchParams.has("origin")).toBe(false);
    expect(fallback.searchParams.get("destination")).toContain("海遊館");
    expect(fallback.searchParams.get("travelmode")).toBe("transit");
  });

  it("같은 건물 내부 일정에는 이동 경로를 만들지 않는다", () => {
    const origin = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-walk-to-umeda-sky",
    );
    const destination = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-umeda-sky-observatory",
    );
    if (origin === undefined || destination === undefined) {
      throw new Error("missing seed activities");
    }

    expect(createScheduleDirectionsUrl(origin, destination)).toBeNull();
  });

  it("우메다 EST 내부의 Standard Products와 네기야키 사이에는 경로를 만들지 않는다", () => {
    const origin = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-standard-products",
    );
    const destination = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-negiyaki-yamamoto",
    );
    if (origin === undefined || destination === undefined) {
      throw new Error("missing Umeda EST activities");
    }

    expect(createScheduleDirectionsUrl(origin, destination)).toBeNull();
  });

  it("과거 일정에서도 같은 시설 내부 구간은 Google Maps 경로를 만들지 않는다", () => {
    const findHistorical = (id: string) => {
      const activity = historicalSeedVariants.find((item) => item.id === id);
      if (activity === undefined) throw new Error(`missing ${id}`);
      return activity;
    };

    expect(
      createScheduleDirectionsUrl(
        findHistorical("schedule-day2-to-kaiyukan"),
        findHistorical("schedule-day2-kaiyukan"),
      ),
    ).toBeNull();
    expect(
      createScheduleFallbackDirectionsUrl(
        findHistorical("schedule-day2-to-kaiyukan"),
        findHistorical("schedule-day2-kaiyukan"),
      ),
    ).toBeNull();
    expect(
      createScheduleDirectionsUrl(
        findHistorical("schedule-day4-to-higashi"),
        findHistorical("schedule-day4-higashi"),
      ),
    ).toBeNull();
    expect(
      createScheduleDirectionsUrl(
        findHistorical("schedule-day4-to-sando"),
        findHistorical("schedule-day4-lunch"),
      ),
    ).toBeNull();
  });

  it("고정 지점 사이에는 일정별 이동 모드가 포함된 정확한 URL을 만든다", () => {
    const origin = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-kix-arrival",
    );
    const destination = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-kix-to-bentencho",
    );
    if (origin === undefined || destination === undefined) {
      throw new Error("missing seed activities");
    }

    const url = new URL(createScheduleDirectionsUrl(origin, destination) ?? "");
    expect(url.searchParams.get("origin")).toContain("関西国際空港");
    expect(url.searchParams.get("destination")).toContain("JR弁天町駅");
    expect(url.searchParams.get("travelmode")).toBe("transit");
  });

  it("사용자가 선택한 AttachedPlace가 기본 레지스트리보다 우선한다", () => {
    const seed = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-hotel-check-in",
    );
    if (seed === undefined) throw new Error("missing seed activity");
    const edited: ScheduleActivity = {
      ...seed,
      placeName: "직접 고른 호텔",
      place: {
        placeId: "custom-place",
        displayName: "직접 고른 호텔",
        formattedAddress: "직접 고른 주소",
        location: { latitude: 34.7, longitude: 135.5 },
        googleMapsUri: "https://maps.google.com/?cid=custom",
        attachedAt: "2026-07-19T00:00:00+09:00",
      },
    };

    expect(getScheduleMapTarget(edited)).toMatchObject({
      kind: "attached",
      placeUrl: "https://maps.google.com/?cid=custom",
    });
  });

  it("현장 선택 일정에 장소를 연결하면 기존의 경로 차단 정책을 해제한다", () => {
    const seed = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-day3-lunch",
    );
    if (seed === undefined) throw new Error("missing seed activity");

    const attached: ScheduleActivity = {
      ...seed,
      place: {
        placeId: "chosen-restaurant",
        displayName: seed.placeName,
        formattedAddress: "大阪府大阪市中央区心斎橋筋1-1-1",
        location: { latitude: 34.6749, longitude: 135.5011 },
        googleMapsUri: "https://maps.google.com/?cid=chosen",
        attachedAt: "2026-07-19T00:00:00+09:00",
      },
    };

    expect(getScheduleMapTarget(attached)).toMatchObject({
      kind: "attached",
      allowFromPrevious: true,
      allowAsOrigin: true,
    });
  });

  it("직접 고른 두 장소는 거리로 도보와 대중교통을 구분한다", () => {
    const makeAttached = (
      id: string,
      latitude: number,
      longitude: number,
    ): ScheduleActivity => ({
      ...historicalActivity(id, id, id),
      kind: "shopping",
      place: {
        placeId: id,
        displayName: id,
        formattedAddress: id,
        location: { latitude, longitude },
        googleMapsUri: `https://maps.google.com/?cid=${id}`,
        attachedAt: "2026-07-19T00:00:00+09:00",
      },
    });
    const origin = makeAttached("origin", 34.669, 135.462);
    const nearby = makeAttached("nearby", 34.671, 135.464);
    const farAway = makeAttached("far-away", 35.0116, 135.7681);

    expect(
      new URL(createScheduleDirectionsUrl(origin, nearby) ?? "").searchParams.get(
        "travelmode",
      ),
    ).toBe("walking");
    expect(
      new URL(createScheduleDirectionsUrl(origin, farAway) ?? "").searchParams.get(
        "travelmode",
      ),
    ).toBe("transit");
  });

  it("좌표 없는 사용자 일정은 먼 거리를 도보로 단정하지 않는다", () => {
    const custom = historicalActivity(
      "user-custom-stop",
      "직접 추가한 쇼핑",
      "神戸ハーバーランド",
    );
    custom.kind = "shopping";

    expect(getScheduleMapTarget(custom)).toMatchObject({
      kind: "unverified",
      travelModeFromPrevious: "transit",
    });
  });

  it("기본 일정의 이름을 직접 바꾸면 예전 레지스트리를 강제로 적용하지 않는다", () => {
    const seed = osakaWorkspaceSeed.schedule.activities.find(
      (activity) => activity.id === "schedule-hotel-check-in",
    );
    if (seed === undefined) throw new Error("missing seed activity");

    expect(
      getScheduleMapTarget({ ...seed, placeName: "다른 숙소" }),
    ).toMatchObject({ kind: "unverified", query: "다른 숙소" });
  });
});
