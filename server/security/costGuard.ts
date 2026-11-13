import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { VercelResponse } from "@vercel/node";
import type { PaidAccessEnvironment } from "./paidAccess.js";

// 한 사람이나 한 IP가 Google Places·AI 요금을 키우지 못하게 유료 호출 앞에서 횟수를 센다.
// 세 가지를 한꺼번에 본다: 개인 분당, 개인 하루, 경로 전체 하루. 하나라도 넘으면 아무것도 세지 않고 거절한다.
// 거절된 요청을 세지 않는 이유: 한 사람이 거절을 반복해 전체 한도를 다 써 버리는 것을 막는다.
//
// 구간은 고정 창이다. 분 창은 매분 0초, 하루 창은 UTC 자정에 새로 시작한다.
// 예: 분당 30회면 12:00:59에 30회, 12:01:00에 다시 30회가 가능하다(경계에서 최대 2배).

export type LimitCode = "RATE_LIMITED" | "DAILY_LIMIT_REACHED" | "SERVICE_LIMIT_REACHED";
export type LimitDecision = { allowed: true } | { allowed: false; code: LimitCode; retryAfter: number };

export class CostLimitError extends Error {
  constructor(readonly decision: Extract<LimitDecision, { allowed: false }>) {
    super(decision.code);
  }
}

/** 한 번에 세는 창 하나. key에는 창 시작 시각이 들어 있어 창이 바뀌면 새로 센다. */
export interface CounterWindow {
  key: string;
  limit: number;
  /** 창이 끝나는 시각(밀리초). 저장소가 지난 창을 지울 때 쓴다. */
  expiresAt: number;
}

/** 모든 창이 한도 아래면 전부 1씩 올리고 빈 배열을, 아니면 넘은 창의 순번을 돌려준다. 확인과 증가는 한 번에 해야 한다. */
export interface CounterStore {
  hit(windows: CounterWindow[], now: number): Promise<number[]>;
}

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

