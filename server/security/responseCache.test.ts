import { describe, expect, it, vi } from "vitest";
import { createResponseCache, isCacheOff, normalizeText } from "./responseCache";

function fakeClock() {
  return { at: 0, now() { return this.at; } };
}

describe("response cache", () => {
  it("answers repeated requests from memory until the TTL ends", async () => {
    const clock = fakeClock();
    const cache = createResponseCache<string>({ ttlMs: 1_000, clock });
    let calls = 0;
    const load = async () => `result ${++calls}`;
    expect(cache.peek("k")).toBeUndefined();
    expect(await cache.remember("k", load)).toBe("result 1");
    expect(await cache.peek("k")).toBe("result 1");
    clock.at = 999;
    expect(await cache.peek("k")).toBe("result 1");
    clock.at = 1_000;
    expect(cache.peek("k")).toBeUndefined();
    expect(await cache.remember("k", load)).toBe("result 2");
  });

  it("uses a per-entry TTL when given", async () => {
    const clock = fakeClock();
    const cache = createResponseCache<string>({ ttlMs: 1_000, clock });
    await cache.remember("long", async () => "x", 5_000);
    clock.at = 4_000;
    expect(await cache.peek("long")).toBe("x");
  });

  it("shares one upstream call between simultaneous identical requests", async () => {
    const cache = createResponseCache<number>({ ttlMs: 1_000, clock: fakeClock() });
    let calls = 0;
    let finish!: (value: number) => void;
    const load = () => (calls++, new Promise<number>((resolve) => (finish = resolve)));
    const first = cache.remember("k", load);
    const waiting = cache.peek("k");
    const second = cache.remember("k", load);
    finish(7);
    expect(await Promise.all([first, waiting, second])).toEqual([7, 7, 7]);
    expect(calls).toBe(1);
    expect(await cache.remember("k", load)).toBe(7);
    expect(calls).toBe(1);
  });

  it("does not remember failures", async () => {
    const cache = createResponseCache<string>({ ttlMs: 1_000, clock: fakeClock() });
    await expect(cache.remember("k", async () => Promise.reject(new Error("upstream")))).rejects.toThrow("upstream");
    expect(cache.peek("k")).toBeUndefined();
    expect(await cache.remember("k", async () => "ok")).toBe("ok");
  });

  it("drops the oldest entry when full", async () => {
    const cache = createResponseCache<string>({ ttlMs: 1_000, maxEntries: 2, clock: fakeClock() });
    for (const key of ["a", "b", "c"]) await cache.remember(key, async () => key);
    expect(cache.peek("a")).toBeUndefined();
    expect(await cache.peek("c")).toBe("c");
  });

  it("removes expired entries when it stores the next one", async () => {
    const clock = fakeClock();
    const cache = createResponseCache<string>({ ttlMs: 1_000, maxEntries: 2, clock });
    await cache.remember("long", async () => "long", 5_000);
    await cache.remember("short", async () => "short", 100);
    clock.at = 200;
    // 만료된 "short"를 먼저 지우므로, 가득 차도 가장 오래됐지만 아직 유효한 "long"은 밀려나지 않는다.
    await cache.remember("new", async () => "new");
    expect(await cache.peek("long")).toBe("long");
    expect(await cache.peek("new")).toBe("new");
  });

  it("deletes an idle entry on time without deleting its replacement", async () => {
    vi.useFakeTimers();
    try {
      const clock = fakeClock();
      const cache = createResponseCache<string>({ ttlMs: 1_000, clock });
      await cache.remember("k", async () => "old");
      await vi.advanceTimersByTimeAsync(500);
      clock.at = 1_000;
      await cache.remember("k", async () => "new");
      await vi.advanceTimersByTimeAsync(500);
      expect(await cache.peek("k")).toBe("new");
      await vi.advanceTimersByTimeAsync(500);
      expect(cache.peek("k")).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("can be switched off", async () => {
    const cache = createResponseCache<number>({ ttlMs: 1_000, clock: fakeClock(), disabled: isCacheOff({ API_CACHE_OFF: "1" }) });
    let calls = 0;
    await cache.remember("k", async () => ++calls);
    await cache.remember("k", async () => ++calls);
    expect(calls).toBe(2);
    expect(isCacheOff({})).toBe(false);
  });

  it("treats spacing, case and full-width variants as the same query", () => {
    expect(normalizeText("  Tokyo   Station ")).toBe(normalizeText("tokyo station"));
    expect(normalizeText("ＴＯＫＹＯ")).toBe("tokyo");
    expect(normalizeText("서울역")).toBe("서울역");
  });
});
