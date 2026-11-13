import type { VercelApiHandler } from "@vercel/node";
import { APITimeoutError } from "@typesafe-ai/sdk";
import {
  checkPaidAccess,
  createSupabaseMemberLookup,
  type MemberLookup,
  type PaidAccessEnvironment,
} from "../server/security/paidAccess.js";
import { hasOnlyKeys, sendJson, setSafeResponseHeaders } from "../server/http/guards.js";
import { redactConfirmation } from "../src/domain/reservations/confirmation.js";
import { MAX_POUCH_ITEMS, MAX_POUCH_TEXT, type PouchItemRef } from "../src/domain/pouch/judgment.js";
import { createTypeSafePouchReader, type PouchReader } from "../server/pouch/typesafePouchReader.js";
import { clientIdentity, createDefaultRouteGuard, sendLimited, type RouteGuard } from "../server/security/costGuard.js";

interface ReadPouchEnvironment extends PaidAccessEnvironment {
  TYPESAFE_API_KEY?: string;
}

export interface ReadPouchHandlerDependencies {
  env: ReadPouchEnvironment;
  createReader: (apiKey: string) => PouchReader;
  lookupMember?: MemberLookup | null;
  guard: RouteGuard;
}

// 유료 기능. 여행 도구가 기기에서 읽지 못한 한 줄을 Jev로 판단한다.
// 원문은 저장하지 않고, 예약번호·연락처·카드번호는 보내기 전에 가린다.
export function createReadPouchHandler(dependencies: ReadPouchHandlerDependencies): VercelApiHandler {
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
    const body = parseBody(request.body);
    if (!body) {
      sendJson(response, 400, "INVALID_REQUEST");
      return;
    }
    const decision = await dependencies.guard.admit(clientIdentity(access.userId, request.headers));
    if (!decision.allowed) {
      sendLimited(response, decision);
      return;
    }
    try {
      const judgment = await dependencies.createReader(apiKey).read(redactConfirmation(body.text), body.items);
      response.status(200).json(judgment);
    } catch (error) {
      const timedOut = error instanceof APITimeoutError;
      sendJson(response, timedOut ? 504 : 502, timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_PROVIDER_ERROR");
    }
  };
}

function parseBody(body: unknown): { text: string; items: PouchItemRef[] } | null {
  if (!hasOnlyKeys(body, ["text", "items"], ["text", "items"]) || typeof body.text !== "string" || !Array.isArray(body.items)) return null;
  const text = body.text.trim();
  if (!text || text.length > MAX_POUCH_TEXT || body.items.length > MAX_POUCH_ITEMS) return null;
  const items: PouchItemRef[] = [];
  for (const item of body.items) {
    if (
      !hasOnlyKeys(item, ["id", "title"], ["id", "title"]) ||
      typeof item.id !== "string" ||
      typeof item.title !== "string" ||
      !item.id ||
      item.id.length > 120 ||
      !item.title.trim() ||
      item.title.length > 120
    )
      return null;
    items.push({ id: item.id, title: item.title.trim() });
  }
  return { text, items };
}

export default createReadPouchHandler({
  env: process.env,
  createReader: createTypeSafePouchReader,
  lookupMember: createSupabaseMemberLookup(process.env),
  guard: createDefaultRouteGuard("READ_POUCH", process.env),
});
