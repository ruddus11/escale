import type { VercelRequest, VercelResponse } from "@vercel/node";
import { describe, expect, it } from "vitest";
import { createExtractReservationHandler } from "../../api/extract-reservation";
import type { ConfirmationReader } from "./typesafeConfirmationReader";

const TOKEN = "s".repeat(24);
const ENV = { TRANSIT_ACCESS_TOKEN: TOKEN, TYPESAFE_API_KEY: "typesafe-key" };
const MAIL = "예약번호: A1B2C3 KE 123 2026년 11월 3일 인천 ICN 09:40 → 오사카 간사이 KIX 11:25";

async function call(overrides: { env?: Record<string, string | undefined>; body?: unknown; authorization?: string; reader?: ConfirmationReader }) {
  const capture: { status?: number; body?: unknown; seen?: string } = {};
  const response = {
    setHeader: () => response,
    status: (code: number) => ((capture.status = code), response),
    json: (body: unknown) => ((capture.body = body), response),
  } as unknown as VercelResponse;
  const handler = createExtractReservationHandler({
    env: overrides.env ?? ENV,
    guard: { admit: async () => ({ allowed: true }) },
    createReader: () =>
      overrides.reader ?? {
        async read(text) {
          capture.seen = text;
          return { kind: "flight", startDate: "d1", startTime: "t1", endTime: "t2", departure: "p1", arrival: "p2", service: "s1" };
        },
      },
  });
  await handler(
    { method: "POST", headers: { authorization: overrides.authorization ?? `Bearer ${TOKEN}` }, body: "body" in overrides ? overrides.body : { text: MAIL, year: 2026 } } as unknown as VercelRequest,
    response,
  );
  return capture;
}

describe("extract-reservation handler", () => {
  it("fills a flight from a pasted confirmation and never forwards the booking number", async () => {
    const result = await call({});
    expect(result.status).toBe(200);
    expect(result.seen).not.toContain("A1B2C3");
    expect(result.body).toEqual({
      reservation: {
        kind: "flight",
        title: "KE 123 인천 → 오사카 간사이",
        startDate: "2026-11-03",
        startTime: "09:40",
        endDate: "2026-11-03",
        endTime: "11:25",
        departure: "인천 ICN",
        arrival: "오사카 간사이 KIX",
        serviceNumber: "KE 123",
        timeZone: "Asia/Seoul",
        endTimeZone: "Asia/Tokyo",
      },
    });
  });

  it("skips the model when the text has nothing to pick", async () => {
    let called = false;
    const result = await call({ body: { text: "감사합니다", year: 2026 }, reader: { async read() { called = true; return {}; } } });
    expect(result).toMatchObject({ status: 200, body: { reservation: {} } });
    expect(called).toBe(false);
  });

  it("rejects requests without access and malformed bodies", async () => {
    expect((await call({ authorization: "Bearer nope" })).status).toBe(401);
    expect((await call({ body: { text: "", year: 2026 } })).status).toBe(400);
    expect((await call({ body: { text: MAIL } })).status).toBe(400);
    expect((await call({ body: { text: "x".repeat(6001), year: 2026 } })).status).toBe(400);
    expect((await call({ env: { ...ENV, TYPESAFE_API_KEY: "" } })).status).toBe(503);
  });

  it("reports model failures as upstream errors", async () => {
    const result = await call({ reader: { async read() { throw new Error("down"); } } });
    expect(result).toEqual({ status: 502, body: { code: "UPSTREAM_PROVIDER_ERROR" } });
  });
});
