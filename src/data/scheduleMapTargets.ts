import type { ScheduleActivity } from "../domain/schedule/types";
import {
  createGoogleMapsCurrentLocationDirectionsUrl,
  createGoogleMapsDirectionsUrl,
  createGoogleMapsSearchUrl,
  type GoogleMapsLocation,
  type GoogleMapsTravelMode,
} from "../services/maps";

export type ScheduleMapTargetKind =
  | "attached"
  | "exact"
  | "anchor"
  | "internal"
  | "choice"
  | "multi-stop"
  | "unverified";

export interface ResolvedScheduleMapTarget {
  kind: ScheduleMapTargetKind;
  query: string | null;
  placeUrl: string | null;
  routeLocation: GoogleMapsLocation | null;
  routeGroup: string | null;
  travelModeFromPrevious: GoogleMapsTravelMode;
  allowFromPrevious: boolean;
  allowAsOrigin: boolean;
}

interface SeedMapTarget {
  title: string;
  placeName: string;
  kind: Exclude<ScheduleMapTargetKind, "attached" | "unverified">;
  query?: string;
  routeQuery?: string;
  routeGroup?: string;
  travelModeFromPrevious?: GoogleMapsTravelMode;
  allowFromPrevious?: boolean;
  allowAsOrigin?: boolean;
}

const hotel =
  "アートホテル大阪ベイタワー, 大阪府大阪市港区弁天1-2-1";
const cjj =
  "청주국제공항, 충청북도 청주시 청원구 내수읍 오창대로 980";
const kix =
  "関西国際空港 第1ターミナル, 大阪府泉佐野市泉州空港北1";

