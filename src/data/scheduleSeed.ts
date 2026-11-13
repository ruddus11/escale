import type {
  ScheduleActivity,
  ScheduleActivityKind,
  SchedulePriority,
  ScheduleTimeKind,
} from "../domain/schedule/types";
import { createTripLibrary } from "../domain/workspace/library";
import type { TripLibrary, TripWorkspace } from "../domain/workspace/types";
import { tripSeed } from "./tripSeed";

const seedUpdatedAt = "2026-07-20T00:00:00+09:00";

interface DayOneMetadata {
  kind: ScheduleActivityKind;
  durationMinutes: number;
  priority: SchedulePriority;
  timeKind: ScheduleTimeKind;
}

const dayOneMetadata: Record<string, DayOneMetadata> = {
  "kix-arrival": {
    kind: "flight",
    durationMinutes: 90,
    priority: "required",
    timeKind: "reservation",
  },
  "kix-to-bentencho": {
    kind: "transport",
    durationMinutes: 75,
    priority: "required",
    timeKind: "estimate",
  },
  "hotel-check-in": {
    kind: "accommodation",
    durationMinutes: 20,
    priority: "required",
    timeKind: "estimate",
  },
  "bentencho-to-umeda": {
    kind: "transport",
    durationMinutes: 25,
    priority: "required",
    timeKind: "estimate",
  },
  "standard-products": {
    kind: "shopping",
    durationMinutes: 30,
    priority: "flexible",
    timeKind: "estimate",
  },
  "negiyaki-yamamoto": {
    kind: "meal",
    durationMinutes: 55,
    priority: "flexible",
    timeKind: "estimate",
  },
  "walk-to-umeda-sky": {
    kind: "transport",
    durationMinutes: 30,
    priority: "required",
    timeKind: "estimate",
  },
  "umeda-sky-observatory": {
    kind: "sightseeing",
    durationMinutes: 90,
    priority: "required",
    timeKind: "target",
  },
};

const dayOneActivities: ScheduleActivity[] = tripSeed.activities.map(
  (routeActivity) => {
    const metadata = dayOneMetadata[routeActivity.id];
    if (metadata === undefined) {
      throw new Error(`Missing schedule metadata for ${routeActivity.id}`);
    }

    return {
      id: `schedule-${routeActivity.id}`,
      routeActivityId: routeActivity.id,
      routeTimingStale: false,
      title: routeActivity.title,
      targetAt: routeActivity.targetAt,
      placeName: routeActivity.placeName,
      ...metadata,
    };
  },
);

function scheduleActivity(
  id: string,
  title: string,
  targetAt: string,
  placeName: string,
  kind: ScheduleActivityKind,
  durationMinutes: number,
  priority: SchedulePriority,
  timeKind: ScheduleTimeKind,
  notes?: string,
): ScheduleActivity {
  return {
    id,
    routeTimingStale: false,
    title,
    targetAt,
    placeName,
    kind,
    durationMinutes,
    priority,
    timeKind,
    ...(notes === undefined ? {} : { notes }),
  };
}

