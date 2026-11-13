import type { Key } from "../i18n/strings";

/** 서버가 429로 막았을 때 보여 줄 문구. 응답 본문의 code로 고르고, 읽지 못하면 "잠시 후"로 안내한다. */
export async function limitKey(response: Response): Promise<Key> {
  const body = (await response.json().catch(() => null)) as { code?: unknown } | null;
  if (body?.code === "DAILY_LIMIT_REACHED") return "limit.daily";
  if (body?.code === "SERVICE_LIMIT_REACHED") return "limit.service";
  return "limit.rate";
}

export function isLimitKey(key: Key): boolean {
  return key === "limit.rate" || key === "limit.daily" || key === "limit.service";
}