const seedMapTargets: Record<string, SeedMapTarget> = {
  "schedule-day1-cjj-checkin": {
    title: "청주공항 도착·국제선 수속",
    placeName: "청주국제공항 국제선",
    kind: "exact",
    query: cjj,
    routeGroup: "cjj-international",
  },
  "schedule-day1-checkin-deadline": {
    title: "국제선 체크인 마감",
    placeName: "청주국제공항 국제선",
    kind: "internal",
    query: cjj,
    routeGroup: "cjj-international",
    allowFromPrevious: false,
    allowAsOrigin: false,
  },
  "schedule-kix-arrival": {
    title: "TW327 간사이국제공항 T1 도착",
    placeName: "간사이국제공항 T1",
    kind: "exact",
    query: kix,
    routeGroup: "kix-t1",
  },
  "schedule-kix-to-bentencho": {
    title: "KIX → 벤텐초",
    placeName: "벤텐초역",
    kind: "exact",
    query: "JR弁天町駅, 大阪府大阪市港区波除3-11-6",
    routeGroup: "jr-bentencho",
    travelModeFromPrevious: "transit",
  },
  "schedule-hotel-check-in": {
    title: "아트 호텔 체크인",
    placeName: "아트 호텔 오사카 베이 타워",
    kind: "exact",
    query: hotel,
    routeGroup: "art-hotel",
    travelModeFromPrevious: "walking",
  },
  "schedule-bentencho-to-umeda": {
    title: "벤텐초 → 우메다",
    placeName: "오사카역",
    kind: "exact",
    query: "JR大阪駅, 大阪府大阪市北区梅田3-1-1",
    routeGroup: "jr-osaka",
    travelModeFromPrevious: "transit",
  },
  "schedule-standard-products": {
    title: "Standard Products 우메다 EST",
    placeName: "Standard Products 우메다 EST점",
    kind: "exact",
    query:
      "Standard Products 梅田エスト店, 大阪府大阪市北区角田町3-25 EST 2F",
    routeGroup: "umeda-est",
    travelModeFromPrevious: "walking",
  },
  "schedule-negiyaki-yamamoto": {
    title: "네기야키 야마모토 우메다 EST",
    placeName: "네기야키 야마모토 우메다 EST점",
    kind: "exact",
    query:
      "ねぎ焼やまもと 梅田エスト店, 大阪府大阪市北区角田町3-25 EST E27",
    routeGroup: "umeda-est",
    travelModeFromPrevious: "walking",
  },
  "schedule-walk-to-umeda-sky": {
    title: "우메다 스카이 빌딩으로 이동",
    placeName: "우메다 스카이 빌딩",
    kind: "exact",
    query: "梅田スカイビル, 大阪府大阪市北区大淀中1-1-88",
    routeGroup: "umeda-sky-building",
    travelModeFromPrevious: "walking",
  },
  "schedule-umeda-sky-observatory": {
    title: "우메다 스카이 전망대",
    placeName: "우메다 스카이 빌딩 공중정원 전망대",
    kind: "internal",
    query: "梅田スカイビル 空中庭園展望台, 大阪府大阪市北区大淀中1-1-88",
    routeGroup: "umeda-sky-building",
    travelModeFromPrevious: "walking",
  },
  "schedule-day1-hotel-return": {
    title: "우메다 스카이에서 호텔 이동",
    placeName: "아트 호텔 오사카 베이 타워",
    kind: "exact",
    query: hotel,
    routeGroup: "art-hotel",
    travelModeFromPrevious: "transit",
  },

  "schedule-day2-lunch": {
    title: "호텔 근처 늦은 점심",
    placeName: "호텔 근처 · 현장 선택",
    kind: "choice",
    routeQuery: hotel,
    routeGroup: "art-hotel",
    allowFromPrevious: false,
    allowAsOrigin: false,
  },
  "schedule-day2-to-kaiyukan": {
    title: "호텔에서 가이유칸으로 이동",
    placeName: "가이유칸",
    kind: "exact",
    query: "海遊館, 大阪府大阪市港区海岸通1-1-10",
    routeGroup: "kaiyukan",
    travelModeFromPrevious: "transit",
  },
  "schedule-day2-kaiyukan": {
    title: "가이유칸",
    placeName: "오사카 가이유칸",
    kind: "exact",
    query: "海遊館, 大阪府大阪市港区海岸通1-1-10",
    routeGroup: "kaiyukan",
    travelModeFromPrevious: "walking",
  },
  "schedule-day2-to-dotonbori": {
    title: "가이유칸에서 도톤보리로 이동",
    placeName: "도톤보리",
    kind: "anchor",
    query: "道頓堀グリコサイン, 大阪府大阪市中央区道頓堀1-10-3",
    routeGroup: "dotonbori-glico",
    travelModeFromPrevious: "transit",
  },
  "schedule-day2-dotonbori": {
    title: "도톤보리 저녁·산책",
    placeName: "도톤보리",
    kind: "multi-stop",
    routeQuery: "道頓堀グリコサイン, 大阪府大阪市中央区道頓堀1-10-3",
    routeGroup: "dotonbori-glico",
    allowFromPrevious: false,
  },
  "schedule-day2-hotel": {
    title: "도톤보리에서 호텔 이동",
    placeName: "아트 호텔 오사카 베이 타워",
    kind: "exact",
    query: hotel,
    routeGroup: "art-hotel",
    travelModeFromPrevious: "transit",
  },

  "schedule-day3-breakfast": {
    title: "아침 식사·쇼핑 준비",
    placeName: "호텔 근처",
    kind: "choice",
    routeQuery: hotel,
    routeGroup: "art-hotel",
    allowFromPrevious: false,
  },
  "schedule-day3-to-horie": {
    title: "벤텐초에서 미나미호리에 이동",
    placeName: "미나미호리에",
    kind: "exact",
    query: "Osaka Metro 四ツ橋駅, 大阪府大阪市西区北堀江1-1-29",
    routeGroup: "osaka-metro-yotsubashi",
    travelModeFromPrevious: "transit",
  },
  "schedule-day3-bape": {
    title: "BAPE STORE OSAKA",
    placeName: "BAPE STORE OSAKA (미나미호리에 1-19-2)",
    kind: "exact",
    query: "BAPE STORE OSAKA, 大阪府大阪市西区南堀江1-19-2",
    routeGroup: "bape-osaka",
    travelModeFromPrevious: "walking",
  },
  "schedule-day3-stussy": {
    title: "STÜSSY OSAKA",
    placeName: "STÜSSY OSAKA (니시신사이바시 1-7-9)",
    kind: "exact",
    query: "STÜSSY OSAKA, 大阪府大阪市中央区西心斎橋1-7-9",
    routeGroup: "stussy-osaka",
    travelModeFromPrevious: "walking",
  },
  "schedule-day3-gu": {
    title: "GU 신사이바시점",
    placeName: "GU 신사이바시점",
    kind: "exact",
    query: "ジーユー 心斎橋店, 大阪府大阪市中央区心斎橋筋2-1-17",
    routeGroup: "gu-shinsaibashi",
    travelModeFromPrevious: "walking",
  },
  "schedule-day3-lunch": {
    title: "가벼운 점심·카페",
    placeName: "신사이바시 · 현장 선택",
    kind: "choice",
    allowFromPrevious: false,
    allowAsOrigin: false,
  },
  "schedule-day3-shinsaibashi": {
    title: "신사이바시스지·도톤보리 쇼핑",
    placeName: "신사이바시스지→도톤보리",
    kind: "multi-stop",
    routeQuery: "道頓堀グリコサイン, 大阪府大阪市中央区道頓堀1-10-3",
    routeGroup: "dotonbori-glico",
    allowFromPrevious: false,
  },
  "schedule-day3-edion": {
    title: "에디온 난바 본점",
    placeName: "에디온 난바 본점",
    kind: "exact",
    query: "エディオンなんば本店, 大阪府大阪市中央区難波3-2-18",
    routeGroup: "edion-namba",
    travelModeFromPrevious: "walking",
  },
  "schedule-day3-namba-parks": {
    title: "난바 파크스",
    placeName: "난바 파크스",
    kind: "exact",
    query: "なんばパークス, 大阪府大阪市浪速区難波中2-10-70",
    routeGroup: "namba-parks",
    travelModeFromPrevious: "walking",
  },
  "schedule-day3-otaroad": {
    title: "오타로드·가챠가챠의 숲",
    placeName: "가챠가챠의 숲 닛폰바시 오타로드점",
    kind: "exact",
    query:
      "ガチャガチャの森 日本橋オタロード店, 大阪府大阪市浪速区日本橋3-7-22",
    routeGroup: "gacha-otaroad",
    travelModeFromPrevious: "walking",
  },
  "schedule-day3-dinner": {
    title: "미나미나미 저녁 식사",
    placeName: "덴푸라와 스시 사카바 미나미나미 (난바센니치마에 14-22)",
    kind: "exact",
    query:
      "天ぷらとすし酒場 みなみなみ, 大阪府大阪市中央区難波千日前14-22 イレブンハイツ1F",
    routeGroup: "minaminami",
    travelModeFromPrevious: "walking",
  },
  "schedule-day3-hotel": {
    title: "난바에서 호텔 이동",
    placeName: "아트 호텔 오사카 베이 타워",
    kind: "exact",
    query: hotel,
    routeGroup: "art-hotel",
    travelModeFromPrevious: "transit",
  },

  "schedule-day4-breakfast": {
    title: "아침 식사",
    placeName: "호텔 근처 또는 벤텐초역",
    kind: "choice",
    routeQuery: hotel,
    routeGroup: "art-hotel",
    allowFromPrevious: false,
  },
  "schedule-day4-to-kyoto": {
    title: "벤텐초에서 교토가와라마치 이동",
    placeName: "한큐 교토가와라마치역",
    kind: "exact",
    query:
      "阪急 京都河原町駅, 京都府京都市下京区四条通河原町西入真町52",
    routeGroup: "kyoto-kawaramachi-station",
    travelModeFromPrevious: "transit",
  },
  "schedule-day4-lunch": {
    title: "가와라마치 점심",
    placeName: "가와라마치 · 현장 선택",
    kind: "choice",
    allowFromPrevious: false,
    allowAsOrigin: false,
  },
  "schedule-day4-walk": {
    title: "가모강·기온 가벼운 산책",
    placeName: "시조대교→가모강→기온 시라카와→하나미코지",
    kind: "multi-stop",
    routeQuery: "花見小路通, 京都府京都市東山区祇園町南側",
    routeGroup: "hanamikoji-end",
    allowFromPrevious: false,
  },
  "schedule-day4-rest": {
    title: "카페·백화점 휴식",
    placeName: "교토 다카시마야 · 시조도리 실내",
    kind: "exact",
    query: "京都髙島屋S.C., 京都府京都市下京区四条通河原町西入真町52",
    routeGroup: "kyoto-takashimaya",
    travelModeFromPrevious: "walking",
  },
  "schedule-day4-dinner": {
    title: "이른 저녁 식사",
    placeName: "가와라마치 · 현장 선택",
    kind: "choice",
    allowFromPrevious: false,
    allowAsOrigin: false,
  },
  "schedule-day4-yoiyama": {
    title: "기온마츠리 아토마츠리 요이야마",
    placeName: "시조카라스마 일대",
    kind: "multi-stop",
    routeQuery: "祇園祭 八幡山, 京都府京都市中京区新町通三条下る三条町",
    routeGroup: "gion-matsuri-hachiman-yama",
    allowFromPrevious: false,
    allowAsOrigin: false,
  },
  "schedule-day4-hotel": {
    title: "교토에서 호텔 이동",
    placeName: "아트 호텔 오사카 베이 타워",
    kind: "exact",
    query: hotel,
    routeGroup: "art-hotel",
    travelModeFromPrevious: "transit",
  },

  "schedule-day5-checkout": {
    title: "체크아웃·짐 보관",
    placeName: "아트 호텔 오사카 베이 타워",
    kind: "exact",
    query: hotel,
    routeGroup: "art-hotel",
  },
  "schedule-day5-donki": {
    title: "MEGA 돈키호테 벤텐초점",
    placeName: "MEGA 돈키호테 벤텐초점 (미나토구 벤텐 3-13-1)",
    kind: "exact",
    query: "MEGAドン・キホーテ弁天町店, 大阪府大阪市港区弁天3-13-1",
    routeGroup: "mega-donki-bentencho",
    travelModeFromPrevious: "walking",
  },
  "schedule-day5-hotel-return": {
    title: "호텔 복귀·짐 수령·최종 정리",
    placeName: "아트 호텔 오사카 베이 타워",
    kind: "exact",
    query: hotel,
    routeGroup: "art-hotel",
    travelModeFromPrevious: "walking",
  },
  "schedule-day5-to-airport": {
    title: "벤텐초에서 간사이공항 이동",
    placeName: "간사이국제공항 T1",
    kind: "exact",
    query: kix,
    routeGroup: "kix-t1",
    travelModeFromPrevious: "transit",
  },
  "schedule-day5-checkin": {
    title: "공항 체크인·출국 수속",
    placeName: "간사이국제공항 T1",
    kind: "internal",
    query: kix,
    routeGroup: "kix-t1",
    allowFromPrevious: false,
  },
  "schedule-day5-at-gate": {
    title: "탑승구 대기 완료",
    placeName: "간사이국제공항 T1 탑승구",
    kind: "internal",
    query: kix,
    routeGroup: "kix-t1",
    allowFromPrevious: false,
    allowAsOrigin: false,
  },
  "schedule-return-flight": {
    title: "TW328 KIX T1 출발 → 청주",
    placeName: "간사이국제공항 T1",
    kind: "internal",
    query: kix,
    routeGroup: "kix-t1",
    allowFromPrevious: false,
    allowAsOrigin: false,
  },
};

