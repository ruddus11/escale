import { createClient } from "@supabase/supabase-js";
import type { PaidAccessEnvironment } from "./paidAccess.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type SearchLimitCode = "SEARCH_QUOTA_EXCEEDED" | "SEARCH_RATE_LIMITED" | "SEARCH_BUSY" | "SEARCH_PAUSED" | "SEARCH_BUDGET_EXCEEDED";
const CODES: SearchLimitCode[] = ["SEARCH_QUOTA_EXCEEDED", "SEARCH_RATE_LIMITED", "SEARCH_BUSY", "SEARCH_PAUSED", "SEARCH_BUDGET_EXCEEDED"];
export interface SearchAllowance {
  tier: "admin" | "paid" | "free";
  limit: number | null;
  remaining: number | null;
  resetsAt: string;
}
export type UsageDecision = ({ allowed: true } & SearchAllowance) | { allowed: false; code: SearchLimitCode; retryAfter: number };
export interface PlaceUsage {
  reserve(userId: string, admin: boolean, requestId: string): Promise<UsageDecision>;
  finish(requestId: string, succeeded: boolean): Promise<void>;
}

/** 운영자 권한은 서버 허용 목록에 있는 인증된 UUID에만 부여한다. */
export function isAdminUser(userId: string, configuredIds: string | undefined): boolean {
  if (!UUID.test(userId)) return false;
  return (configuredIds ?? "").split(",").map(id => id.trim().toLowerCase())
    .filter(id => UUID.test(id)).includes(userId.toLowerCase());
}

/** 잘못된 DB 응답이 검색 한도 면제로 이어지지 않도록 거부한다. */
export function parseUsageDecision(raw: unknown): UsageDecision {
  const v = raw as Record<string, unknown> | null;
  if (v?.allowed === false && CODES.includes(v.code as SearchLimitCode) && Number.isSafeInteger(v.retryAfter) && Number(v.retryAfter) > 0) {
    return { allowed: false, code: v.code as SearchLimitCode, retryAfter: Number(v.retryAfter) };
  }
  if (v?.allowed === true && typeof v.tier === "string" && ["free", "paid", "admin"].includes(v.tier) && typeof v.resetsAt === "string" && Number.isFinite(Date.parse(v.resetsAt))) {
    const admin = v.tier === "admin";
    if ((admin && v.limit === null && v.remaining === null) || (!admin && Number.isSafeInteger(v.limit) && Number(v.limit) > 0 && Number.isSafeInteger(v.remaining) && Number(v.remaining) >= 0 && Number(v.remaining) < Number(v.limit))) {
      return { allowed: true, tier: v.tier as SearchAllowance["tier"], limit: v.limit as number | null, remaining: v.remaining as number | null, resetsAt: v.resetsAt };
    }
  }
  throw new Error("Invalid place usage response");
}

export function createPlaceUsage(env: PaidAccessEnvironment): PlaceUsage | null {
  if (!env.SUPABASE_URL?.trim() || !env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return null;
  const client = createClient(env.SUPABASE_URL.trim(), env.SUPABASE_SERVICE_ROLE_KEY.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(5_000) }) },
  });
  return {
    async reserve(userId, admin, requestId) {
      const { data, error } = await client.rpc("reserve_place_search", { p_user_id: userId, p_is_admin: admin, p_request_id: requestId });
      if (error) throw new Error("Place usage unavailable");
      return parseUsageDecision(data);
    },
    async finish(requestId, succeeded) {
      const { error } = await client.rpc("finish_place_search", { p_request_id: requestId, p_succeeded: succeeded });
      if (error) throw new Error("Place usage settlement unavailable");
    },
  };
}
