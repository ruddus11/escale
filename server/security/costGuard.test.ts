import type { VercelResponse } from "@vercel/node";
import { describe, expect, it, vi } from "vitest";
import {
  clientIdentity,
  createFallbackCounterStore,
  createMemoryCounterStore,
  createRouteGuard,
  ipBucket,
  parseHitResult,
  readPolicy,
  sendLimited,
  type CounterStore,
  type RoutePolicy,
} from "./costGuard";

// 2026-10-28 12:00:30 UTC. 분 창은 30초, 하루 창은 11시간 59분 30초 남았다.
const START = Date.UTC(2026, 9, 28, 12, 0, 30);

function fakeClock(at = START) {
  return { at, now() { return this.at; } };
}

function guardWith(policy: Partial<RoutePolicy> = {}, store: CounterStore = createMemoryCounterStore()) {
  const clock = fakeClock();
  const guard = createRouteGuard({ route: "PLACE", perMinute: 2, perDay: 5, globalPerDay: 8, ...policy }, store, clock);
  return { clock, guard };
}

describe("route guard", () => {
  it("limits one person per minute and reopens in the next minute", async () => {
    const { clock, guard } = guardWith();
    expect(await guard.admit("u:a")).toEqual({ allowed: true });
    expect(await guard.admit("u:a")).toEqual({ allowed: true });
    expect(await guard.admit("u:a")).toEqual({ allowed: false, code: "RATE_LIMITED", retryAfter: 30 });
    // 다른 사람은 따로 센다.
    expect(await guard.admit("u:b")).toEqual({ allowed: true });
    clock.at += 30_000;
    expect(await guard.admit("u:a")).toEqual({ allowed: true });
  });

  it("caps one person per UTC day and reports the wait until midnight", async () => {
    const { clock, guard } = guardWith({ perMinute: 100 });
    for (let i = 0; i < 5; i++) expect((await guard.admit("u:a")).allowed).toBe(true);
    expect(await guard.admit("u:a")).toEqual({ allowed: false, code: "DAILY_LIMIT_REACHED", retryAfter: 43_170 });
    clock.at = Date.UTC(2026, 9, 29, 0, 0, 0);
    expect((await guard.admit("u:a")).allowed).toBe(true);
  });

  it("stops everyone when the route's daily safety cap is reached", async () => {
    const { guard } = guardWith({ perMinute: 100, perDay: 100, globalPerDay: 3 });
    for (const id of ["u:a", "u:b", "ip:c"]) expect((await guard.admit(id)).allowed).toBe(true);
    expect(await guard.admit("u:new")).toMatchObject({ allowed: false, code: "SERVICE_LIMIT_REACHED" });
  });

  it("does not let rejected retries use up the shared daily cap", async () => {
    const { guard } = guardWith({ perMinute: 1, perDay: 100, globalPerDay: 3 });
    await guard.admit("u:abuser");
    for (let i = 0; i < 50; i++) expect((await guard.admit("u:abuser")).allowed).toBe(false);
    expect((await guard.admit("u:b")).allowed).toBe(true);
    expect((await guard.admit("u:c")).allowed).toBe(true);
  });

  it("reports the longest wait when several windows are full", async () => {
    const { guard } = guardWith({ perMinute: 1, perDay: 1 });
    await guard.admit("u:a");
    expect(await guard.admit("u:a")).toMatchObject({ code: "DAILY_LIMIT_REACHED", retryAfter: 43_170 });
  });

  it("treats a zero limit as an emergency stop", async () => {
    const { guard } = guardWith({ globalPerDay: 0 });
    expect(await guard.admit("u:a")).toMatchObject({ allowed: false, code: "SERVICE_LIMIT_REACHED" });
  });

  it("counts routes separately", async () => {
    const store = createMemoryCounterStore();
    const clock = fakeClock();
    const place = createRouteGuard({ route: "PLACE", perMinute: 1, perDay: 9, globalPerDay: 9 }, store, clock);
    const recommend = createRouteGuard({ route: "RECOMMEND_PLACES", perMinute: 1, perDay: 9, globalPerDay: 9 }, store, clock);
    expect((await place.admit("u:a")).allowed).toBe(true);
    expect((await recommend.admit("u:a")).allowed).toBe(true);
  });
});

