import { describe, expect, it } from "vitest";
import { createTrip } from "../../src/domain/workspace/tripForm";
import { addTrip, emptyTripLibrary } from "../../src/domain/workspace/library";
import { parseNotebook } from "../src/data/model";
import { createModeStore, parseMode } from "../src/data/travelMode";

function memoryKV() {
  const data = new Map<string, string>();
  return {
    data,
    get: async (key: string) => data.get(key) ?? null,
    set: async (key: string, value: string) => void data.set(key, value),
    remove: async (key: string) => void data.delete(key),
  };
}

describe("legacy travel mode settings", () => {
  it("reads only known values", () => {
    expect(parseMode("j")).toBe("j");
    expect(parseMode("p")).toBe("p");
    expect(parseMode("x")).toBeNull();
    expect(parseMode(null)).toBeNull();
  });

  it("forgets only the deleted trip and keeps the rest of the saved settings", async () => {
    const kv = memoryKV();
    kv.data.set("mode:default", "p");
    kv.data.set("mode:quiz", "1");
    kv.data.set("mode:trip:a", "j");
    kv.data.set("mode:trip:b", "p");
    const store = createModeStore(kv);
    await store.forgetTrip("b");
    expect(await store.tripMode("a")).toBe("j");
    expect(await store.tripMode("b")).toBeNull();
    expect([...kv.data.keys()].sort()).toEqual(["mode:default", "mode:quiz", "mode:trip:a"]);
  });

  it("keeps the mode out of the synced notebook, so old app versions still accept it", () => {
    // 수첩(동기화·백업) 데이터의 맨 위 칸과 여행 설정 칸은 모르는 키를 거부한다.
    const trip = createTrip({ title: "Lisbon", startDate: "2026-11-01", endDate: "2026-11-03", timeZone: "Europe/Lisbon", baseCurrency: "KRW", members: [{ name: "Me" }], coverColor: "ink" }, { id: "t1", now: new Date("2026-10-30T00:00:00Z") });
    const ok = { version: 1, library: addTrip(emptyTripLibrary(), trip), pages: [] };
    expect(() => parseNotebook(JSON.stringify(ok))).not.toThrow();
    expect(() => parseNotebook(JSON.stringify({ ...ok, travelMode: "p" }))).toThrow();
  });
});
