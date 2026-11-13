import { describe, it, expect } from "vitest";
import {
  cachedRequest,
  parseRate,
} from "../src/data/travelToday";
import { nearestOrder, reconcileOrder, moveItem } from "../src/data/dayRoute";
import { parseDayPhotos } from "../src/data/photoDays";

describe("today essentials", () => {
  it("validates rates with dates", () => {
    expect(parseRate({ date: "2026-11-12", rates: { KRW: 9.2 } })).toEqual({
      date: "2026-11-12",
      rate: 9.2,
    });
    expect(parseRate({ date: "yesterday", rates: { KRW: -2 } })).toBeNull();
  });
  it("keeps last successful rate offline, including failed cache writes", async () => {
    const prior = { date: "2026-11-10", rate: 9 };
    expect(
      await cachedRequest(
        prior,
        async () => {
          throw Error("offline");
        },
        async () => {},
      ),
    ).toEqual({ value: prior, cached: true });
    expect(
      await cachedRequest(
        null,
        async () => {
          throw Error("offline");
        },
        async () => {},
      ),
    ).toEqual({ value: null, cached: true });
    const fresh = { date: "2026-11-12", rate: 9.2 };
    expect(
      await cachedRequest(
        prior,
        async () => fresh,
        async () => {
          throw Error("disk");
        },
      ),
    ).toEqual({ value: fresh, cached: false });
  });
});
describe("day routes", () => {
  const points = [
    { id: "a", latitude: 35, longitude: 135 },
    { id: "b", latitude: 35.02, longitude: 135 },
    { id: "c", latitude: 35.001, longitude: 135 },
  ];
  it("anchors the first stop, then visits the nearest remaining stop", () =>
    expect(nearestOrder(points)).toEqual(["a", "c", "b"]));
  it("can start at lodging, handles ties and empty days", () => {
    expect(nearestOrder(points, points[1])).toEqual(["b", "c", "a"]);
    expect(nearestOrder([])).toEqual([]);
  });
  it("preserves surviving IDs and adds new stops without duplicates", () =>
    expect(reconcileOrder(["b", "gone", "b"], ["a", "b", "c"])).toEqual([
      "b",
      "a",
      "c",
    ]));
  it("moves a dragged row and preserves the original for undo", () => {
    const original = ["a", "b", "c"];
    expect(moveItem(original, 0, 2)).toEqual(["b", "c", "a"]);
    expect(original).toEqual(["a", "b", "c"]);
  });
});
