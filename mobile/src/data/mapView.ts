/** 장소 찾기 서버를 쓸 수 있는지. 지도 자리에 무엇을 보일지 고르는 데 쓴다. */
export type PlaceAccessState = "ready" | "loading" | "signedOut" | "unconfigured";

/**
 * 서버 주소·인증 값으로 장소 찾기 상태를 고른다.
 * 서버 주소가 있으면 로그인 없이도 손님 경로로 조회한다. 서버 주소가 없는 빌드만 unconfigured다.
 */
export function placeAccessState(access: { baseUrl: string; credential: string; ready: boolean; canSignIn: boolean }): PlaceAccessState {
  if (!access.baseUrl) return "unconfigured";
  if (access.credential) return "ready";
  if (!access.ready) return "loading";
  return "ready";
}

/**
 * 이 기기에서 Google 지도를 그려도 되는지. 아니면 지도 대신 안내와 장소 목록을 보인다.
 * Android는 지도 뷰가 늘 빌드에 들어가지만, 키 메타데이터 없이 지도를 띄우면 SDK가 앱을 종료시킨다.
 * 그래서 Android는 빌드 설정의 키 표시(keys.android)가 참일 때만 허용한다. 값이 없으면 키가 없다고 본다.
 * iOS는 키를 넣어 빌드해야 Google 지도 뷰가 생기므로 googleView만으로 판단한다.
 */
/** Google 지도 네이티브 뷰 이름. Android는 provider와 상관없이 AIRMap 하나만 등록한다(react-native-maps). */
export function googleMapViewName(platform: string): string {
  return platform === "android" ? "AIRMap" : "AIRGoogleMap";
}

export function googleMapsReady(input: { platform: string; nativeModule: boolean; googleView: boolean; keys?: { ios?: unknown; android?: unknown } | null }): boolean {
  if (!input.nativeModule || !input.googleView) return false;
  if (input.platform === "android") return input.keys?.android === true;
  return input.platform === "ios";
}

/** 그날 지도 자리에 보일 것. none이면 찾을 곳이 없어 아무것도 그리지 않는다. */
export type MapView = "map" | "none" | "loading" | "signIn" | "unconfigured" | "failed" | "unavailable";

/**
 * 지도 자리 상태를 고른다. 이미 찾은 좌표가 있으면 로그인 여부와 상관없이 지도를 먼저 보인다.
 * pending은 좌표도 없고 실패로도 끝나지 않은 곳 수다. 조회 중이거나 아직 조회를 시작하지 못한 곳이다.
 */
export function mapView(input: { points: number; failed: number; pending: number; access: PlaceAccessState; maps: boolean }): MapView {
  if (input.points > 0) return input.maps ? "map" : "unavailable";
  // 실패 안내와 다시 시도는 예전 동작 그대로 둔다.
  if (input.failed > 0) return "failed";
  if (input.pending === 0) return "none";
  // 지도 모듈이 없는 빌드는 로그인해도 지도를 그릴 수 없다.
  if (!input.maps) return "unavailable";
  if (input.access === "unconfigured") return "unconfigured";
  if (input.access === "signedOut") return "signIn";
  // 로그인 상태를 읽는 중이거나, 인증 값이 있고 위치를 찾는 중이다.
  return "loading";
}

/** iOS는 키가 필요 없는 Apple 지도를 쓴다. Android는 기존 Google 키 방어를 유지한다. */
export function nativeMapProvider(platform: string, googleReady: boolean): 'apple' | 'google' | null {
  return platform === 'ios' ? 'apple' : googleReady ? 'google' : null;
}