const remainingActivities: ScheduleActivity[] = [
  // Day 1 (7/20) — 출국 수속 안전 앵커
  scheduleActivity("schedule-day1-cjj-checkin", "청주공항 도착·국제선 수속", "2026-07-20T09:00:00+09:00", "청주국제공항 국제선", "flight", 65, "required", "target", "09:00 공항 도착 목표. 여권·위탁수하물 확인 후 체크인과 보안검색 진행"),
  scheduleActivity("schedule-day1-checkin-deadline", "국제선 체크인 마감", "2026-07-20T10:05:00+09:00", "청주국제공항 국제선", "flight", 50, "required", "reservation", "티웨이 국제선 탑승수속은 출발 50분 전 마감. 이 시각보다 먼저 수속 완료"),

  // Day 1 (7/20) — 전망대 관람 후 숙소 복귀
  scheduleActivity("schedule-day1-hotel-return", "우메다 스카이에서 호텔 이동", "2026-07-20T20:10:00+09:00", "아트 호텔 오사카 베이 타워", "transport", 50, "required", "estimate", "Google Maps에서 현재 위치 기준 경로를 다시 확인해 벤텐초로 복귀"),

  // Day 2 (7/21) — 가이유칸·도톤보리
  scheduleActivity("schedule-day2-lunch", "호텔 근처 늦은 점심", "2026-07-21T13:00:00+09:00", "호텔 근처 · 현장 선택", "meal", 60, "flexible", "estimate", "더위를 피하며 천천히 시작하고 가이유칸 이동 전에 식사 완료"),
  scheduleActivity("schedule-day2-to-kaiyukan", "호텔에서 가이유칸으로 이동", "2026-07-21T14:10:00+09:00", "가이유칸", "transport", 50, "required", "estimate", "벤텐초역에서 오사카코역까지 주오선 이용 후 도보"),
  scheduleActivity("schedule-day2-kaiyukan", "가이유칸", "2026-07-21T15:00:00+09:00", "오사카 가이유칸", "sightseeing", 180, "required", "target", "입장권 시간을 확인하고 실내에서 충분히 관람"),
  scheduleActivity("schedule-day2-to-dotonbori", "가이유칸에서 도톤보리로 이동", "2026-07-21T18:10:00+09:00", "도톤보리", "transport", 50, "required", "estimate", "오사카코→혼마치 환승→난바, 이후 도보"),
  scheduleActivity("schedule-day2-dotonbori", "도톤보리 저녁·산책", "2026-07-21T19:00:00+09:00", "도톤보리", "sightseeing", 150, "flexible", "target", "저녁 식사 후 글리코사인 주변을 가볍게 산책"),
  scheduleActivity("schedule-day2-hotel", "도톤보리에서 호텔 이동", "2026-07-21T21:30:00+09:00", "아트 호텔 오사카 베이 타워", "transport", 45, "required", "estimate", "난바→혼마치 환승→주오선 벤텐초"),

  // Day 3 (7/22) — 신사이바시·난바·오타로드 쇼핑
  scheduleActivity("schedule-day3-breakfast", "아침 식사·쇼핑 준비", "2026-07-22T09:00:00+09:00", "호텔 근처", "meal", 60, "flexible", "estimate", "접이식 쇼핑백·여권·현금 준비, 면세는 여권 원본 필요"),
  scheduleActivity("schedule-day3-to-horie", "벤텐초에서 미나미호리에 이동", "2026-07-22T10:10:00+09:00", "미나미호리에", "transport", 40, "required", "estimate", "메트로 벤텐초→주오선→혼마치 환승→요츠바시선 요츠바시역"),
  scheduleActivity("schedule-day3-bape", "BAPE STORE OSAKA", "2026-07-22T11:00:00+09:00", "BAPE STORE OSAKA (미나미호리에 1-19-2)", "shopping", 60, "required", "estimate", "오사카 한정 제품·사이즈 먼저 확인, 면세 여부 확인"),
  scheduleActivity("schedule-day3-stussy", "STÜSSY OSAKA", "2026-07-22T12:20:00+09:00", "STÜSSY OSAKA (니시신사이바시 1-7-9)", "shopping", 50, "required", "estimate", "11:00~19:00, 19시 마감이라 오후로 미루지 말고 BAPE 다음 바로"),
  scheduleActivity("schedule-day3-gu", "GU 신사이바시점", "2026-07-22T13:25:00+09:00", "GU 신사이바시점", "shopping", 55, "flexible", "estimate", "여름 기능성·일본 한정 협업 확인"),
  scheduleActivity("schedule-day3-lunch", "가벼운 점심·카페", "2026-07-22T14:20:00+09:00", "신사이바시 · 현장 선택", "meal", 30, "flexible", "estimate", "저녁 미나미나미 예정이라 가볍게"),
  scheduleActivity("schedule-day3-shinsaibashi", "신사이바시스지·도톤보리 쇼핑", "2026-07-22T14:50:00+09:00", "신사이바시스지→도톤보리", "shopping", 80, "flexible", "estimate", "지하철 없이 남쪽으로 도보. 돈키호테는 마지막 날 벤텐초에서"),
  scheduleActivity("schedule-day3-edion", "에디온 난바 본점", "2026-07-22T16:10:00+09:00", "에디온 난바 본점", "shopping", 80, "flexible", "estimate", "전자제품은 한국 전압·규격 확인"),
  scheduleActivity("schedule-day3-namba-parks", "난바 파크스", "2026-07-22T17:30:00+09:00", "난바 파크스", "shopping", 60, "flexible", "estimate", "의류·캐릭터·가샤폰·루프 가든"),
  scheduleActivity("schedule-day3-otaroad", "오타로드·가챠가챠의 숲", "2026-07-22T18:30:00+09:00", "가챠가챠의 숲 닛폰바시 오타로드점", "shopping", 70, "required", "estimate", "닛폰바시 덴덴타운→오타로드. 가챠용 100엔 동전 준비"),
  scheduleActivity("schedule-day3-dinner", "미나미나미 저녁 식사", "2026-07-22T19:45:00+09:00", "덴푸라와 스시 사카바 미나미나미 (난바센니치마에 14-22)", "meal", 90, "flexible", "estimate", "15:00~23:00, 난카이 난바역 도보 3분. 대기 길면 인근 대체"),
  scheduleActivity("schedule-day3-hotel", "난바에서 호텔 이동", "2026-07-22T21:15:00+09:00", "아트 호텔 오사카 베이 타워", "transport", 45, "required", "estimate", "메트로 난바→요츠바시선→혼마치 환승→주오선 벤텐초"),

  // Day 4 (7/23) — 교토 기온마츠리 아토마츠리 요이야마
  scheduleActivity("schedule-day4-breakfast", "아침 식사", "2026-07-23T09:30:00+09:00", "호텔 근처 또는 벤텐초역", "meal", 60, "flexible", "estimate", "가이유칸·쇼핑 피로 회복 위해 늦게 출발"),
  scheduleActivity("schedule-day4-to-kyoto", "벤텐초에서 교토가와라마치 이동", "2026-07-23T11:30:00+09:00", "한큐 교토가와라마치역", "transport", 80, "required", "estimate", "JR 오사카순환선→오사카역, 한큐 오사카우메다역 도보 환승→교토선 특급"),
  scheduleActivity("schedule-day4-lunch", "가와라마치 점심", "2026-07-23T13:00:00+09:00", "가와라마치 · 현장 선택", "meal", 70, "flexible", "estimate", "축제 전 체력 유지, 너무 기름지지 않은 메뉴"),
  scheduleActivity("schedule-day4-walk", "가모강·기온 가벼운 산책", "2026-07-23T14:10:00+09:00", "시조대교→가모강→기온 시라카와→하나미코지", "sightseeing", 80, "flexible", "estimate", "거리 분위기 위주. 마이코 무단 촬영·사유지 출입 금지"),
  scheduleActivity("schedule-day4-rest", "카페·백화점 휴식", "2026-07-23T15:30:00+09:00", "교토 다카시마야 · 시조도리 실내", "cafe", 90, "flexible", "estimate", "에어컨 실내에서 최소 1시간, 보조배터리 충전·강수 확인"),
  scheduleActivity("schedule-day4-dinner", "이른 저녁 식사", "2026-07-23T17:00:00+09:00", "가와라마치 · 현장 선택", "meal", 60, "required", "estimate", "축제 구역 들어가기 전 식사 완료. 혼잡 구역에서 걸으며 먹지 않기"),
  scheduleActivity("schedule-day4-yoiyama", "기온마츠리 아토마츠리 요이야마", "2026-07-23T18:15:00+09:00", "시조카라스마 일대", "sightseeing", 150, "required", "target", "오후네호코→미나미·기타칸논야마→하치만야마. 물 자주 마시기, 우천 시 카라스마역으로"),
  scheduleActivity("schedule-day4-hotel", "교토에서 호텔 이동", "2026-07-23T20:45:00+09:00", "아트 호텔 오사카 베이 타워", "transport", 95, "required", "estimate", "한큐 카라스마→교토선 특급→오사카우메다, JR 오사카역 도보→오사카순환선 벤텐초"),

  // Day 5 (7/24) — 돈키호테·귀국
  scheduleActivity("schedule-day5-checkout", "체크아웃·짐 보관", "2026-07-24T07:25:00+09:00", "아트 호텔 오사카 베이 타워", "accommodation", 10, "required", "estimate", "캐리어는 프런트 보관, 빈 접이식 가방만 소지"),
  scheduleActivity("schedule-day5-donki", "MEGA 돈키호테 벤텐초점", "2026-07-24T08:00:00+09:00", "MEGA 돈키호테 벤텐초점 (미나토구 벤텐 3-13-1)", "shopping", 50, "required", "estimate", "08:00~24:00, 면세 여권 원본. 08:40 전후 마무리"),
  scheduleActivity("schedule-day5-hotel-return", "호텔 복귀·짐 수령·최종 정리", "2026-07-24T09:05:00+09:00", "아트 호텔 오사카 베이 타워", "accommodation", 25, "required", "estimate", "09:30 출발 전에 짐 수령. 보조배터리는 기내수하물, 액체·날카로운 물건은 위탁수하물"),
  scheduleActivity("schedule-day5-to-airport", "벤텐초에서 간사이공항 이동", "2026-07-24T09:30:00+09:00", "간사이국제공항 T1", "transport", 75, "required", "target", "JR 간쿠쾌속의 Kansai-airport·関西空港 방향 확인. 10:45 공항 도착 목표"),
  scheduleActivity("schedule-day5-checkin", "공항 체크인·출국 수속", "2026-07-24T10:45:00+09:00", "간사이국제공항 T1", "transport", 120, "required", "target", "티웨이 카운터→위탁수하물→보안검색→출국심사. 출발 2시간 55분 전 도착 목표"),
  scheduleActivity("schedule-day5-at-gate", "탑승구 대기 완료", "2026-07-24T13:10:00+09:00", "간사이국제공항 T1 탑승구", "flight", 30, "required", "target", "출발 30분 전까지 탑승구 앞에서 대기. 현장 전광판에서 최종 게이트 확인"),
  scheduleActivity("schedule-return-flight", "TW328 KIX T1 출발 → 청주", "2026-07-24T13:40:00+09:00", "간사이국제공항 T1", "flight", 100, "required", "reservation", "남은 엔화는 면세점에서 사용, 출발 30분 전 탑승구 대기"),
];

