import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TIMEOUT_MS, FetchTimeoutError, fetchWithTimeout } from "../src/data/fetchWithTimeout";
import { requestExtraction } from "../src/data/confirmationImport";
import { requestPouchJudgment } from "../src/data/pouchJudge";
import { findPlace } from "../src/data/places";
import { fetchRate } from "../src/data/rates";

// 응답하지 않는 서버. signal로 끊으면 실제 fetch처럼 AbortError로 끝난다.
function hanging(seen?: { signal?: AbortSignal }) {
  return vi.fn((_url: string, init?: RequestInit) => {
    if (seen) seen.signal = init?.signal ?? undefined;
    return new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });
  }) as unknown as typeof fetch;
}

// signal을 무시하는 구현. 경주가 없으면 영영 끝나지 않는다.
const deaf = (() => new Promise<Response>(() => undefined)) as unknown as typeof fetch;

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchWithTimeout", () => {
  it("defaults to 15 seconds", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(15_000);
  });

  it("returns the response and passes the request through", async () => {
    const impl = vi.fn().mockResolvedValue(new Response("ok"));
    const response = await fetchWithTimeout("https://x.example/a", { method: "POST", body: "b" }, { fetchImpl: impl });
    expect(await response.text()).toBe("ok");
    expect(impl.mock.calls[0][0]).toBe("https://x.example/a");
    expect(impl.mock.calls[0][1]).toMatchObject({ method: "POST", body: "b" });
    expect(impl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("aborts the request and throws FetchTimeoutError after the default time", async () => {
    vi.useFakeTimers();
    const seen: { signal?: AbortSignal } = {};
    const pending = fetchWithTimeout("https://x.example", {}, { fetchImpl: hanging(seen) });
    const check = expect(pending).rejects.toBeInstanceOf(FetchTimeoutError);
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS - 1);
    expect(seen.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await check;
    expect(seen.signal?.aborted).toBe(true);
  });

  it("honours a custom timeout even when the fetch ignores the signal", async () => {
    vi.useFakeTimers();
    const pending = fetchWithTimeout("https://x.example", {}, { fetchImpl: deaf, timeoutMs: 500 });
    const check = expect(pending).rejects.toMatchObject({ name: "FetchTimeoutError", timeoutMs: 500 });
    await vi.advanceTimersByTimeAsync(500);
    await check;
  });

  it("keeps a caller cancel distinct from a timeout", async () => {
    const outer = new AbortController();
    const pending = fetchWithTimeout("https://x.example", { signal: outer.signal }, { fetchImpl: hanging() });
    outer.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("passes network errors through unchanged", async () => {
    const impl = vi.fn().mockRejectedValue(new TypeError("Network request failed"));
    await expect(fetchWithTimeout("https://x.example", {}, { fetchImpl: impl })).rejects.toBeInstanceOf(TypeError);
  });
});

describe("callers turn a timeout into their slow message", () => {
  async function timeOut<T>(run: () => Promise<T>, ms: number) {
    vi.useFakeTimers();
    const pending = run();
    const settled = pending.then(() => ({ ok: true as const }), (error: unknown) => ({ ok: false as const, error }));
    await vi.advanceTimersByTimeAsync(ms);
    return settled;
  }

  it("reservation import ends with import.slow after 30 seconds", async () => {
    const result = await timeOut(() => requestExtraction({ baseUrl: "https://pouch.example", accessCode: "code", text: "KE 123", year: 2026, fetchImpl: hanging() }), 30_000);
    expect(result).toMatchObject({ ok: false, error: { key: "import.slow" } });
  });

  it("pouch judgment ends with import.slow", async () => {
    const result = await timeOut(() => requestPouchJudgment({ baseUrl: "https://pouch.example", accessCode: "code", text: "배터리", items: [], fetchImpl: hanging() }), 20_000);
    expect(result).toMatchObject({ ok: false, error: { key: "import.slow" } });
  });

  it("place lookup ends with place.slow", async () => {
    const result = await timeOut(() => findPlace({ baseUrl: "https://pouch.example", credential: "t", lang: "en-US" as const, text: "x", fetchImpl: hanging() }), DEFAULT_TIMEOUT_MS);
    expect(result).toMatchObject({ ok: false, error: { key: "place.slow" } });
  });

  it("live rate falls back to manual entry", async () => {
    const result = await timeOut(() => fetchRate("KRW", "JPY", hanging(), 0), DEFAULT_TIMEOUT_MS);
    expect(result).toEqual({ ok: true });
  });
});