/** 경로별 한도. 0이면 그 창은 항상 막힌다(긴급 차단용). */
export interface RoutePolicy {
  route: string;
  perMinute: number;
  perDay: number;
  globalPerDay: number;
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

// 기본값은 앱의 정상 사용보다 넉넉하고, 한 사람이 하루에 만들 수 있는 비용은 작게 잡았다.
// 추천 1회는 Google 검색 4회와 Jev 판단 최대 32회라서 가장 낮다.
export const DEFAULT_POLICIES = {
  GUEST_PLACE: { perMinute: 12, perDay: 80, globalPerDay: 600 },
  PLACE: { perMinute: 30, perDay: 400, globalPerDay: 5_000 },
  RECOMMEND_PLACES: { perMinute: 3, perDay: 20, globalPerDay: 300 },
  PLACES_SEARCH: { perMinute: 20, perDay: 200, globalPerDay: 2_000 },
  PLACES_RESTAURANTS: { perMinute: 10, perDay: 100, globalPerDay: 1_000 },
  EXTRACT_RESERVATION: { perMinute: 5, perDay: 50, globalPerDay: 500 },
  READ_POUCH: { perMinute: 10, perDay: 100, globalPerDay: 1_000 },
} as const satisfies Record<string, Omit<RoutePolicy, "route">>;

export type GuardedRoute = keyof typeof DEFAULT_POLICIES;

/**
 * 환경 변수로 기본 한도를 바꾼다. 예: API_LIMIT_PLACE_GLOBAL_PER_DAY=2000.
 * 숫자가 아니거나 음수면 기본값을 쓴다. 잘못된 설정이 한도 해제로 이어지면 안 된다.
 */
export function readPolicy(route: GuardedRoute, env: Record<string, string | undefined>): RoutePolicy {
  const defaults = DEFAULT_POLICIES[route];
  const read = (suffix: string, fallback: number) => {
    const raw = env[`API_LIMIT_${route}_${suffix}`]?.trim();
    return raw && /^\d{1,9}$/.test(raw) ? Number(raw) : fallback;
  };
  return {
    route,
    perMinute: read("PER_MINUTE", defaults.perMinute),
    perDay: read("PER_DAY", defaults.perDay),
    globalPerDay: read("GLOBAL_PER_DAY", defaults.globalPerDay),
  };
}

/**
 * 로그인했으면 계정 ID, 아니면(개인 접근 코드) 요청 IP로 사람을 구분한다.
 * Vercel이 설정한 forwarded-for를 우선한다. 다른 프록시가 일반 x-forwarded-for를 바꿀 수 있다.
 * 계정 ID와 IP는 원문 대신 해시로만 센다. 한도 표(api_usage_windows)에 계정 ID 원문이 남지 않게 하기 위해서다.
 * IPv6은 한 가입자가 바꿔 쓸 수 있는 /64 단위로 묶는다.
 */
export function clientIdentity(userId: string | null, headers: Record<string, string | string[] | undefined>): string {
  if (userId) return `u:${createHash("sha256").update(userId).digest("hex").slice(0, 32)}`;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.split(",")[0]?.trim();
  const ip = first(headers["x-vercel-forwarded-for"]) || first(headers["x-forwarded-for"]) || "unknown";
  return `ip:${createHash("sha256").update(ipBucket(ip)).digest("hex").slice(0, 32)}`;
}

export function ipBucket(ip: string): string {
  const address = ip.toLowerCase().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  if (!address.includes(":")) return address;
  if (/^::ffff:\d+\.\d+\.\d+\.\d+$/.test(address)) return address.slice(7);
  const [head, tail = ""] = address.split("::");
  const left = head ? head.split(":") : [];
  const right = address.includes("::") && tail ? tail.split(":") : [];
  const groups = address.includes("::") ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

export interface RouteGuard {
  admit(identity: string): Promise<LimitDecision>;
}

export function createRouteGuard(policy: RoutePolicy, store: CounterStore, clock: Clock = systemClock): RouteGuard {
  return {
    async admit(identity) {
      const now = clock.now();
      const minuteStart = Math.floor(now / MINUTE_MS) * MINUTE_MS;
      const dayStart = Math.floor(now / DAY_MS) * DAY_MS;
      const day = new Date(dayStart).toISOString().slice(0, 10);
      const windows: (CounterWindow & { code: LimitCode })[] = [
        { key: `${policy.route}:m:${minuteStart}:${identity}`, limit: policy.perMinute, expiresAt: minuteStart + MINUTE_MS, code: "RATE_LIMITED" },
        { key: `${policy.route}:d:${day}:${identity}`, limit: policy.perDay, expiresAt: dayStart + DAY_MS, code: "DAILY_LIMIT_REACHED" },
        { key: `${policy.route}:d:${day}:all`, limit: policy.globalPerDay, expiresAt: dayStart + DAY_MS, code: "SERVICE_LIMIT_REACHED" },
      ];
      const blocked = await store.hit(windows.map(({ code: _code, ...w }) => w), now);
      if (!blocked.length) return { allowed: true };
      // 여러 창이 막혔으면 가장 오래 기다려야 하는 창을 알린다. 예: 하루 한도가 찼으면 1분 뒤가 아니라 자정까지.
      const worst = blocked.map((i) => windows[i]).filter(Boolean).sort((a, b) => b.expiresAt - a.expiresAt)[0] ?? windows[2];
      return { allowed: false, code: worst.code, retryAfter: Math.max(1, Math.ceil((worst.expiresAt - now) / 1000)) };
    },
  };
}

/**
 * 함수 인스턴스 안에서만 세는 저장소. 인스턴스가 여러 개거나 새로 뜨면 각자 0부터 센다.
 * 공유 저장소(Supabase)를 쓸 수 없을 때의 최소 방어선이다.
 */
export function createMemoryCounterStore(maxKeys = 10_000): CounterStore {
  const counts = new Map<string, { used: number; expiresAt: number }>();
  return {
    async hit(windows, now) {
      if (counts.size > maxKeys) for (const [key, entry] of counts) if (entry.expiresAt <= now) counts.delete(key);
      const used = (w: CounterWindow) => {
        const entry = counts.get(w.key);
        return entry && entry.expiresAt > now ? entry.used : 0;
      };
      const blocked = windows.flatMap((w, i) => (used(w) >= w.limit ? [i] : []));
      if (blocked.length) return blocked;
      for (const w of windows) counts.set(w.key, { used: used(w) + 1, expiresAt: w.expiresAt });
      return [];
    },
  };
}

/** api_usage_windows 표와 hit_api_limits 함수(20261028000000_api_usage_limits.sql)로 모든 인스턴스가 같은 수를 센다. */
export function createSupabaseCounterStore(env: PaidAccessEnvironment): CounterStore | null {
  if (!env.SUPABASE_URL?.trim() || !env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return null;
  const client = createClient(env.SUPABASE_URL.trim(), env.SUPABASE_SERVICE_ROLE_KEY.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(3_000) }) },
  });
  return {
    async hit(windows) {
      const { data, error } = await client.rpc("hit_api_limits", {
        p_keys: windows.map((w) => w.key),
        p_limits: windows.map((w) => w.limit),
        p_expires: windows.map((w) => new Date(w.expiresAt).toISOString()),
      });
      if (error) throw new Error("API usage store unavailable");
      return parseHitResult(data, windows.length);
    },
  };
}

