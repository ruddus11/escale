import { describe, expect, it } from "vitest";
import { requestPouchJudgment } from "../src/data/pouchJudge";
import { packTitleOf, spendIn } from "../src/data/pouchIntents";

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok: status < 400, status, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("requestPouchJudgment", () => {
  it("sends the line with the packing list and keeps a valid answer", async () => {
    const { impl, calls } = fakeFetch(200, { intent: "packed", confidence: 0.9, category: "other", itemId: "p1" });
    const judgment = await requestPouchJudgment({ baseUrl: "https://pouch.example/", accessCode: " code ", text: " 배터리 넣었어 ", items: [{ id: "p1", title: "보조배터리" }], fetchImpl: impl });
    expect(judgment).toEqual({ intent: "packed", confidence: 0.9, category: "other", itemId: "p1" });
    expect(calls[0].url).toBe("https://pouch.example/api/read-pouch");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer code");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ text: "배터리 넣었어", items: [{ id: "p1", title: "보조배터리" }] });
  });

  it("hides phone numbers before sending", async () => {
    const { impl, calls } = fakeFetch(200, { intent: "other", confidence: 0.4, category: "other" });
    await requestPouchJudgment({ baseUrl: "https://pouch.example", accessCode: "code", text: "호텔 010-1234-5678 로 전화", items: [], fetchImpl: impl });
    expect(calls[0].init.body as string).not.toContain("010-1234-5678");
  });

  it("explains server answers and drops malformed ones", async () => {
    await expect(requestPouchJudgment({ baseUrl: "https://pouch.example", accessCode: "x", text: "안녕", items: [], fetchImpl: fakeFetch(402, {}).impl })).rejects.toMatchObject({ key: "import.notPaid" });
    await expect(requestPouchJudgment({ baseUrl: "https://pouch.example", accessCode: "x", text: "안녕", items: [], fetchImpl: fakeFetch(200, { intent: "launch", confidence: 2 }).impl })).rejects.toMatchObject({ key: "import.failed" });
    await expect(requestPouchJudgment({ baseUrl: "", accessCode: "x", text: "안녕", items: [], fetchImpl: fakeFetch(200, {}).impl })).rejects.toMatchObject({ key: "auth.noServer" });
  });
});

describe("values the app reads itself", () => {
  it("pulls the amount out of a line Jev called an expense", () => {
    expect(spendIn("어제 먹은 나타 4.5", "EUR")).toMatchObject({ amount: 450, currency: "EUR", title: "어제 먹은 나타" });
    expect(spendIn("점심 맛있었다", "EUR")).toBeUndefined();
  });

  it("keeps only the thing to pack", () => {
    expect(packTitleOf("선크림도 꼭 챙겨야 해")).toBe("선크림");
    expect(packTitleOf("add sunscreen")).toBe("sunscreen");
  });
});