// Seed version 1 was already persisted in IndexedDB before the itinerary was
// revised. Match both fields so these presets help only untouched historical
// activities and never reinterpret arbitrary user edits that reuse an ID.
const legacySeedMapTargets: Record<string, readonly SeedMapTarget[]> = {
  "schedule-day2-lunch": [
    {
      title: "호텔 근처 늦은 점심",
      placeName: "호텔 근처 · 현장 선택",
      kind: "choice",
      routeQuery: hotel,
      routeGroup: "art-hotel",
      allowFromPrevious: false,
      allowAsOrigin: false,
    },
  ],
  "schedule-day2-to-kaiyukan": [
    {
      title: "호텔에서 가이유칸으로 이동",
      placeName: "가이유칸",
      kind: "exact",
      query: "海遊館, 大阪府大阪市港区海岸通1-1-10",
      routeGroup: "kaiyukan",
      travelModeFromPrevious: "transit",
    },
  ],
  "schedule-day2-kaiyukan": [
    {
      title: "가이유칸",
      placeName: "오사카 가이유칸",
      kind: "exact",
      query: "海遊館, 大阪府大阪市港区海岸通1-1-10",
      routeGroup: "kaiyukan",
      travelModeFromPrevious: "walking",
    },
  ],
  "schedule-day2-to-dotonbori": [
    {
      title: "가이유칸에서 도톤보리로 이동",
      placeName: "도톤보리",
      kind: "anchor",
      query: "道頓堀グリコサイン, 大阪府大阪市中央区道頓堀1-10-3",
      routeGroup: "dotonbori-glico",
      travelModeFromPrevious: "transit",
    },
  ],
  "schedule-day2-dotonbori": [
    {
      title: "도톤보리 저녁·산책",
      placeName: "도톤보리",
      kind: "multi-stop",
      routeQuery: "道頓堀グリコサイン, 大阪府大阪市中央区道頓堀1-10-3",
      routeGroup: "dotonbori-glico",
      allowFromPrevious: false,
    },
  ],

  "schedule-day3-to-horie": [
    {
      title: "호텔에서 미나미호리에로 이동",
      placeName: "미나미호리에",
      kind: "exact",
      query: "Osaka Metro 四ツ橋駅, 大阪府大阪市西区北堀江1-1-29",
      routeGroup: "osaka-metro-yotsubashi",
      travelModeFromPrevious: "transit",
    },
  ],
  "schedule-day3-brunch": [
    {
      title: "미나미호리에 브런치",
      placeName: "미나미호리에 · 현장 선택",
      kind: "choice",
      allowFromPrevious: false,
      allowAsOrigin: false,
    },
  ],
  "schedule-day3-bape": [
    {
      title: "BAPE STORE OSAKA",
      placeName: "BAPE STORE OSAKA",
      kind: "exact",
      query: "BAPE STORE OSAKA, 大阪府大阪市西区南堀江1-19-2",
      routeGroup: "bape-osaka",
      travelModeFromPrevious: "walking",
    },
  ],
  "schedule-day3-stussy": [
    {
      title: "Stüssy Osaka",
      placeName: "Stüssy Osaka",
      kind: "exact",
      query: "STÜSSY OSAKA, 大阪府大阪市中央区西心斎橋1-7-9",
      routeGroup: "stussy-osaka",
      travelModeFromPrevious: "walking",
    },
  ],
  "schedule-day3-gacha": [
    {
      title: "가챠가챠의 숲 닛폰바시 오타로드점",
      placeName: "가챠가챠의 숲 닛폰바시 오타로드점",
      kind: "exact",
      query:
        "ガチャガチャの森 日本橋オタロード店, 大阪府大阪市浪速区日本橋3-7-22",
      routeGroup: "gacha-otaroad",
      travelModeFromPrevious: "walking",
    },
  ],
  "schedule-day3-dinner": [
    {
      title: "난바 저녁",
      placeName: "난바 · 현장 선택",
      kind: "choice",
      allowFromPrevious: false,
      allowAsOrigin: false,
    },
  ],
  "schedule-day3-hotel": [
    {
      title: "난바에서 호텔로 이동",
      placeName: "아트 호텔 오사카 베이 타워",
      kind: "exact",
      query: hotel,
      routeGroup: "art-hotel",
      travelModeFromPrevious: "transit",
    },
  ],

  "schedule-day4-to-kyoto": [
    {
      title: "호텔에서 교토역으로 이동",
      placeName: "교토역",
      kind: "exact",
      query: "JR京都駅, 京都府京都市下京区東塩小路町901",
      routeGroup: "jr-kyoto-station",
      travelModeFromPrevious: "transit",
    },
  ],
  "schedule-day4-to-higashi": [
    {
      title: "교토역에서 히가시혼간지로 이동",
      placeName: "히가시혼간지",
      kind: "exact",
      query:
        "東本願寺, 京都府京都市下京区烏丸通七条上る常葉町754",
      routeGroup: "higashi-honganji",
      travelModeFromPrevious: "walking",
    },
  ],
  "schedule-day4-higashi": [
    {
      title: "히가시혼간지 목조 법당·회랑",
      placeName: "히가시혼간지",
      kind: "internal",
      query:
        "東本願寺, 京都府京都市下京区烏丸通七条上る常葉町754",
      routeGroup: "higashi-honganji",
      travelModeFromPrevious: "walking",
    },
  ],
  "schedule-day4-to-sando": [
    {
      title: "교토타워 산도로 이동",
      placeName: "교토타워 산도",
      kind: "exact",
      query:
        "京都タワーサンド, 京都府京都市下京区烏丸通七条下る東塩小路町721-1",
      routeGroup: "kyoto-tower-sando",
      travelModeFromPrevious: "walking",
    },
  ],
  "schedule-day4-lunch": [
    {
      title: "교토타워 산도 B1 점심",
      placeName: "교토타워 산도 B1",
      kind: "internal",
      query:
        "京都タワーサンド B1F, 京都府京都市下京区烏丸通七条下る東塩小路町721-1",
      routeGroup: "kyoto-tower-sando",
      travelModeFromPrevious: "walking",
    },
  ],
  "schedule-day4-market": [
    {
      title: "교토타워 산도 1F 마켓",
      placeName: "교토타워 산도 1F",
      kind: "internal",
      query:
        "京都タワーサンド 1F, 京都府京都市下京区烏丸通七条下る東塩小路町721-1",
      routeGroup: "kyoto-tower-sando",
      travelModeFromPrevious: "walking",
    },
  ],
  "schedule-day4-ayanokoji": [
    {
      title: "AYANOKOJI 코토치카 교토점",
      placeName: "AYANOKOJI 코토치카 교토점",
      kind: "exact",
      query:
        "AYANOKOJI コトチカ京都店, 京都府京都市下京区東塩小路町地先 地下鉄京都駅 B1F コトチカ京都",
      routeGroup: "kyoto-station-complex",
      travelModeFromPrevious: "walking",
    },
  ],
  "schedule-day4-porta": [
    {
      title: "교토 포르타 소품샵",
      placeName: "교토 포르타",
      kind: "multi-stop",
      routeQuery: "京都ポルタ, 京都府京都市下京区東塩小路町901",
      routeGroup: "kyoto-station-complex",
      allowFromPrevious: false,
    },
  ],
  "schedule-day4-fukucha": [
    {
      title: "Saryo FUKUCHA 교토역점",
      placeName: "Saryo FUKUCHA 교토역점",
      kind: "exact",
      query:
        "茶寮 FUKUCHA 京都駅店, 京都府京都市下京区烏丸通塩小路下る東塩小路町901 京都ポルタ 京都駅中央口2F",
      routeGroup: "kyoto-station-complex",
      travelModeFromPrevious: "walking",
    },
  ],
  "schedule-day4-isetan": [
    {
      title: "JR 교토 이세탄 생활·소품 층",
      placeName: "JR 교토 이세탄",
      kind: "internal",
      query:
        "ジェイアール京都伊勢丹, 京都府京都市下京区烏丸通塩小路下ル東塩小路町",
      routeGroup: "kyoto-station-complex",
      travelModeFromPrevious: "walking",
    },
  ],
  "schedule-day4-to-hotel": [
    {
      title: "교토역에서 호텔로 이동",
      placeName: "아트 호텔 오사카 베이 타워",
      kind: "exact",
      query: hotel,
      routeGroup: "art-hotel",
      travelModeFromPrevious: "transit",
    },
  ],
  "schedule-day4-dinner": [
    {
      title: "호텔 근처 저녁",
      placeName: "호텔 근처 · 현장 선택",
      kind: "choice",
      routeQuery: hotel,
      routeGroup: "art-hotel",
      allowFromPrevious: false,
      allowAsOrigin: false,
    },
  ],
};

