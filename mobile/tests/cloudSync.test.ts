import { describe, expect, it } from "vitest";
import { emptyNotebook, type NotebookData } from "../src/data/model";
import { canonicalJson, isBackedUp, mergeNotebooks, notebookHash, parseSyncState, planSync, readRemoteNotebook } from "../src/data/cloudSync";
import { createTrip } from "../../src/domain/workspace/tripForm";
import { addTrip } from "../../src/domain/workspace/library";
import { defaultDesign } from "../src/data/notebookDesign";

// planSync는 내용 지문과 비었는지만 본다. 검증과 무관한 비교용 수첩.
function notebook(title: string): NotebookData {
  return {
    ...emptyNotebook(),
    pages: [{ id: title, tripId: "t", kind: "journal", title, date: "2026-10-13", body: "", address: "", done: false }],
  };
}

const empty = emptyNotebook();
const mine = notebook("mine");
const other = notebook("other");

describe("canonicalJson", () => {
  it("ignores key order so a jsonb round trip keeps the same hash", () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(canonicalJson({ a: [{ c: 3, d: 2 }], b: 1 }));
    expect(notebookHash({ b: 1, a: 2 })).toBe(notebookHash({ a: 2, b: 1 }));
    expect(notebookHash({ a: 1 })).not.toBe(notebookHash({ a: 2 }));
  });
});

describe("planSync", () => {
  const known = { userId: "u", version: 3, hash: notebookHash(mine) };

  it("backs up this device's notebook when the account has none yet", () => {
    expect(planSync("u", mine, null, null)).toEqual({ kind: "create" });
    expect(planSync("u", empty, null, null)).toEqual({ kind: "none" });
  });

  it("restores the account notebook onto an empty device", () => {
    const remote = { version: 5, payload: mine };
    expect(planSync("u", empty, null, remote)).toEqual({ kind: "download", remote });
  });

  it("asks before mixing a different notebook on first connection", () => {
    const remote = { version: 5, payload: other };
    expect(planSync("u", mine, null, remote)).toEqual({ kind: "conflict", remote });
    // 다른 계정의 동기화 기록은 이 계정 것으로 보지 않는다.
    expect(planSync("u", mine, { ...known, userId: "someone" }, remote)).toEqual({ kind: "conflict", remote });
  });

  it("adopts an identical notebook without asking", () => {
    expect(planSync("u", mine, null, { version: 5, payload: JSON.parse(JSON.stringify(mine)) })).toEqual({
      kind: "none",
      adopt: { userId: "u", version: 5, hash: notebookHash(mine) },
    });
  });

  it("uploads local edits, downloads remote edits, and flags edits on both sides", () => {
    expect(planSync("u", mine, known, { version: 3, payload: mine })).toEqual({ kind: "none" });
    expect(planSync("u", other, known, { version: 3, payload: mine })).toEqual({ kind: "upload", baseVersion: 3 });
    const newer = { version: 4, payload: other };
    expect(planSync("u", mine, known, newer)).toEqual({ kind: "download", remote: newer });
    const third = notebook("third");
    expect(planSync("u", third, known, newer)).toEqual({ kind: "conflict", remote: newer });
  });
});

describe("isBackedUp", () => {
  const state = { userId: "u", version: 3, hash: notebookHash(mine) };

  it("is true only when this account last saved exactly this notebook", () => {
    expect(isBackedUp("u", mine, state)).toBe(true);
    expect(isBackedUp("u", other, state)).toBe(false);
    expect(isBackedUp("someone-else", mine, state)).toBe(false);
    expect(isBackedUp("u", mine, null)).toBe(false);
  });
});

describe("remote notebook checks", () => {
  it("rejects a damaged server copy instead of overwriting the device", () => {
    expect(() => readRemoteNotebook({ version: 1, payload: { version: 2 } })).toThrow();
    expect(readRemoteNotebook({ version: 1, payload: empty })).toEqual(empty);
  });

  it("reads only well-formed sync state", () => {
    expect(parseSyncState(JSON.stringify({ userId: "u", version: 2, hash: "ab" }))).toEqual({ userId: "u", version: 2, hash: "ab" });
    expect(parseSyncState("{")).toBeNull();
    expect(parseSyncState(JSON.stringify({ userId: "u", version: 1.5, hash: "ab" }))).toBeNull();
  });
});

describe("mergeNotebooks", () => {
  const at = new Date("2026-10-16T00:00:00.000Z");
  // 앱 검사를 통과하는 진짜 수첩. 수첩 하나와 속지·준비물을 하나씩 둔다.
  function device(name: string, extra: Partial<NotebookData> = {}): NotebookData {
    const trip = createTrip(
      { title: name, startDate: "2026-10-16", endDate: "2026-10-17", timeZone: "Asia/Seoul", baseCurrency: "KRW", localCurrency: "KRW", members: [{ name: "나" }], coverColor: "ink" },
      { id: `trip-${name}`, now: at },
    );
    const base = emptyNotebook();
    return {
      ...base,
      library: addTrip(base.library, trip),
      pages: [{ id: `page-${name}`, tripId: trip.id, kind: "journal", title: name, date: "2026-10-16", body: "", address: "", done: false }],
      packing: [{ id: `pack-${name}`, tripId: trip.id, title: "여권", done: false }],
      designs: { [trip.id]: defaultDesign() },
      ...extra,
    };
  }

  it("keeps the notebooks from both sides", () => {
    const merged = mergeNotebooks(device("tokyo"), device("autumn"), at);
    expect(merged.library.trips.map((t) => t.settings.title)).toEqual(["tokyo", "autumn"]);
    expect(merged.pages.map((p) => p.id)).toEqual(["page-tokyo", "page-autumn"]);
    expect(merged.packing?.map((p) => p.id)).toEqual(["pack-tokyo", "pack-autumn"]);
    expect(Object.keys(merged.designs ?? {}).sort()).toEqual(["trip-autumn", "trip-tokyo"]);
    expect(merged.library.activeTripId).toBe("trip-tokyo");
    expect(merged.library.updatedAt).toBe(at.toISOString());
  });

  it("keeps this device's copy when both sides have the same notebook", () => {
    const local = device("tokyo");
    const remote = device("tokyo", { pages: [{ ...local.pages[0], title: "older" }] });
    const merged = mergeNotebooks(local, remote, at);
    expect(merged.library.trips).toHaveLength(1);
    expect(merged.pages).toEqual(local.pages);
  });

  it("gives the same result when merged again", () => {
    const once = mergeNotebooks(device("tokyo"), device("autumn"), at);
    expect(notebookHash(mergeNotebooks(once, device("autumn"), at))).toBe(notebookHash(once));
  });

  it("refuses a result the app could not open", () => {
    const many = (prefix: string) => {
      let data = emptyNotebook();
      for (let i = 0; i < 30; i++)
        data = {
          ...data,
          library: addTrip(
            data.library,
            createTrip(
              { title: `${prefix}${i}`, startDate: "2026-10-16", endDate: "2026-10-16", timeZone: "Asia/Seoul", baseCurrency: "KRW", localCurrency: "KRW", members: [{ name: "나" }], coverColor: "ink" },
              { id: `${prefix}-${i}`, now: at },
            ),
          ),
        };
      return data;
    };
    expect(() => mergeNotebooks(many("a"), many("b"), at)).toThrow();
  });
});
