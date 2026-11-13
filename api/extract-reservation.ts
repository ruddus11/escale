import type { VercelApiHandler } from "@vercel/node";
import { APITimeoutError } from "@typesafe-ai/sdk";
import {
  checkPaidAccess,
  createSupabaseMemberLookup,
  type MemberLookup,
  type PaidAccessEnvironment,
} from "../server/security/paidAccess.js";
import { hasOnlyKeys, sendJson, setSafeResponseHeaders } from "../server/http/guards.js";
import {
  MAX_CONFIRMATION_LENGTH,
  assembleReservation,
  findCandidates,
  redactConfirmation,
} from "../src/domain/reservations/confirmation.js";
import {
  createTypeSafeConfirmationReader,
  type ConfirmationReader,
} from "../server/reservations/typesafeConfirmationReader.js";
import { clientIdentity, createDefaultRouteGuard, sendLimited, type RouteGuard } from "../server/security/costGuard.js";

interface ExtractReservationEnvironment extends PaidAccessEnvironment {
  TYPESAFE_API_KEY?: string;
}

export interface ExtractReservationHandlerDependencies {
  env: ExtractReservationEnvironment;
  createReader: (apiKey: string) => ConfirmationReader;
  lookupMember?: MemberLookup | null;
  guard: RouteGuard;
}

// 유료 기능. 로그인한 유료 회원이나 개인 접근 코드로만 연다.
// 예약 원문은 저장하지 않고, 예약번호·연락처는 앱과 서버 양쪽에서 가린다.
export function createExtractReservationHandler(
  dependencies: ExtractReservationHandlerDependencies,
): VercelApiHandler {
  return async (request, response) => {
    setSafeResponseHeaders(response);
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, "METHOD_NOT_ALLOWED");
      return;
    }
    const access = await checkPaidAccess(dependencies.env, request.headers.authorization, dependencies.lookupMember ?? null);
    if (access.ok === false) {
      sendJson(response, access.status, access.code);
      return;
    }
    const apiKey = dependencies.env.TYPESAFE_API_KEY?.trim();
    if (!apiKey) {
      sendJson(response, 503, "SERVER_CONFIG_ERROR");
      return;
    }
    const body = request.body;
    if (
      !hasOnlyKeys(body, ["text", "year"], ["text", "year"]) ||
      typeof body.text !== "string" ||
      !body.text.trim() ||
      body.text.length > MAX_CONFIRMATION_LENGTH ||
      typeof body.year !== "number" ||
      !Number.isInteger(body.year) ||
      body.year < 2000 ||
      body.year > 2100
    ) {
      sendJson(response, 400, "INVALID_REQUEST");
      return;
    }

    const text = redactConfirmation(body.text);
    const candidates = findCandidates(text, body.year);
    if (!candidates.dates.length && !candidates.times.length && !candidates.places.length && !candidates.services.length) {
      response.status(200).json({ reservation: {} });
      return;
    }
    const decision = await dependencies.guard.admit(clientIdentity(access.userId, request.headers));
    if (!decision.allowed) {
      sendLimited(response, decision);
      return;
    }
    try {
      const picked = await dependencies.createReader(apiKey).read(text, candidates);
      response.status(200).json({ reservation: assembleReservation(candidates, picked) });
    } catch (error) {
      const timedOut = error instanceof APITimeoutError;
      sendJson(response, timedOut ? 504 : 502, timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_PROVIDER_ERROR");
    }
  };
}

export default createExtractReservationHandler({
  env: process.env,
  createReader: createTypeSafeConfirmationReader,
  lookupMember: createSupabaseMemberLookup(process.env),
  guard: createDefaultRouteGuard("EXTRACT_RESERVATION", process.env),
});
