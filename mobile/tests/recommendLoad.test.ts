import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/data/sqlite", () => ({ todayStore: { get: vi.fn(), set: vi.fn() } }));

import { candidateKey, forgetCandidates, loadCandidates, rememberedCandidates, rememberedPlacePhoto } from "../src/data/recommendLoad";

const near = { latitude: 10.00012, longitude: 20.00049 };
const pick = { placeId: "ChIJpick000001", name: "Sample spot", address: "1 Test Street", type: "Museum", location: { latitude: 10.001, longitude: 20.001 }, primaryType: "museum", hours: [{ open: 0, close: 10080 }], priceLevel: 2 };
const call = (fetchImpl: typeof fetch, now = () => 0) => ({ baseUrl: "https://example.test", credential: "login", lang: "ko" as const, destination: "Sample City", tripId: "trip", near, fetchImpl, now });
const usage = { tier: "free", limit: 5, remaining: 4, resetsAt: "2030-07-01T00:00:00Z" };

describe("recommendation candidates", () => {
  beforeEach(() => forgetCandidates());

  it("reuses attributed place photos only within the session lifetime", async () => {
    const photo = { uri: "https://lh3.googleusercontent.com/places/abc", authors: ["Photographer"] };
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ places: [{ ...pick, photo }], usage }));
    await loadCandidates(call(fetchImpl));
    expect(rememberedPlacePhoto(pick.placeId, 100)).toEqual(photo);
    expect(rememberedPlacePhoto(pick.placeId, 6 * 60 * 60_000)).toBeUndefined();
    forgetCandidates();
    expect(rememberedPlacePhoto(pick.placeId, 100)).toBeUndefined();
  });

  it("asks once per notebook, language and rounded base point", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ places: [pick], usage }));
    const first = await loadCandidates(call(fetchImpl));
    expect(first).toEqual({ places: [pick], legacy: false });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ destination: "Sample City", category: "picks", language: "ko", near: { latitude: 10, longitude: 20 } });
    // 100m 안의 다른 기준점(다른 날 같은 숙소)은 다시 묻지 않는다.
    await loadCandidates({ ...call(fetchImpl), near: { latitude: 10.0002, longitude: 20.0001 } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(candidateKey("trip", "en-GB", near)).toBe("trip|en|10,20");
  });

  it("shares one request between simultaneous callers and asks again after six hours", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ places: [pick], usage }));
    let clock = 0;
    await Promise.all([loadCandidates(call(fetchImpl, () => clock)), loadCandidates(call(fetchImpl, () => clock))]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    clock = 6 * 60 * 60_000 + 1;
    fetchImpl.mockResolvedValue(Response.json({ places: [pick], usage }));
    await loadCandidates(call(fetchImpl, () => clock));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("falls back to two category searches on a server without picks", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json({ code: "INVALID_REQUEST" }, { status: 400 }))
      .mockResolvedValueOnce(Response.json({ places: [{ placeId: "ChIJfood000001", name: "Food", address: "", type: "Restaurant" }], usage }))
      .mockResolvedValueOnce(Response.json({ places: [{ placeId: "ChIJsight00001", name: "Sight", address: "", type: "Landmark" }], usage }));
    const result = await loadCandidates(call(fetchImpl));
    expect(result.legacy).toBe(true);
    expect(result.places.map((p) => [p.name, p.hint])).toEqual([["Food", "food"], ["Sight", "sights"]]);
    expect(fetchImpl.mock.calls.map(([, init]) => JSON.parse(init.body).category)).toEqual(["picks", "food", "sights"]);
  });

  it("shows the existing quota message on 429 and does not remember failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(Response.json({ code: "SEARCH_QUOTA_EXCEEDED" }, { status: 429 }));
    await expect(loadCandidates(call(fetchImpl))).rejects.toMatchObject({ key: "browse.quota" });
    fetchImpl.mockResolvedValueOnce(Response.json({ code: "SEARCH_RATE_LIMITED" }, { status: 429 }));
    await expect(loadCandidates(call(fetchImpl))).rejects.toMatchObject({ key: "browse.rate" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("allows a new search after an empty API result", async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => Response.json({ places: [], usage }));
    expect((await loadCandidates(call(fetchImpl))).places).toEqual([]);
    expect((await loadCandidates(call(fetchImpl))).places).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not restore a finished request to memory after logout clears it", async () => {
    let finish!: (response: Response) => void;
    const fetchImpl = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const pending = loadCandidates(call(fetchImpl));
    forgetCandidates();
    finish(Response.json({ places: [pick], usage }));
    await pending;
    expect(rememberedCandidates(candidateKey("trip", "ko", near), 0)).toBeUndefined();
  });

  it("drops malformed opening hours and locations from the server", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ places: [{ ...pick, hours: [{ open: -1, close: 5 }], location: { latitude: 200, longitude: 0 }, priceLevel: 9 }], usage }));
    const [place] = (await loadCandidates(call(fetchImpl))).places;
    expect(place.hours).toBeUndefined();
    expect(place.location).toBeUndefined();
    expect(place.priceLevel).toBeUndefined();
  });
});
