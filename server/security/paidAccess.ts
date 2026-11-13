import { createClient } from "@supabase/supabase-js";
import { checkTransitAccess } from "./access.js";

const BEARER_PATTERN = /^Bearer ([^\s]+)$/;

export interface PaidAccessEnvironment {
  TRANSIT_ACCESS_TOKEN?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export type MemberStatus = { userId: string; premium: boolean } | null;

/** 로그인 토큰으로 사용자와 유료 권한을 확인한다. 토큰이 무효면 null. */
export type MemberLookup = (accessToken: string) => Promise<MemberStatus>;

export type PaidAccessResult =
  | { ok: true; userId: string | null }
  | {
      ok: false;
      status: 401 | 402 | 502 | 503;
      code: "UNAUTHORIZED" | "PAYMENT_REQUIRED" | "SERVER_CONFIG_ERROR" | "UPSTREAM_PROVIDER_ERROR";
    };

// 유료 기능은 둘 중 하나로 연다.
// 1) 로그인 토큰 + entitlements 표의 유효한 유료 권한 (출시용)
// 2) 개인 접근 코드 TRANSIT_ACCESS_TOKEN (개발·개인 사용용, userId 없음)
export async function checkPaidAccess(
  env: PaidAccessEnvironment,
  authorization: string | string[] | undefined,
  lookupMember: MemberLookup | null,
): Promise<PaidAccessResult> {
  const personal = checkTransitAccess(env.TRANSIT_ACCESS_TOKEN, authorization);
  if (personal.ok) return { ok: true, userId: null };
  if (!lookupMember) {
    return personal.reason === "SERVER_TOKEN_MISCONFIGURED"
      ? { ok: false, status: 503, code: "SERVER_CONFIG_ERROR" }
      : { ok: false, status: 401, code: "UNAUTHORIZED" };
  }
  const token = typeof authorization === "string" ? BEARER_PATTERN.exec(authorization)?.[1] : undefined;
  if (!token) return { ok: false, status: 401, code: "UNAUTHORIZED" };
  let member: MemberStatus;
  try {
    member = await lookupMember(token);
  } catch {
    // 권한 표를 읽지 못한 것은 사용자 잘못이 아니므로 401과 구분한다.
    return { ok: false, status: 502, code: "UPSTREAM_PROVIDER_ERROR" };
  }
  if (!member) return { ok: false, status: 401, code: "UNAUTHORIZED" };
  if (!member.premium) return { ok: false, status: 402, code: "PAYMENT_REQUIRED" };
  return { ok: true, userId: member.userId };
}

/** 로그인 토큰의 사용자 id. 토큰이 무효면 null. */
export type UserLookup = (accessToken: string) => Promise<string | null>;

// 무료지만 서버 비용이 드는 기능(장소 찾기 등). 개인 접근 코드나 아무 로그인 토큰으로 연다.
// 유료 권한은 보지 않는다. 로그인을 요구해 구글 사용량이 새지 않게 한다.
export async function checkSignedInAccess(
  env: PaidAccessEnvironment,
  authorization: string | string[] | undefined,
  lookupUser: UserLookup | null,
): Promise<PaidAccessResult> {
  const personal = checkTransitAccess(env.TRANSIT_ACCESS_TOKEN, authorization);
  if (personal.ok) return { ok: true, userId: null };
  if (!lookupUser) {
    return personal.reason === "SERVER_TOKEN_MISCONFIGURED"
      ? { ok: false, status: 503, code: "SERVER_CONFIG_ERROR" }
      : { ok: false, status: 401, code: "UNAUTHORIZED" };
  }
  const token = typeof authorization === "string" ? BEARER_PATTERN.exec(authorization)?.[1] : undefined;
  if (!token) return { ok: false, status: 401, code: "UNAUTHORIZED" };
  let userId: string | null;
  try {
    userId = await lookupUser(token);
  } catch {
    return { ok: false, status: 502, code: "UPSTREAM_PROVIDER_ERROR" };
  }
  return userId ? { ok: true, userId } : { ok: false, status: 401, code: "UNAUTHORIZED" };
}

export function createSupabaseUserLookup(env: PaidAccessEnvironment): UserLookup | null {
  const url = env.SUPABASE_URL?.trim();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return async (accessToken) => {
    const { data, error } = await admin.auth.getUser(accessToken);
    return error || !data.user ? null : data.user.id;
  };
}

/** 유효한 유료 권한인지. expires_at이 없으면 만료 없음. */
export function isActiveEntitlement(row: { premium: boolean; expires_at: string | null } | null, now: Date): boolean {
  if (!row?.premium) return false;
  return row.expires_at === null || Date.parse(row.expires_at) > now.getTime();
}

// Supabase가 설정되지 않은 배포에서는 null을 돌려 개인 접근 코드만 쓰게 한다.
export function createSupabaseMemberLookup(env: PaidAccessEnvironment, now: () => Date = () => new Date()): MemberLookup | null {
  const url = env.SUPABASE_URL?.trim();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return async (accessToken) => {
    const { data, error } = await admin.auth.getUser(accessToken);
    if (error || !data.user) return null;
    const { data: row, error: rowError } = await admin
      .from("entitlements")
      .select("premium, expires_at")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (rowError) throw rowError;
    return { userId: data.user.id, premium: isActiveEntitlement(row, now()) };
  };
}
