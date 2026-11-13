export const browseTypes = {
  cafe: "cafe", food: "restaurant", shopping: "shopping_mall",
  clothing: "clothing_store", gifts: "gift_shop", books: "book_store", sights: "tourist_attraction",
} as const;
export type BrowseCategory = keyof typeof browseTypes;
/** 대표 유형(primaryType)이 이 목록에 있는 곳만 그 분류에 보여 준다. 목록이 없는 분류는 대표 유형을 보지 않는다.
 * 카페는 보조 유형에만 cafe가 붙은 패스트푸드점·이탈리안 레스토랑·델리·호텔이 섞여 나왔다. 값은 Google 유형표 Table A의 이름이다.
 * 카드에는 대표 유형 이름이 보이므로 "빵집"·"디저트 가게"로 보일 bakery·dessert_shop은 넣지 않는다. */
export const browsePrimaryTypes: Partial<Record<BrowseCategory, readonly string[]>> = {
  cafe: ["cafe", "coffee_shop", "coffee_roastery", "coffee_stand", "tea_house", "cat_cafe", "dog_cafe"],
};
/** 둘러보기에서 한 번에 보여 주는 장소 수. 장소마다 사진을 한 장씩 불러오므로 사진 비용도 이 수만큼 든다. */
export const BROWSE_MAX_PLACES = 10;
export interface BrowsePlace {
  placeId: string;
  name: string;
  address: string;
  type: string;
  rating?: number;
  reviews?: number;
  photo?: { uri: string; authors: string[] };
  /** 아래 칸은 추천 후보(picks)에만 온다. 좌표는 기기 메모리에서만 쓰고 수첩에 넣지 않는다. */
  location?: BrowseNear;
  /** Google 대표 유형 이름(Table A). 예: "ramen_restaurant" */
  primaryType?: string;
  /** 정기 영업 시간. 일요일 0시부터 센 분(0~10080) 구간. 예: 월 11:00~15:00 → { open: 2100, close: 2340 }. 끝이 다음 주로 넘어가면 close가 open보다 작다. */
  hours?: WeeklyHours[];
  /** 0(무료)~4(아주 비쌈). Google priceLevel을 숫자로 바꾼 값. */
  priceLevel?: number;
}
export interface WeeklyHours {
  open: number;
  close: number;
}
export const WEEK_MINUTES = 7 * 24 * 60;

/**
 * 추천 탭의 후보 묶음. 분류 하나 대신 먹고 마실 곳·보고 할 곳을 근처 검색 두 번으로 받는다.
 * 검색 한도는 한 번만 쓰고, 사진은 받지 않는다(장소마다 따로 과금된다). 근처 위치(near)가 꼭 있어야 한다.
 * 유형은 Google 유형표 Table A에 있는 이름만 쓴다. 없는 이름을 보내면 요청 전체가 거절된다.
 */
export const PICKS = "picks";
export const pickTypes = {
  eat: ["restaurant", "cafe", "bakery", "bar"],
  see: ["tourist_attraction", "museum", "art_gallery", "historical_landmark", "park", "zoo", "aquarium", "amusement_park", "shopping_mall", "department_store", "night_club"],
} as const;
/** 추천 후보를 찾는 반경(미터). 하루 동선 안에서 고르도록 숙소 근처 둘러보기(1.5km)보다 조금 넓다. */
export const PICKS_RADIUS_M = 2500;
/** 근처 검색 한 번의 Google 최대치(20) × 2. */
export const PICKS_MAX_PLACES = 40;
export function isPicksRequest(value: unknown): value is typeof PICKS {
  return value === PICKS;
}
export function isWeeklyHours(value: unknown): value is WeeklyHours {
  const v = value as WeeklyHours;
  const minute = (n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= WEEK_MINUTES;
  return !!v && typeof v === "object" && minute(v.open) && minute(v.close);
}
/** 숙소 근처로 둘러볼 때의 기준 위치. */
export interface BrowseNear {
  latitude: number;
  longitude: number;
}
/** 숙소에서 이 거리(미터) 안의 장소만 보여 준다. */
export const NEAR_RADIUS_M = 1500;
export function isBrowseNear(value: unknown): value is BrowseNear {
  const v = value as BrowseNear;
  return !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 2 &&
    typeof v.latitude === "number" && Number.isFinite(v.latitude) && v.latitude >= -90 && v.latitude <= 90 &&
    typeof v.longitude === "number" && Number.isFinite(v.longitude) && v.longitude >= -180 && v.longitude <= 180;
}
/** 좌표를 소수 셋째 자리(약 100m)로 줄인다. 숙소의 정확한 위치는 보내지 않는다. */
export function roundNear(near: BrowseNear): BrowseNear {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return { latitude: round(near.latitude), longitude: round(near.longitude) };
}
export function isBrowseCategory(value: unknown): value is BrowseCategory {
  return typeof value === "string" && Object.hasOwn(browseTypes, value);
}
export function isGooglePhotoUri(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.searchParams.has("key") &&
      (url.hostname === "googleusercontent.com" || url.hostname.endsWith(".googleusercontent.com"));
  } catch { return false; }
}
