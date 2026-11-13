// 계획 탭 두 장소 사이의 이동. 앱 안에서는 경로를 조회하지 않고 Google 지도 길찾기로 넘긴다.
// 나라마다 철도·버스 공급자가 달라서, 어느 나라에서든 같은 방식으로 동작하는 Google 지도에 맡긴다.

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

/** 길찾기 한쪽 끝. 좌표를 모르면 주소나 장소 이름 문자열을 그대로 Google 지도 검색어로 쓴다. */
export type RouteEnd = RoutePoint | string;

/** Google 지도 대중교통 길찾기 주소. 예: (34.69,135.50) → "東京駅" 이면 origin=34.69,135.50&destination=東京駅. */
export function transitMapsUrl(origin: RouteEnd, destination: RouteEnd): string {
  const query = new URLSearchParams({ api: "1", origin: endText(origin), destination: endText(destination), travelmode: "transit" });
  return `https://www.google.com/maps/dir/?${query.toString()}`;
}

/** 지금 있는 곳에서 출발하는 길찾기. 출발지를 비우면 Google 지도가 기기 위치를 쓴다. */
export function directionsFromHere(destination: RouteEnd): string {
  const query = new URLSearchParams({ api: "1", destination: endText(destination), travelmode: "transit" });
  return `https://www.google.com/maps/dir/?${query.toString()}`;
}

/**
 * 시간표 이웃한 두 줄 사이의 이동. 결과[i]는 timed[i] → timed[i+1], 넘길 곳이 없으면 null.
 * 끝점은 찾은 좌표 → 적어 둔 주소 → 장소 이름 순으로 고른다. 위치 검색이 실패해도 이름으로 버튼을 낸다.
 * 항공편·이동 예약 줄(move, arrive)은 제목이 편명이라 검색어로 쓰지 않는다.
 */
export function routeLegs<T extends { id: string; kind: string; title: string }>(
  timed: T[],
  located: Record<string, RoutePoint>,
  addresses: Record<string, string> = {},
): ({ from: T; to: T; origin: RouteEnd; destination: RouteEnd } | null)[] {
  const end = (item: T): RouteEnd | null => {
    if (item.kind === "move" || item.kind === "arrive") return null;
    return located[item.id] ?? (addresses[item.id]?.trim() || item.title.trim() || null);
  };
  return timed.slice(0, -1).map((from, i) => {
    const to = timed[i + 1];
    const origin = end(from);
    const destination = end(to);
    if (origin === null || destination === null || samePlace(origin, destination)) return null;
    return { from, to, origin, destination };
  });
}

// 같은 장소의 두 일정(예: 같은 가게에서 점심 뒤 커피) 사이에는 길찾기를 두지 않는다. 0.0005도는 약 50m.
function samePlace(a: RouteEnd, b: RouteEnd): boolean {
  if (typeof a === "string" || typeof b === "string") return typeof a === "string" && typeof b === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();
  return Math.abs(a.latitude - b.latitude) < 0.0005 && Math.abs(a.longitude - b.longitude) < 0.0005;
}

function endText(end: RouteEnd): string {
  return typeof end === "string" ? end.trim() : `${end.latitude},${end.longitude}`;
}