describe("policy from environment", () => {
  it("uses safe defaults and accepts only whole numbers", () => {
    expect(readPolicy("RECOMMEND_PLACES", {})).toEqual({ route: "RECOMMEND_PLACES", perMinute: 3, perDay: 20, globalPerDay: 300 });
    expect(readPolicy("PLACE", { API_LIMIT_PLACE_GLOBAL_PER_DAY: " 2000 ", API_LIMIT_PLACE_PER_MINUTE: "0" })).toMatchObject({ perMinute: 0, globalPerDay: 2000 });
    for (const bad of ["-1", "1e9", "abc", "", "1.5", "9999999999"]) {
      expect(readPolicy("PLACE", { API_LIMIT_PLACE_PER_DAY: bad }).perDay, bad).toBe(400);
    }
  });
});

describe("client identity", () => {
  it("prefers the account and hashes IP addresses", () => {
    const user = clientIdentity("user-1", { "x-forwarded-for": "1.2.3.4" });
    expect(user).toMatch(/^u:[0-9a-f]{32}$/);
    expect(user).not.toContain("user-1");
    expect(clientIdentity("user-1", {})).toBe(user);
    expect(clientIdentity("user-2", {})).not.toBe(user);
    const ip = clientIdentity(null, { "x-forwarded-for": "1.2.3.4, 10.0.0.1" });
    expect(ip).toMatch(/^ip:[0-9a-f]{32}$/);
    expect(ip).not.toContain("1.2.3.4");
    expect(clientIdentity(null, { "x-vercel-forwarded-for": "1.2.3.4", "x-forwarded-for": "5.6.7.8" })).toBe(ip);
    expect(clientIdentity(null, { "x-real-ip": "1.2.3.4" })).toBe(clientIdentity(null, {}));
    expect(clientIdentity(null, { "x-forwarded-for": "5.6.7.8" })).not.toBe(ip);
  });

  it("groups an IPv6 subscriber's /64 so rotating addresses share a limit", () => {
    expect(ipBucket("2001:db8:1:2:aaaa::1")).toBe("2001:db8:1:2::/64");
    expect(ipBucket("2001:0db8:0001:0002:ffff:1:2:3")).toBe("2001:db8:1:2::/64");
    expect(ipBucket("[2001:db8::1]")).toBe("2001:db8:0:0::/64");
    expect(ipBucket("::ffff:1.2.3.4")).toBe("1.2.3.4");
    expect(ipBucket("1.2.3.4")).toBe("1.2.3.4");
  });
});

describe("shared counter store", () => {
  it("never reads a malformed database answer as allowed", () => {
    expect(parseHitResult({ allowed: true }, 3)).toEqual([]);
    expect(parseHitResult({ allowed: false, blocked: [2] }, 3)).toEqual([2]);
    for (const bad of [null, {}, { allowed: false }, { allowed: false, blocked: [] }, { allowed: false, blocked: [3] }, { allowed: "true" }]) {
      expect(() => parseHitResult(bad, 3)).toThrow();
    }
  });

  it("falls back to memory limits when the shared store fails, then retries it later", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const primary = { calls: 0, async hit() { this.calls++; throw new Error("down"); } };
    const store = createFallbackCounterStore(primary, createMemoryCounterStore(), 60_000);
    const { clock, guard } = guardWith({ perMinute: 1 }, store);
    expect((await guard.admit("u:a")).allowed).toBe(true);
    expect((await guard.admit("u:a")).allowed).toBe(false);
    expect(primary.calls).toBe(1);
    clock.at += 60_000;
    await guard.admit("u:a");
    expect(primary.calls).toBe(2);
    error.mockRestore();
  });
});

describe("429 response", () => {
  it("sends Retry-After and a short code the apps translate", () => {
    const headers: Record<string, string> = {};
    const sent: { status?: number; body?: unknown } = {};
    const response = {
      setHeader: (name: string, value: string) => ((headers[name] = value), response),
      status: (code: number) => ((sent.status = code), response),
      json: (body: unknown) => ((sent.body = body), response),
    } as unknown as VercelResponse;
    sendLimited(response, { allowed: false, code: "RATE_LIMITED", retryAfter: 12 });
    expect(headers["Retry-After"]).toBe("12");
    expect(sent).toEqual({ status: 429, body: { code: "RATE_LIMITED", retryAfter: 12, message: "Too many requests. Try again shortly." } });
  });
});
