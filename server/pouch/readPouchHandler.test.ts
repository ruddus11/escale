import type { VercelRequest, VercelResponse } from "@vercel/node";
import { APITimeoutError } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";
import { createReadPouchHandler } from "../../api/read-pouch";
import { toJudgment, type PouchReader } from "./typesafePouchReader";

const TOKEN = "s".repeat(24);
const ENV = { TRANSIT_ACCESS_TOKEN: TOKEN, TYPESAFE_API_KEY: "typesafe-key" };
const ITEMS = [
  { id: "p1", title: "우산" },
  { id: "p2", title: "보조배터리" },
];

async function call(overrides: { env?: Record<string, string | undefined>; body?: unknown; authorization?: string; reader?: PouchReader; method?: string }) {
  const capture: { status?: number; body?: unknown; seen?: { text: string; items: unknown } } = {};
  const response = {
    setHeader: () => response,
    status: (code: number) => ((capture.status = code), response),
    json: (body: unknown) => ((capture.body = body), response),
  } as unknown as VercelResponse;
  const handler = createReadPouchHandler({
    env: overrides.env ?? ENV,
    guard: { admit: async () => ({ allowed: true }) },
    createReader: () =>
      overrides.reader ?? {
        async read(text, items) {
          capture.seen = { text, items };
          return { intent: "packed", confidence: 0.92, category: "other", itemId: "p2" };
        },
      },
  });
  await handler(
    {
      method: overrides.method ?? "POST",
      headers: { authorization: overrides.authorization ?? `Bearer ${TOKEN}` },
      body: "body" in overrides ? overrides.body : { text: "배터리 가방에 넣어놨어", items: ITEMS },
    } as unknown as VercelRequest,
    response,
  );
  return capture;
}

describe("read-pouch handler", () => {
  it("returns the judgment for a line the device could not read", async () => {
    const result = await call({});
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ intent: "packed", confidence: 0.92, category: "other", itemId: "p2" });
    expect(result.seen?.items).toEqual(ITEMS);
  });

  it("hides card numbers and contacts before asking the model", async () => {
    const result = await call({ body: { text: "카드 4111 1111 1111 1111 으로 결제 010-1234-5678", items: [] } });
    expect(result.seen?.text).not.toContain("4111");
    expect(result.seen?.text).not.toContain("010-1234-5678");
  });

  it("needs paid access and a server key", async () => {
    expect((await call({ authorization: "Bearer wrong" })).status).toBe(401);
    expect(await call({ env: { TRANSIT_ACCESS_TOKEN: TOKEN } })).toMatchObject({ status: 503, body: { code: "SERVER_CONFIG_ERROR" } });
    expect((await call({ method: "GET" })).status).toBe(405);
  });

  it("rejects malformed or oversized input", async () => {
    for (const body of [
      { text: "", items: [] },
      { text: "가".repeat(201), items: [] },
      { text: "우산", items: [{ id: "p1" }] },
      { text: "우산", items: Array.from({ length: 51 }, (_, i) => ({ id: `p${i}`, title: "x" })) },
      { text: "우산", items: [], extra: true },
    ]) {
      expect((await call({ body })).status, JSON.stringify(body).slice(0, 40)).toBe(400);
    }
  });

  it("reports a slow or failing model", async () => {
    const slow: PouchReader = { read: async () => { throw new APITimeoutError(8000); } };
    const broken: PouchReader = { read: async () => { throw new Error("down"); } };
    expect(await call({ reader: slow })).toMatchObject({ status: 504, body: { code: "UPSTREAM_TIMEOUT" } });
    expect(await call({ reader: broken })).toMatchObject({ status: 502, body: { code: "UPSTREAM_PROVIDER_ERROR" } });
  });
});

describe("toJudgment", () => {
  const answer = (choice: string, confidence: number) => ({ choice, confidence });

  it("maps the item label back to its id only when the model is sure", () => {
    expect(toJudgment({ intent: answer("packed", 0.9), category: answer("other", 0.8), item: answer("i1", 0.7) }, ITEMS)).toEqual({ intent: "packed", confidence: 0.9, category: "other", itemId: "p2" });
    expect(toJudgment({ intent: answer("packed", 0.9), category: answer("other", 0.8), item: answer("i1", 0.4) }, ITEMS).itemId).toBeUndefined();
    expect(toJudgment({ intent: answer("packed", 0.9), category: answer("other", 0.8), item: answer("none", 0.9) }, ITEMS).itemId).toBeUndefined();
  });

  it("keeps the spending category for expenses", () => {
    expect(toJudgment({ intent: answer("expense", 0.81), category: answer("drink", 0.66) }, [])).toEqual({ intent: "expense", confidence: 0.81, category: "drink" });
  });
});