function findSeedMapTarget(activity: ScheduleActivity): SeedMapTarget | undefined {
  const currentTarget = seedMapTargets[activity.id];
  const candidates = [
    ...(currentTarget === undefined ? [] : [currentTarget]),
    ...(legacySeedMapTargets[activity.id] ?? []),
  ];

  return candidates.find(
    (candidate) =>
      candidate.title === activity.title &&
      candidate.placeName === activity.placeName,
  );
}

export function getScheduleMapTarget(
  activity: ScheduleActivity,
): ResolvedScheduleMapTarget | null {
  const preset = findSeedMapTarget(activity);

  if (activity.place !== undefined) {
    return {
      kind: "attached",
      query: activity.place.displayName,
      placeUrl: activity.place.googleMapsUri,
      routeLocation: activity.place.location,
      routeGroup: preset?.routeGroup ?? `place:${activity.place.placeId}`,
      travelModeFromPrevious:
        preset?.travelModeFromPrevious ?? "transit",
      // An attached place is an explicit user decision, so seed-only
      // suppression for placeholders such as "현장 선택" must not survive.
      allowFromPrevious: true,
      allowAsOrigin: true,
    };
  }

  if (preset !== undefined) {
    const query = preset.query ?? null;
    const routeLocation = preset.routeQuery ?? query;
    return {
      kind: preset.kind,
      query,
      placeUrl:
        query === null || preset.kind === "choice" || preset.kind === "multi-stop"
          ? null
          : createGoogleMapsSearchUrl(query),
      routeLocation,
      routeGroup: preset.routeGroup ?? routeLocation,
      travelModeFromPrevious:
        preset.travelModeFromPrevious ?? inferTravelMode(activity),
      allowFromPrevious: preset.allowFromPrevious ?? true,
      allowAsOrigin: preset.allowAsOrigin ?? true,
    };
  }

  const query = activity.placeName.trim();
  if (query.length === 0) return null;
  return {
    kind: "unverified",
    query,
    placeUrl: createGoogleMapsSearchUrl(query),
    routeLocation: query,
    routeGroup: null,
    // Without coordinates, choosing transit is safer than forcing a
    // potentially long walking route for a user-authored stop.
    travelModeFromPrevious: "transit",
    allowFromPrevious: true,
    allowAsOrigin: true,
  };
}