/** 잘못된 DB 응답을 허용으로 읽지 않는다. */
export function parseHitResult(raw: unknown, size: number): number[] {
  const v = raw as { allowed?: unknown; blocked?: unknown } | null;
  if (v?.allowed === true) return [];
  if (v?.allowed === false && Array.isArray(v.blocked) && v.blocked.length && v.blocked.every((i) => Number.isInteger(i) && i >= 0 && i < size)) return v.blocked as number[];
  throw new Error("Invalid API usage response");
}

/**
 * 공유 저장소가 실패하면(마이그레이션 미적용·장애) 메모리로 센다. 한도 없이 통과시키지 않는다.
 * 실패 뒤 1분은 공유 저장소를 다시 부르지 않아 매 요청이 3초씩 기다리지 않게 한다.
 */
export function createFallbackCounterStore(primary: CounterStore | null, fallback: CounterStore, retryAfterMs = MINUTE_MS): CounterStore {
  let skipUntil = 0;
  return {
    async hit(windows, now) {
      if (primary && now >= skipUntil) {
        try {
          return await primary.hit(windows, now);
        } catch {
          skipUntil = now + retryAfterMs;
          console.error("API_USAGE_STORE_FALLBACK");
        }
      }
      return fallback.hit(windows, now);
    },
  };
}

/** 배포 기본 구성. Supabase가 설정돼 있으면 공유 카운터, 아니면 메모리 카운터. */
export function createDefaultRouteGuard(route: GuardedRoute, env: PaidAccessEnvironment & Record<string, string | undefined>): RouteGuard {
  return createRouteGuard(readPolicy(route, env), createFallbackCounterStore(createSupabaseCounterStore(env), createMemoryCounterStore()));
}

const MESSAGES: Record<LimitCode, string> = {
  RATE_LIMITED: "Too many requests. Try again shortly.",
  DAILY_LIMIT_REACHED: "Daily limit reached. Try again tomorrow.",
  SERVICE_LIMIT_REACHED: "This feature is busy today. Try again later.",
};

/** 앱은 code로 문구를 고른다. message는 다른 클라이언트를 위한 짧은 영어 설명이다. */
export function sendLimited(response: VercelResponse, decision: Extract<LimitDecision, { allowed: false }>): void {
  response.setHeader("Retry-After", String(decision.retryAfter));
  response.status(429).json({ code: decision.code, retryAfter: decision.retryAfter, message: MESSAGES[decision.code] });
}
