import { describe, expect, it } from "vitest";
import { emptyPassport, setTripCompleted } from "../src/data/passport";
import { createPassportStore } from "../src/data/passportStore";

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return { get: async (_key: string) => value, set: async (_key: string, next: string) => { value = next; }, read: () => value };
}

describe("passport durable updates", () => {
  it("never writes before a successful load", async () => {
    const storage = memoryStorage();
    const store = createPassportStore(storage);
    await expect(store.update((state) => setTripCompleted(state, "trip", true))).rejects.toThrow();
    expect(storage.read()).toBeNull();
  });

  it("preserves existing records when loading fails and allows retry", async () => {
    const existing = setTripCompleted(emptyPassport(), "old", true);
    const storage = memoryStorage(JSON.stringify(existing));
    let fail = true;
    const store = createPassportStore({ ...storage, get: async (key) => { if (fail) throw new Error("read failed"); return storage.get(key); } });
    await expect(store.load()).rejects.toThrow("read failed");
    await expect(store.update(() => emptyPassport())).rejects.toThrow();
    expect(JSON.parse(storage.read()!)).toEqual(existing);
    fail = false;
    expect(await store.load()).toEqual(existing);
  });

  it("keeps its durable state after a failed write and retries without losing completion", async () => {
    const storage = memoryStorage();
    let fail = true;
    const store = createPassportStore({ ...storage, set: async (key, value) => { if (fail) throw new Error("write failed"); await storage.set(key, value); } });
    await store.load();
    await expect(store.update((state) => setTripCompleted(state, "a", true))).rejects.toThrow("write failed");
    fail = false;
    await store.update((state) => setTripCompleted(state, "b", true));
    expect(JSON.parse(storage.read()!).completed).toEqual(["b"]);
    await store.update((state) => setTripCompleted(state, "a", true));
    expect(JSON.parse(storage.read()!).completed).toEqual(["b", "a"]);
  });

  it("rejects overlapping writes and applies the next update to the latest saved state", async () => {
    const storage = memoryStorage();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const store = createPassportStore({ ...storage, set: async (key, value) => { await gate; await storage.set(key, value); } });
    await store.load();
    const first = store.update((state) => setTripCompleted(state, "a", true));
    await expect(store.update((state) => setTripCompleted(state, "b", true))).rejects.toThrow();
    release();
    await first;
    await store.update((state) => setTripCompleted(state, "b", true));
    expect(JSON.parse(storage.read()!).completed).toEqual(["a", "b"]);
  });
});