export function createScheduleDirectionsUrl(
  origin: ScheduleActivity,
  destination: ScheduleActivity,
): string | null {
  const originTarget = getScheduleMapTarget(origin);
  const destinationTarget = getScheduleMapTarget(destination);
  if (
    originTarget === null ||
    destinationTarget === null ||
    originTarget.routeLocation === null ||
    destinationTarget.routeLocation === null ||
    !originTarget.allowAsOrigin ||
    !destinationTarget.allowFromPrevious ||
    (originTarget.routeGroup !== null &&
      originTarget.routeGroup === destinationTarget.routeGroup)
  ) {
    return null;
  }

  return createGoogleMapsDirectionsUrl({
    origin: originTarget.routeLocation,
    destination: destinationTarget.routeLocation,
    travelMode: resolveTravelMode(originTarget, destinationTarget),
  });
}

export function createScheduleFallbackDirectionsUrl(
  origin: ScheduleActivity,
  destination: ScheduleActivity,
): string | null {
  const originTarget = getScheduleMapTarget(origin);
  const destinationTarget = getScheduleMapTarget(destination);
  if (
    originTarget === null ||
    destinationTarget === null ||
    destinationTarget.routeLocation === null ||
    (originTarget.routeGroup !== null &&
      originTarget.routeGroup === destinationTarget.routeGroup) ||
    (destination.kind !== "transport" &&
      !(
        destination.priority === "required" &&
        (destination.timeKind === "target" ||
          destination.timeKind === "reservation")
      ))
  ) {
    return null;
  }

  return createGoogleMapsCurrentLocationDirectionsUrl(
    destinationTarget.routeLocation,
    destinationTarget.travelModeFromPrevious,
  );
}