export const osakaWorkspaceSeed: TripWorkspace = {
  id: "osaka-2026",
  settings: {
    title: "오사카·교토 4박 5일",
    startDate: "2026-07-20",
    endDate: "2026-07-24",
    timeZone: "Asia/Tokyo",
    baseCurrency: "JPY",
    localCurrency: "JPY",
    members: [
      { id: "me", name: "나" },
      { id: "companion-1", name: "동행자 1" },
    ],
    ownerId: "me",
  },
  schedule: {
    id: "osaka-2026",
    schemaVersion: 1,
    seedVersion: 2,
    title: "오사카·교토 4박 5일",
    startDate: "2026-07-20",
    endDate: "2026-07-24",
    timeZone: "Asia/Tokyo",
    currency: "JPY",
    travelerCount: 2,
    activities: [...dayOneActivities, ...remainingActivities],
    updatedAt: seedUpdatedAt,
  },
  budget: {
    totalBudgetMinor: 35_000,
    emergencyReserveMinor: 5_000,
    mealBudgetPerPersonMinor: 1_500,
  },
  ledger: { expenses: [], fundContributions: [], payments: [] },
  updatedAt: seedUpdatedAt,
};

export const osakaLibrarySeed: TripLibrary = createTripLibrary(osakaWorkspaceSeed);
