import { describe, expect, it } from "vitest";
import { emptyNotebook, parseNotebook, type NotebookData } from "../src/data/model";
import { mergeNotebooks } from "../src/data/cloudSync";
import {
  DELETED_TRIP_LIMIT,
  deleteNotebook,
  mergeDeletedTrips,
  stickerPhotoFiles,
  touchNotebookTrip,
  tripSettingKeys,
} from "../src/data/notebookDelete";
import { newSticker, type DaySticker } from "../src/data/stickers";
import { defaultDesign } from "../src/data/notebookDesign";
import { createTrip } from "../../src/domain/workspace/tripForm";
import { addTrip, selectTrip } from "../../src/domain/workspace/library";

const created = new Date("2026-10-16T00:00:00.000Z");
const deletedAt = new Date("2026-10-20T00:00:00.000Z");

function trip(id: string, now = created) {
  return createTrip(
    { title: id, startDate: "2026-10-16", endDate: "2026-10-17", timeZone: "Asia/Seoul", baseCurrency: "KRW", localCurrency: "KRW", members: [{ name: "나" }], coverColor: "ink" },
    { id, now },
  );
}

function photoSticker(id: string, tripId: string, file: string): DaySticker {
  return { ...newSticker({ id, tripId, date: "2026-10-16" }, []), kind: "photo", photo: { file, shape: "circle", caption: "" } };
}

/** 수첩 두 권(tokyo, osaka)과 딸린 속지·준비물·표지·스티커. 앱 검사를 통과한다. */
function twoBooks(): NotebookData {
  const base = emptyNotebook();
  const library = selectTrip(addTrip(addTrip(base.library, trip("tokyo")), trip("osaka")), "tokyo", created.toISOString());
  const data: NotebookData = {
    ...base,
    library,
    pages: ["tokyo", "osaka"].map((id) => ({ id: `page-${id}`, tripId: id, kind: "journal" as const, title: id, date: "2026-10-16", body: "", address: "", done: false })),
    packing: ["tokyo", "osaka"].map((id) => ({ id: `pack-${id}`, tripId: id, title: "여권", done: false })),
    designs: { tokyo: defaultDesign(), osaka: defaultDesign() },
    stickers: [
      photoSticker("s-tokyo", "tokyo", "sticker-tokyo.jpg"),
      photoSticker("s-shared", "tokyo", "sticker-shared.jpg"),
      photoSticker("s-osaka", "osaka", "sticker-shared.jpg"),
    ],
  };
  return parseNotebook(JSON.stringify(data));
}

describe("deleteNotebook", () => {
  it("removes the notebook with everything attached and records the deletion", () => {
    const next = deleteNotebook(twoBooks(), "tokyo", deletedAt);
    expect(next.library.trips.map((t) => t.id)).toEqual(["osaka"]);
    expect(next.library.activeTripId).toBe("osaka");
    expect(next.pages.map((p) => p.id)).toEqual(["page-osaka"]);
    expect(next.packing?.map((p) => p.id)).toEqual(["pack-osaka"]);
    expect(Object.keys(next.designs ?? {})).toEqual(["osaka"]);
    expect(next.stickers?.map((s) => s.id)).toEqual(["s-osaka"]);
    expect(next.deletedTrips).toEqual([{ id: "tokyo", deletedAt: deletedAt.toISOString() }]);
    // 저장·백업 검사를 그대로 통과한다.
    expect(parseNotebook(JSON.stringify(next))).toEqual(next);
  });

  it("can delete the last notebook", () => {
    const once = deleteNotebook(twoBooks(), "tokyo", deletedAt);
    const none = deleteNotebook(once, "osaka", deletedAt);
    expect(none.library.trips).toEqual([]);
    expect(none.library.activeTripId).toBe("");
    expect(none).not.toHaveProperty("packing");
    expect(none).not.toHaveProperty("designs");
    expect(none).not.toHaveProperty("stickers");
    expect(none.deletedTrips?.map((r) => r.id).sort()).toEqual(["osaka", "tokyo"]);
  });

  it("rejects an unknown notebook", () => {
    expect(() => deleteNotebook(twoBooks(), "ghost", deletedAt)).toThrow(RangeError);
  });
});

describe("stickerPhotoFiles", () => {
  it("lists the notebook's sticker photos but keeps files another notebook still uses", () => {
    expect(stickerPhotoFiles(twoBooks(), "tokyo")).toEqual(["sticker-tokyo.jpg"]);
  });
});

describe("tripSettingKeys", () => {
  it("covers every per-notebook device setting", () => {
    expect(tripSettingKeys("t1")).toEqual(["hero:t1", "dayPhotos:t1", "taste:t1", "dismissed:t1", "autofill:t1"]);
  });
});

describe("deletion records", () => {
  it("keeps the latest record per notebook and caps the list", () => {
    const old = { id: "a", deletedAt: "2026-10-01T00:00:00.000Z" };
    const late = { id: "a", deletedAt: "2026-10-02T00:00:00.000Z" };
    expect(mergeDeletedTrips([old], [late])).toEqual([late]);
    const many = Array.from({ length: DELETED_TRIP_LIMIT + 5 }, (_, i) => ({ id: `t${i}`, deletedAt: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString() }));
    const kept = mergeDeletedTrips(many);
    expect(kept).toHaveLength(DELETED_TRIP_LIMIT);
    expect(kept[0]?.id).toBe(`t${DELETED_TRIP_LIMIT + 4}`);
  });

  it("rejects malformed records when loading", () => {
    const data = { ...twoBooks(), deletedTrips: [{ id: "x" }] };
    expect(() => parseNotebook(JSON.stringify(data))).toThrow();
  });
});

describe("merging after a deletion", () => {
  it("does not bring back a notebook deleted on this device", () => {
    const remote = twoBooks();
    const local = deleteNotebook(twoBooks(), "tokyo", deletedAt);
    const merged = mergeNotebooks(local, remote, deletedAt);
    expect(merged.library.trips.map((t) => t.id)).toEqual(["osaka"]);
    expect(merged.pages.map((p) => p.id)).toEqual(["page-osaka"]);
    expect(merged.stickers?.map((s) => s.id)).toEqual(["s-osaka"]);
    expect(merged.deletedTrips?.map((r) => r.id)).toEqual(["tokyo"]);
  });

  it("does not bring back a notebook deleted on the other device", () => {
    const merged = mergeNotebooks(twoBooks(), deleteNotebook(twoBooks(), "osaka", deletedAt), deletedAt);
    expect(merged.library.trips.map((t) => t.id)).toEqual(["tokyo"]);
    expect(merged.library.activeTripId).toBe("tokyo");
  });

  it("keeps a notebook that was edited after it was deleted elsewhere", () => {
    const before = twoBooks();
    const edited = touchNotebookTrip({ ...before, pages: before.pages.map((page) => page.tripId === "tokyo" ? { ...page, body: "새 기록" } : page) }, "tokyo", new Date("2026-10-21T00:00:00.000Z"));
    const merged = mergeNotebooks(edited, deleteNotebook(twoBooks(), "tokyo", deletedAt), deletedAt);
    expect(merged.library.trips.map((t) => t.id).sort()).toEqual(["osaka", "tokyo"]);
    expect(merged.pages.find((page) => page.tripId === "tokyo")?.body).toBe("새 기록");
    expect(merged).not.toHaveProperty("deletedTrips");
    expect(edited.library.trips.find((t) => t.id === "osaka")?.updatedAt).toBe(created.toISOString());
  });
});
