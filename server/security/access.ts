import { timingSafeEqual } from "node:crypto";

const MIN_TOKEN_BYTES = 24;
const BEARER_PATTERN = /^Bearer ([^\s]+)$/;

export type TransitAccessResult =
  | { ok: true }
  | {
      ok: false;
      reason: "SERVER_TOKEN_MISCONFIGURED" | "UNAUTHORIZED";
    };

export function checkTransitAccess(
  configuredToken: string | undefined,
  authorizationHeader: string | string[] | undefined,
): TransitAccessResult {
  if (
    configuredToken === undefined ||
    Buffer.byteLength(configuredToken, "utf8") < MIN_TOKEN_BYTES
  ) {
    return { ok: false, reason: "SERVER_TOKEN_MISCONFIGURED" };
  }

  if (typeof authorizationHeader !== "string") {
    return { ok: false, reason: "UNAUTHORIZED" };
  }

  const requestToken = BEARER_PATTERN.exec(authorizationHeader)?.[1];
  if (requestToken === undefined) {
    return { ok: false, reason: "UNAUTHORIZED" };
  }

  const configuredBytes = Buffer.from(configuredToken, "utf8");
  const requestBytes = Buffer.from(requestToken, "utf8");
  if (configuredBytes.byteLength !== requestBytes.byteLength) {
    return { ok: false, reason: "UNAUTHORIZED" };
  }

  return timingSafeEqual(configuredBytes, requestBytes)
    ? { ok: true }
    : { ok: false, reason: "UNAUTHORIZED" };
}