export function createScheduleCurrentLocationDirectionsUrl(
  activity: ScheduleActivity,
): string | null {
  const target = getScheduleMapTarget(activity);
  if (target?.routeLocation === null || target?.routeLocation === undefined) {
    return null;
  }
  return createGoogleMapsCurrentLocationDirectionsUrl(
    target.routeLocation,
    target.travelModeFromPrevious,
  );
}

function resolveTravelMode(
  origin: ResolvedScheduleMapTarget,
  destination: ResolvedScheduleMapTarget,
): GoogleMapsTravelMode {
  if (
    typeof origin.routeLocation !== "string" &&
    origin.routeLocation !== null &&
    typeof destination.routeLocation !== "string" &&
    destination.routeLocation !== null
  ) {
    return distanceMeters(origin.routeLocation, destination.routeLocation) <=
      1_200
      ? "walking"
      : "transit";
  }
  return destination.travelModeFromPrevious;
}

function distanceMeters(
  origin: Exclude<GoogleMapsLocation, string>,
  destination: Exclude<GoogleMapsLocation, string>,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(
    destination.latitude - origin.latitude,
  );
  const longitudeDelta = toRadians(
    destination.longitude - origin.longitude,
  );
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function inferTravelMode(activity: ScheduleActivity): GoogleMapsTravelMode {
  return activity.kind === "transport" ? "transit" : "walking";
}
