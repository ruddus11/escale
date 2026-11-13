import { describe, expect, it, vi } from "vitest";
import { browsePlaces, browsePlaceToPage, stayOptions } from "../src/data/placeBrowse";
import type { Reservation } from "../../src/domain/reservations/types";

const place = { placeId: "ChIJ0000000000", name: "Real café", address: "Seoul", type: "Café", rating: 4.4, reviews: 27, photo: { uri: "https://lh3.googleusercontent.com/photo", authors: ["Photographer"] } };
describe("place browse client", () => {
  const call = { baseUrl: "https://example.test", credential: "login", lang: "en-GB" as const, destination: "Seoul", category: "cafe" as const };
  it("blocks missing destination or login before making a request", async () => {
    const fetchImpl = vi.fn();
    await expect(browsePlaces({ ...call, credential: "", fetchImpl })).rejects.toThrow();
    await expect(browsePlaces({ ...call, destination: " ", fetchImpl })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("sends the selected category and translates regional English", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ places: [place, { name: "invalid" }] }));
    expect(await browsePlaces({ ...call, fetchImpl })).toEqual([place]);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ destination: "Seoul", category: "cafe", language: "en" });
  });
  it("keeps up to ten places", async () => {
    const places = Array.from({ length: 12 }, (_, i) => ({ ...place, placeId: `ChIJplace${String(i).padStart(2, "0")}` }));
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ places }));
    expect(await browsePlaces({ ...call, fetchImpl })).toHaveLength(10);
  });
  it("sends the stay point only when browsing near a stay, rounded to about 100 m", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ places: [] }));
    await browsePlaces({ ...call, near: { latitude: 35.6894871, longitude: 139.6917112 }, fetchImpl });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ destination: "Seoul", category: "cafe", language: "en", near: { latitude: 35.689, longitude: 139.692 } });
  });
  it("saves only the editable notebook fields, not transient Google content", () => {
    expect(browsePlaceToPage(place, "trip", "page", "2026-10-16")).toEqual({ id: "page", tripId: "trip", kind: "place", title: place.name, address: "Seoul", placeId: place.placeId, date: "2026-10-16", body: "", done: false });
  });
  it("distinguishes failed responses from an empty category", async () => {
    await expect(browsePlaces({ ...call, fetchImpl: vi.fn().mockResolvedValue(Response.json({ places: [] })) })).resolves.toEqual([]);
    await expect(browsePlaces({ ...call, fetchImpl: vi.fn().mockResolvedValue(Response.json({ code: "failure" }, { status: 502 })) })).rejects.toThrow();
    await expect(browsePlaces({ ...call, fetchImpl: vi.fn().mockResolvedValue(Response.json({ places: "bad" })) })).rejects.toThrow();
  });
  it("reports an undeployed endpoint as unavailable, rather than a failed place search", async () => {
    await expect(browsePlaces({ ...call, fetchImpl: vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 })) })).rejects.toMatchObject({ key: "place.noServer" });
  });
  it("shows quota and service pauses separately without a payment error", async () => {
    for (const [status, code, key] of [[429, "SEARCH_QUOTA_EXCEEDED", "browse.quota"], [429, "SEARCH_BUSY", "browse.rate"], [503, "SEARCH_PAUSED", "browse.paused"], [503, "SEARCH_USAGE_UNAVAILABLE", "place.noServer"]] as const) {
      await expect(browsePlaces({ ...call, fetchImpl: vi.fn().mockResolvedValue(Response.json({ code }, { status })) })).rejects.toMatchObject({ key });
    }
  });
  it("passes valid remaining usage to the screen without changing saved place data", async () => {
    const usage = { tier: "free", limit: 5, remaining: 4, resetsAt: "2026-11-01T00:00:00Z" };
    const onUsage = vi.fn();
    await browsePlaces({ ...call, onUsage, fetchImpl: vi.fn().mockResolvedValue(Response.json({ places: [place], usage })) });
    expect(onUsage).toHaveBeenCalledWith(usage);
  });
});

describe("stays to browse around", () => {
  const stay = (id: string, title: string, startDate: string, endDate: string, address?: string): Reservation => ({
    id, kind: "stay", title, startDate, endDate, timeZone: "Asia/Tokyo", updatedAt: "2026-10-16T00:00:00.000Z", ...(address ? { address } : {}),
  });
  const flight: Reservation = { id: "f", kind: "flight", title: "RF392", startDate: "2027-01-04", timeZone: "Asia/Seoul", updatedAt: "2026-10-16T00:00:00.000Z" };

  it("lists stays by date, puts tonight's stay first and skips other bookings", () => {
    const list = [stay("b", "Hotel B", "2027-01-07", "2027-01-10", "Ginza 1-1"), flight, stay("a", "Hotel A", "2027-01-04", "2027-01-07", "Shinjuku 2-2")];
    expect(stayOptions(list, "Tokyo", "2026-12-01").map((s) => s.id)).toEqual(["a", "b"]);
    expect(stayOptions(list, "Tokyo", "2027-01-08").map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("finds a stay without an address by its name and the destination, once per place", () => {
    const list = [stay("a", "Hotel A", "2027-01-04", "2027-01-05"), stay("a2", "Hotel A", "2027-01-06", "2027-01-07")];
    expect(stayOptions(list, "Tokyo", "2026-12-01")).toEqual([{ id: "a", title: "Hotel A", query: "Hotel A Tokyo" }]);
    expect(stayOptions(undefined, "Tokyo", "2026-12-01")).toEqual([]);
  });
});
