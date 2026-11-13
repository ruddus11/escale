import { describe, expect, it } from "vitest";
import { createTrip } from "../../src/domain/workspace/tripForm";
import { addTrip } from "../../src/domain/workspace/library";
import { emptyNotebook, parseNotebook, type NotebookData } from "../src/data/model";
import { createNotebookRepository } from "../src/data/repository";
import { mergeNotebooks } from "../src/data/cloudSync";
import {
  STICKER_BORDERS,
  STICKER_DECORATIONS,
  STICKER_FONTS,
  STICKER_LIMIT,
  STICKER_SHAPES,
  clampTransform,
  defaultStickerStyle,
  hasStickerText,
  newSticker,
  normalizeRotation,
  stickerBox,
  stickerFromPlan,
  type DaySticker,
} from "../src/data/stickers";

function notebook(): NotebookData {
  const data = emptyNotebook();
  const trip = createTrip(
    { title: "여행", startDate: "2026-10-08", endDate: "2026-10-12", baseCurrency: "KRW", members: [{ name: "나" }], coverColor: "ink", timeZone: "Asia/Tokyo" },
    { id: "trip", now: new Date("2026-10-01T00:00:00Z") },
  );
  data.library = addTrip(data.library, trip);
  return data;
}

function sticker(over: Partial<DaySticker> = {}): DaySticker {
  return { ...newSticker({ id: "s1", tripId: "trip", date: "2026-10-09" }, []), place: "니시키 시장", ...over };
}

describe("sticker defaults", () => {
  it("starts as a plain serif ticket with a solid border", () => {
    expect(defaultStickerStyle()).toEqual({ shape: "ticket", border: "solid", font: "serif", inverted: false, decoration: "none" });
    // 매번 새 객체라 한 스티커를 고쳐도 다른 스티커의 기본값이 바뀌지 않는다.
    expect(defaultStickerStyle()).not.toBe(defaultStickerStyle());
  });

  it("offers every style option the editor shows", () => {
    expect(STICKER_SHAPES).toEqual(["ticket", "stamp", "label", "receipt", "tag"]);
    expect(STICKER_BORDERS).toEqual(["none", "solid", "double", "dashed"]);
    expect(STICKER_FONTS).toEqual(["serif", "sans", "mono", "hand"]);
    expect(STICKER_DECORATIONS).toEqual(["none", "stars", "dots", "stripes", "stitch"]);
  });

  it("pre-fills place, time and area from a plan of that day", () => {
    const filled = stickerFromPlan({ id: "p1", title: "  후시미 이나리  ", time: "07:30", address: "68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto" });
    expect(filled).toEqual({ pageId: "p1", place: "후시미 이나리", time: "07:30", area: "68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto" });
    expect(stickerFromPlan({ id: "p2", title: "산책", address: "" })).toEqual({ pageId: "p2", place: "산책", time: "", area: "" });
  });
});

describe("sticker transform", () => {
  it("keeps the whole sticker on the page", () => {
    const box = stickerBox("ticket", 1);
    const t = clampTransform({ x: -1, y: 4, scale: 1, rotation: 0, z: 1 }, "ticket");
    expect(t.x).toBeCloseTo(box.halfWidth);
    expect(t.y).toBeCloseTo(1 - box.halfHeight);
    const inside = clampTransform({ x: 0.5, y: 0.5, scale: 1, rotation: 10, z: 2 }, "ticket");
    expect(inside).toEqual({ x: 0.5, y: 0.5, scale: 1, rotation: 10, z: 2 });
  });

  it("limits size and centres a sticker that is wider than the page", () => {
    expect(clampTransform({ x: 0.5, y: 0.5, scale: 9, rotation: 0, z: 1 }, "stamp").scale).toBe(2.5);
    expect(clampTransform({ x: 0.5, y: 0.5, scale: 0.01, rotation: 0, z: 1 }, "stamp").scale).toBe(0.5);
    // 2.5배 티켓(200pt × 2.5)은 기준 쪽 너비 346pt보다 넓어서 가로 가운데에 둔다.
    expect(clampTransform({ x: 0.1, y: 0.5, scale: 2.5, rotation: 0, z: 1 }, "ticket").x).toBe(0.5);
  });

  it("keeps rotated corners inside the page and centres an oversized axis", () => {
    const turned = clampTransform({ x: 0, y: 1, scale: 1, rotation: 45, z: 1 }, "ticket");
    const angle = Math.PI / 4;
    const halfX = (200 * Math.cos(angle) + 96 * Math.sin(angle)) / (2 * 346);
    const halfY = (200 * Math.sin(angle) + 96 * Math.cos(angle)) / (2 * 346 * 1.25);
    expect(turned.x).toBeCloseTo(halfX, 3);
    expect(turned.y).toBeCloseTo(1 - halfY, 3);
    expect(clampTransform({ x: 0, y: 0, scale: 2.5, rotation: 45, z: 1 }, "ticket").x).toBe(0.5);
  });

  it("rejects broken numbers instead of saving NaN", () => {
    const t = clampTransform({ x: Number.NaN, y: Infinity, scale: Number.NaN, rotation: Number.NaN, z: -3 }, "label");
    expect(t).toEqual({ x: 0.5, y: 0.5, scale: 1, rotation: 0, z: 0 });
  });

  it("wraps rotation into -180..180 degrees", () => {
    expect(normalizeRotation(190)).toBe(-170);
    expect(normalizeRotation(-190)).toBe(170);
    expect(normalizeRotation(540)).toBe(180);
    expect(normalizeRotation(12.34)).toBe(12.3);
  });
});

