import { createPlaceHandler } from "./place.js";
import { createGooglePlaceLookup } from "../server/places/googlePlaceLookup.js";
import { createDefaultRouteGuard } from "../server/security/costGuard.js";
import { createResponseCache, isCacheOff } from "../server/security/responseCache.js";

// 로그인 없는 개인 여행의 검색·좌표 조회만 허용한다. 계정 데이터나 유료 JEV 권한에는 접근하지 않는다.
// IP 분당 12회·하루 80회, 서비스 전체 하루 600회가 기본값이며 기존 비용 제한 환경 변수로 조정한다.
export default createPlaceHandler({
  env: process.env,
  allowGuests: true,
  createLookup: (apiKey) => createGooglePlaceLookup({ apiKey }),
  guard: createDefaultRouteGuard("GUEST_PLACE", process.env),
  cache: createResponseCache({ ttlMs: 5 * 60_000, maxEntries: 300, disabled: isCacheOff(process.env) }),
});
