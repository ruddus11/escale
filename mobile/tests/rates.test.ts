import { describe, expect, it } from "vitest";
import { canFetchRate, fetchRate, toRateText } from "../src/data/rates";

const fake = (body: unknown, ok = true) => {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(url);
    return { ok, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
};

describe("rates", () => {
  it("writes rates in the stored format", () => {
    expect(toRateText(1500.81)).toBe("1500.81");
    expect(toRateText(0.11788)).toBe("0.11788");
    expect(toRateText(0.000666334)).toBe("0.000666334");
    expect(toRateText(1234567.8)).toBeUndefined();
    expect(toRateText(0)).toBeUndefined();
  });

  it("fetches today's rate once and keeps it for a while", async () => {
    const { impl, calls } = fake({ date: "2026-10-13", rates: { KRW: 1500.81 } });
    expect(await fetchRate("EUR", "KRW", impl, 1000)).toEqual({ rate: "1500.81", date: "2026-10-13" });
    expect(await fetchRate("EUR", "KRW", impl, 2000)).toEqual({ rate: "1500.81", date: "2026-10-13" });
    expect(calls).toEqual(["https://api.frankfurter.dev/v1/latest?from=EUR&to=KRW"]);
  });

  it("leaves unsupported or failed lookups to the user", async () => {
    expect(canFetchRate("TWD", "KRW")).toBe(false);
    expect(await fetchRate("VND", "KRW", fake({}).impl)).toBeUndefined();
    expect(await fetchRate("USD", "KRW", fake({}, false).impl)).toBeUndefined();
    expect(await fetchRate("GBP", "KRW", fake({ date: "2026-10-13", rates: { KRW: "x" } }).impl)).toBeUndefined();
  });
});