describe("sticker persistence", () => {
  it("round-trips through the repository and a backup file", async () => {
    const data = notebook();
    data.pages.push({ id: "p1", tripId: "trip", kind: "plan", title: "시장", date: "2026-10-09", body: "", address: "", done: false });
    data.stickers = [
      sticker({ pageId: "p1", memo: "두부 도넛", style: { shape: "receipt", border: "double", font: "hand", inverted: true, decoration: "stitch" }, transform: { x: 0.3, y: 0.7, scale: 1.4, rotation: -12.5, z: 3 } }),
    ];
    let raw: string | null = null;
    const repo = createNotebookRepository({ read: async () => raw, write: async (json) => { raw = json; } });
    await repo.save(data);
    const restored = await repo.load();
    expect(restored.stickers).toEqual(data.stickers);
    // 백업 내보내기는 들여쓰기한 JSON을 쓴다. 가져오기는 같은 검사를 거친다.
    expect(parseNotebook(JSON.stringify(restored, null, 2))).toEqual(restored);
  });

  it("still opens notebooks saved before stickers existed", () => {
    const old = notebook();
    expect(parseNotebook(JSON.stringify(old)).stickers).toBeUndefined();
  });

  it("round-trips a photo sticker and ignores unknown future kinds", () => {
    const data = notebook();
    const photo = sticker({ kind: "photo", place: "", photo: { file: "sticker-abc.jpg", shape: "polaroid", caption: "교토" } });
    data.stickers = [photo];
    expect(parseNotebook(JSON.stringify(data)).stickers).toEqual([photo]);
    expect(parseNotebook(JSON.stringify({ ...data, stickers: [{ ...photo, kind: "future" }, photo] })).stickers).toEqual([photo]);
    expect(() => parseNotebook(JSON.stringify({ ...data, stickers: [{ ...photo, photo: { ...photo.photo, file: "../outside.jpg" } }] }))).toThrow();
  });

  it("rejects stickers that would break the page", () => {
    const bad = (s: unknown) => {
      const data = notebook();
      return () => parseNotebook(JSON.stringify({ ...data, stickers: [s] }));
    };
    const ok = sticker();
    expect(bad(ok)).not.toThrow();
    expect(bad({ ...ok, tripId: "other" })).toThrow();
    expect(bad({ ...ok, date: "2026-13-01" })).toThrow();
    expect(bad({ ...ok, place: "", memo: "" })).toThrow();
    expect(bad({ ...ok, place: "x".repeat(81) })).toThrow();
    expect(bad({ ...ok, style: { ...ok.style, shape: "arch" } })).toThrow();
    expect(bad({ ...ok, style: { ...ok.style, color: "red" } })).toThrow();
    expect(bad({ ...ok, transform: { ...ok.transform, x: 2 } })).toThrow();
    expect(bad({ ...ok, transform: { ...ok.transform, scale: 0 } })).toThrow();
    expect(bad({ ...ok, extra: 1 })).toThrow();
    const data = notebook();
    expect(() => parseNotebook(JSON.stringify({ ...data, stickers: [ok, ok] }))).toThrow();
    expect(() => parseNotebook(JSON.stringify({ ...data, stickers: {} }))).toThrow();
    expect(STICKER_LIMIT).toBeGreaterThan(0);
  });

  it("keeps stickers from both devices when merging a sync conflict", () => {
    const local = notebook(), remote = notebook();
    local.stickers = [sticker({ id: "mine", place: "이 기기" }), sticker({ id: "both", place: "이 기기 쪽" })];
    remote.stickers = [sticker({ id: "theirs", place: "다른 기기" }), sticker({ id: "both", place: "다른 기기 쪽" })];
    const merged = mergeNotebooks(local, remote, new Date("2026-10-28T00:00:00Z"));
    expect(merged.stickers?.map((s) => [s.id, s.place])).toEqual([["mine", "이 기기"], ["both", "이 기기 쪽"], ["theirs", "다른 기기"], ["both~remote", "다른 기기 쪽"]]);
    expect(mergeNotebooks(notebook(), notebook(), new Date()).stickers).toBeUndefined();
  });

  it("keeps both edits of the same sticker in a sync conflict without duplicating on retry", () => {
    const local = notebook(), remote = notebook();
    local.stickers = [sticker({ id: "shared", place: "로컬 수정" })];
    remote.stickers = [sticker({ id: "shared", place: "원격 수정" })];
    const at = new Date("2026-10-28T00:00:00Z");
    const merged = mergeNotebooks(local, remote, at);
    expect(merged.stickers?.map((s) => s.place)).toEqual(["로컬 수정", "원격 수정"]);
    expect(new Set(merged.stickers?.map((s) => s.id)).size).toBe(2);
    expect(mergeNotebooks(merged, remote, at).stickers).toEqual(merged.stickers);
  });

  it("merges photo sticker references with older place stickers", () => {
    const local = notebook(), remote = notebook();
    local.stickers = [sticker({ id: "place" })];
    remote.stickers = [sticker({ id: "photo", kind: "photo", place: "", photo: { file: "sticker-abc.jpg", shape: "stamp", caption: "" } })];
    expect(mergeNotebooks(local, remote, new Date()).stickers).toEqual([...local.stickers, ...remote.stickers]);
  });
});
