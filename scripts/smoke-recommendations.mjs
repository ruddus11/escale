// 합성 여행 조건으로 배포 서버의 인증과 Google→Jev 추천 응답을 확인한다. 비밀키는 출력하지 않는다.
const base = (process.env.EXPO_PUBLIC_API_BASE_URL || "https://osaka-pocket.vercel.app").replace(/\/+$/, "");
const credential = process.env.TRANSIT_ACCESS_TOKEN?.trim();
const destination = process.argv[2] || "Paris";
const preference = process.argv[3] || "quiet cafes and museums";
if (!credential) {
  console.error("TRANSIT_ACCESS_TOKEN이 필요합니다. .env.local을 읽어 실행하세요.");
  process.exit(1);
}
const url = new URL("/api/recommend-places", base);
if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
  throw new Error("원격 검사는 HTTPS 주소만 허용합니다.");
}
const trip = { destination, preference, startDate: "2026-11-10", endDate: "2026-11-13", travelers: 2 };
async function request(body, authenticated) {
  const started = Date.now();
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: `Bearer ${credential}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
    redirect: "error",
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, ms: Date.now() - started, data };
}
function check(condition, message) { if (!condition) throw new Error(message); }
try {
  const anonymous = await request(trip, false);
  console.log(JSON.stringify({ check: "anonymous", status: anonymous.status }));
  check(anonymous.status === 401, "무인증 요청이 401로 거부되지 않았습니다.");
  const malformed = await request({ ...trip, travelers: 0 }, true);
  console.log(JSON.stringify({ check: "validation", status: malformed.status }));
  check(malformed.status === 400, "잘못된 인원수 요청이 400으로 거부되지 않았습니다.");
  const result = await request(trip, true);
  const places = result.data?.places;
  console.log(JSON.stringify({ check: "recommendations", destination, status: result.status, ms: result.ms, count: Array.isArray(places) ? places.length : null, code: result.data?.error ?? result.data?.code }));
  check(result.status === 200, "추천 요청 실패: 인증·배포·Google/TypeSafe 설정 또는 공급자 응답을 확인하세요.");
  check(Array.isArray(places) && places.length > 0 && places.length <= 12, "추천 결과가 없거나 개수 제한을 벗어났습니다.");
  const groups = {};
  const ids = new Set();
  for (const p of places) {
    check(["food", "cafe", "sight", "shopping"].includes(p.category), "알 수 없는 분류입니다.");
    check(typeof p.placeId === "string" && p.placeId && !ids.has(p.placeId), "장소 ID가 없거나 중복입니다.");
    ids.add(p.placeId);
    check(typeof p.displayName === "string" && p.displayName.trim() && typeof p.formattedAddress === "string" && p.googleMapsUri?.startsWith("https://"), "앱에서 읽을 장소 필드가 누락됐습니다.");
    check(Number.isFinite(p.preferenceFit) && p.preferenceFit >= 0 && p.preferenceFit <= 1, "취향을 입력했지만 Jev 판단 점수가 유효하지 않습니다.");
    groups[p.category] = (groups[p.category] || 0) + 1;
  }
  check(Object.values(groups).every(count => count <= 3), "분류별 추천 개수 제한을 벗어났습니다.");
  console.log(JSON.stringify({ result: "contract-passed", groups, scoreRanges: Object.fromEntries(Object.keys(groups).map(category => {
    const scores = places.filter(p => p.category === category).map(p => p.preferenceFit);
    return [category, { min: Math.min(...scores), max: Math.max(...scores) }];
  })), examples: places.map(p => ({ name: p.displayName, category: p.category, fit: p.preferenceFit })) }));
} catch (error) {
  console.error(JSON.stringify({ result: "failed", message: error instanceof Error ? error.message : "Unknown error" }));
  process.exitCode = 1;
}
