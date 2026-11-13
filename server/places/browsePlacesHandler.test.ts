import type { VercelRequest, VercelResponse } from "@vercel/node";
import { describe, expect, it, vi } from "vitest";
import { createBrowsePlacesHandler } from "../../api/browse-places";
import { PlacesServiceError } from "./googlePlacesClient";
import type { PlaceUsage } from "../security/placeUsage";

const input = { destination: "Seoul", category: "cafe", language: "ko" };
const ID = "11111111-1111-4111-8111-111111111111";
const allowance = { allowed: true as const, tier: "free" as const, limit: 5, remaining: 4, resetsAt: "2026-11-01T00:00:00Z" };
const makeUsage = (): PlaceUsage => ({ reserve: vi.fn().mockResolvedValue(allowance), finish: vi.fn().mockResolvedValue(undefined) });
async function call(body: unknown, auth = "Bearer member", browser = vi.fn().mockResolvedValue([]), method = "POST", usage: PlaceUsage | null = makeUsage(), adminIds = "") {
  const result: { status?: number; body?: unknown; headers: Record<string, string> } = { headers: {} };
  const response = { setHeader: (key: string, value: string) => { result.headers[key] = value; }, status: (code: number) => { result.status = code; return response; }, json: (payload: unknown) => { result.body = payload; return response; } } as unknown as VercelResponse;
  const handler = createBrowsePlacesHandler({ env: { GOOGLE_MAPS_API_KEY: "secret", ADMIN_USER_IDS: adminIds }, lookupUser: async token => token === "member" ? ID : null, createBrowser: () => browser, usage });
  await handler({ method, body, headers: { authorization: auth } } as VercelRequest, response);
  return result;
}
describe("browse endpoint", () => {
  it("allows ordinary signed-in users without checking premium and never caches results", async () => {
    const result = await call(input);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ places: [], usage: { tier: "free", limit: 5, remaining: 4, resetsAt: allowance.resetsAt } });
    expect(result.headers["Cache-Control"]).toContain("no-store");
  });
  it("rejects unauthenticated requests before calling Google", async () => {
    const browser = vi.fn();
    expect((await call(input, "Bearer invalid", browser)).status).toBe(401);
    expect(browser).not.toHaveBeenCalled();
  });
  it("rejects unknown categories, oversized destinations and extra payload fields", async () => {
    for (const body of [{ ...input, category: "__proto__" }, { ...input, destination: " " }, { ...input, destination: "x".repeat(121) }, { ...input, language: "fr" }, { ...input, language: ["ko"] }, { ...input, prompt: "anything" }]) {
      const browser = vi.fn();
      expect((await call(body, "Bearer member", browser)).status).toBe(400);
      expect(browser).not.toHaveBeenCalled();
    }
  });
  it("passes a rounded stay point to the browser and rejects malformed points", async () => {
    const browser = vi.fn().mockResolvedValue([]);
    expect((await call({ ...input, near: { latitude: 35.6894871, longitude: 139.6917112 } }, "Bearer member", browser)).status).toBe(200);
    expect(browser).toHaveBeenCalledWith({ destination: "Seoul", category: "cafe", language: "ko", near: { latitude: 35.689, longitude: 139.692 } });
    for (const near of [{ latitude: 91, longitude: 0 }, { latitude: 0 }, { latitude: "35", longitude: 139 }, { latitude: 35, longitude: 139, label: "hotel" }, [35, 139], null]) {
      const rejected = vi.fn();
      expect((await call({ ...input, near }, "Bearer member", rejected)).status).toBe(400);
      expect(rejected).not.toHaveBeenCalled();
    }
  });
  it("reports timeouts and rejects non-POST methods", async () => {
    expect((await call(input, "Bearer member", vi.fn().mockRejectedValue(new PlacesServiceError("UPSTREAM_TIMEOUT")))).status).toBe(504);
    expect((await call(input, "Bearer member", vi.fn(), "GET")).status).toBe(405);
  });
  it("uses only the verified account ID for the admin exemption", async () => {
    const usage = makeUsage();
    await call(input, "Bearer member", vi.fn().mockResolvedValue([]), "POST", usage, ID);
    expect(usage.reserve).toHaveBeenCalledWith(ID, true, expect.any(String));
    const regular = makeUsage();
    await call(input, "Bearer member", vi.fn().mockResolvedValue([]), "POST", regular, "22222222-2222-4222-8222-222222222222");
    expect(regular.reserve).toHaveBeenCalledWith(ID, false, expect.any(String));
    expect((await call({ ...input, isAdmin: true })).status).toBe(400);
  });
  it("blocks Google on exhausted quotas or an unavailable usage store", async () => {
    for (const usage of [null, { ...makeUsage(), reserve: vi.fn().mockRejectedValue(new Error("database")) }, { ...makeUsage(), reserve: vi.fn().mockResolvedValue({ allowed: false, code: "SEARCH_QUOTA_EXCEEDED", retryAfter: 3600 }) }]) {
      const browser = vi.fn();
      const response = await call(input, "Bearer member", browser, "POST", usage);
      expect([429, 503]).toContain(response.status);
      expect(browser).not.toHaveBeenCalled();
    }
  });
  it("settles success once and refunds personal usage on upstream failure", async () => {
    const success = makeUsage();
    await call(input, "Bearer member", vi.fn().mockResolvedValue([]), "POST", success);
    expect(success.finish).toHaveBeenCalledWith(expect.any(String), true);
    const failed = makeUsage();
    await call(input, "Bearer member", vi.fn().mockRejectedValue(new Error("Google")), "POST", failed);
    expect(failed.finish).toHaveBeenCalledWith(expect.any(String), false);
  });
  it("keeps successful results when final settlement fails, retaining the reservation", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const usage = { ...makeUsage(), finish: vi.fn().mockRejectedValue(new Error("database")) };
      expect((await call(input, "Bearer member", vi.fn().mockResolvedValue([]), "POST", usage)).status).toBe(200);
      expect(usage.finish).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledWith("PLACE_SEARCH_SETTLEMENT_FAILED", expect.any(String));
    } finally { log.mockRestore(); }
  });
  it("returns Retry-After and blocks even admins on a service-wide pause", async () => {
    const browser = vi.fn();
    const usage = { ...makeUsage(), reserve: vi.fn().mockResolvedValue({ allowed: false, code: "SEARCH_PAUSED", retryAfter: 60 }) };
    const result = await call(input, "Bearer member", browser, "POST", usage, ID);
    expect(result.status).toBe(503);
    expect(result.headers["Retry-After"]).toBe("60");
    expect(browser).not.toHaveBeenCalled();
  });
  it("does not grant an unlimited identity-less bypass to a personal access code", async () => {
    const response = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as VercelResponse;
    const browser = vi.fn();
    const usage = makeUsage();
    const token = "x".repeat(24);
    const handler = createBrowsePlacesHandler({ env: { GOOGLE_MAPS_API_KEY: "secret", TRANSIT_ACCESS_TOKEN: token }, createBrowser: () => browser, usage });
    await handler({ method: "POST", body: input, headers: { authorization: `Bearer ${token}` } } as VercelRequest, response);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(usage.reserve).not.toHaveBeenCalled();
    expect(browser).not.toHaveBeenCalled();
  });
  it("accepts recommendation candidates only around a point", async () => {
    const browser = vi.fn().mockResolvedValue([]);
    expect((await call({ ...input, category: "picks" }, "Bearer member", browser)).status).toBe(400);
    expect(browser).not.toHaveBeenCalled();
    const usage = makeUsage();
    expect((await call({ ...input, category: "picks", near: { latitude: 34.6687, longitude: 135.5013 } }, "Bearer member", browser, "POST", usage)).status).toBe(200);
    expect(browser).toHaveBeenCalledWith({ destination: "Seoul", category: "picks", language: "ko", near: { latitude: 34.669, longitude: 135.501 } });
    expect(usage.reserve).toHaveBeenCalledOnce();
  });
});
