import { describe, expect, it } from "vitest";
import { createTrip } from "../../src/domain/workspace/tripForm";
import { emptyNotebook, parseNotebook, type NotebookData } from "../src/data/model";
import { deleteNotebook } from "../src/data/notebookDelete";
import { mergeNotebooks } from "../src/data/cloudSync";
import { canDeleteComment, commentsFor, type ScheduleComment } from "../src/data/sharedContent";

const NOW = new Date("2026-11-13T00:00:00Z");
function base(): NotebookData {
  const trip = createTrip({ title: "Taipei", startDate: "2026-12-01", endDate: "2026-12-03", timeZone: "Asia/Taipei", baseCurrency: "KRW", localCurrency: "TWD", members: [{ name: "Ana" }], coverColor: "ink" }, { id: "t1", now: NOW });
  return { ...emptyNotebook(), library: { schemaVersion: 3, activeTripId: "t1", trips: [trip], updatedAt: NOW.toISOString() }, pages: [{ id: "p1", tripId: "t1", kind: "plan", title: "Night market", date: "2026-12-01", body: "", address: "", done: false, createdByMemberId: "me" }] };
}
const comment = (id: string, createdAt: string, part: Partial<ScheduleComment> = {}): ScheduleComment => ({ id, tripId: "t1", pageId: "p1", authorMemberId: "me", body: "hi", createdAt, ...part });
const photo = { id: "f1", tripId: "t1", date: "2026-12-01", authorMemberId: "me", file: "f1.jpg", createdAt: NOW.toISOString() };
const parse = (d: unknown) => parseNotebook(JSON.stringify(d));

describe("comments and album in the notebook", () => {
  it("accepts valid comments, album photos and page authors", () => {
    const d = parse({ ...base(), comments: [comment("c1", "2026-11-13T01:00:00Z")], album: [photo] });
    expect(d.comments).toHaveLength(1);
    expect(d.pages[0].createdByMemberId).toBe("me");
  });

  it("rejects broken entries", () => {
    for (const bad of [
      { comments: [comment("c1", "x")] },
      { comments: [comment("c1", "2026-11-13T01:00:00Z", { body: " " })] },
      { comments: [comment("c1", "2026-11-13T01:00:00Z", { tripId: "nope" })] },
      { comments: [comment("c1", "2026-11-13T01:00:00Z"), comment("c1", "2026-11-13T02:00:00Z")] },
      { comments: [{ ...comment("c1", "2026-11-13T01:00:00Z"), extra: 1 }] },
      { album: [{ ...photo, file: undefined }] },
      { album: [{ ...photo, file: "../x.jpg" }] },
      { album: [{ ...photo, objectKey: "a/../b" }] },
    ]) expect(() => parse({ ...base(), ...bad })).toThrow();
    expect(() => parse({ ...base(), pages: [{ ...base().pages[0], createdByMemberId: "" }] })).toThrow();
  });

  it("drops a trip's comments and photos with the trip and merges them by id", () => {
    const d = parse({ ...base(), comments: [comment("c1", "2026-11-13T01:00:00Z")], album: [photo] });
    const gone = deleteNotebook(d, "t1", NOW);
    expect(gone.comments).toBeUndefined();
    expect(gone.album).toBeUndefined();
    const other = parse({ ...base(), comments: [comment("c2", "2026-11-13T02:00:00Z")] });
    expect(mergeNotebooks(d, other, NOW).comments!.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("orders a page's comments and limits deletion to the author or owner", () => {
    const list = [comment("b", "2026-11-13T02:00:00Z"), comment("a", "2026-11-13T01:00:00Z"), comment("z", "2026-11-13T00:00:00Z", { pageId: "p2" })];
    expect(commentsFor(list, "p1").map((c) => c.id)).toEqual(["a", "b"]);
    expect(canDeleteComment(list[0], "me", false)).toBe(true);
    expect(canDeleteComment(list[0], "jun", false)).toBe(false);
    expect(canDeleteComment(list[0], "jun", true)).toBe(true);
  });
});
