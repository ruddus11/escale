import { describe, expect, it } from "vitest";
import { createBrowserTripRepository } from "./browserTripRepository";
import { createTrip } from "../domain/workspace/tripForm";
import { createTripLibrary } from "../domain/workspace/library";
import { parseTripLibrary } from "./tripRepository";

const now = new Date("2026-10-08T00:00:00Z");
function library() {
  return createTripLibrary(createTrip({ title: "여행", startDate: "2026-10-08", endDate: "2026-10-11", baseCurrency: "KRW", members: [{ name: "나" }], coverColor: "ink", reservations: [{ id: "stay", kind: "stay", title: "숙소", startDate: "2026-10-08", timeZone: "Asia/Seoul", updatedAt: now.toISOString() }] }, { id: "trip", now }));
}

describe("예약 저장과 백업 호환", () => {
  it("브라우저 저장소와 JSON 왕복에도 예약이 보존된다", async () => {
    const data = new Map<string, string>();
    const storage: Storage = { get length() { return data.size; }, key: index => [...data.keys()][index] ?? null, clear: () => data.clear(), getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: key => { data.delete(key); } };
    const repo = createBrowserTripRepository({ storage });
    await repo.save(library());
    const reloaded = await createBrowserTripRepository({ storage }).load();
    expect(reloaded?.trips[0]?.reservations).toEqual(library().trips[0]?.reservations);
    expect(repo.importJson(repo.exportJson(reloaded!))).toEqual(reloaded);
  });
  it("기존 예약 없는 수첩을 받아들이고, 비밀정보 키가 든 가져오기는 거부한다", () => {
    const legacy = library(); delete legacy.trips[0]!.reservations;
    expect(parseTripLibrary(legacy)).toEqual(legacy);
    for (const extra of [{ confirmationNumber: "SECRET" }, { sourceUrl: "https://example.com/private/SECRET" }]) {
      const unsafe = library(); Object.assign(unsafe.trips[0]!.reservations![0]!, extra);
      expect(() => parseTripLibrary(unsafe)).toThrow();
    }
    const duplicate = library(); duplicate.trips[0]!.reservations!.push(duplicate.trips[0]!.reservations![0]!);
    expect(() => parseTripLibrary(duplicate)).toThrow();
  });
});
