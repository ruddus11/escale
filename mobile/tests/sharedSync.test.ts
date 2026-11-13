import { describe, expect, it } from "vitest";
import { createTrip } from "../../src/domain/workspace/tripForm";
import { createTripHub, emptyHubState } from "../../src/domain/sharing/hub";
import { emptyNotebook, parseNotebook, type NotebookData, type PageEntry } from "../src/data/model";
import { deviceBackend } from "../src/data/shared/deviceBackend";
import { applyEntities, projectTrip } from "../src/data/shared/projection";
import { joinShared, keepMine, pendingChanges, startSharing, syncLink, takeTheirs, type SharedLink, type SyncDeps } from "../src/data/shared/syncEngine";
import type { SharedTripBackend } from "../src/data/shared/backend";
import { inviteTokenFrom, inviteUrl } from "../src/data/shared/backend";

const NOW = new Date("2026-11-13T03:00:00Z");
let seq = 0;
const newId = () => `id-${++seq}`;

function ownerNotebook(): NotebookData {
  const trip = createTrip(
    { title: "Osaka", startDate: "2026-11-20", endDate: "2026-11-23", timeZone: "Asia/Tokyo", baseCurrency: "KRW", localCurrency: "JPY", members: [{ name: "Ana" }, { name: "Jun" }, { name: "Min" }], coverColor: "ink" },
    { id: "trip-a", now: NOW },
  );
  const page = (id: string, title: string): PageEntry => ({ id, tripId: "trip-a", kind: "plan", title, date: "2026-11-20", body: "", address: "", done: false, time: "10:00" });
  return parseNotebook(JSON.stringify({
    ...emptyNotebook(),
    library: { schemaVersion: 3, activeTripId: "trip-a", trips: [trip], updatedAt: NOW.toISOString() },
    pages: [page("p1", "Castle"), page("p2", "Market"), { ...page("j1", "diary"), kind: "journal" }],
    packing: [{ id: "k1", tripId: "trip-a", title: "Adapter", done: false }],
  }));
}

/** 한 기기: 수첩 하나와 링크 하나. commit은 실제 저장처럼 parseNotebook 검사를 거친다. */
function device(backend: SharedTripBackend, data: NotebookData) {
  const box = { data, link: null as SharedLink | null, backend };
  const deps = (): SyncDeps => ({
    backend: box.backend,
    read: () => box.data,
    commit: async (update) => { box.data = parseNotebook(JSON.stringify(update(box.data))); },
    save: async (link) => { box.link = JSON.parse(JSON.stringify(link)); },
    newId,
    now: () => NOW,
  });
  return {
    box,
    deps,
    sync: async () => { const r = await syncLink(box.link!, deps()); box.link = r.link; return r.outcome; },
    edit: (update: (d: NotebookData) => NotebookData) => { box.data = parseNotebook(JSON.stringify(update(box.data))); },
  };
}

const trip = (d: NotebookData, id: string) => d.library.trips.find((t) => t.id === id)!;
const retitle = (id: string, title: string) => (d: NotebookData) => ({ ...d, pages: d.pages.map((p) => (p.id === id ? { ...p, title } : p)) });

async function setup() {
  const hub = createTripHub({ state: emptyHubState(), now: () => NOW, newId, newToken: () => `tok${++seq}abcdefghijklmnopqrstuvwxyz` });
  const owner = device(deviceBackend(hub, "u-ana"), ownerNotebook());
  const members = trip(owner.box.data, "trip-a").settings.members;
  owner.box.link = await startSharing({ data: owner.box.data, tripId: "trip-a", ownerMemberId: members[0].id, operationId: "share" }, owner.deps());
  const invite = await owner.box.backend.createInvite(owner.box.link.sharedTripId, "editor");
  const jun = device(deviceBackend(hub, "u-jun"), emptyNotebook());
  jun.box.link = await joinShared({ token: invite.token, operationId: "join-jun", choice: { memberId: members[1].id }, localTripId: "trip-b" }, jun.deps());
  return { hub, owner, jun, members };
}

describe("shared trip projection", () => {
  it("round-trips a trip without personal journal pages or archive state", () => {
    const data = ownerNotebook();
    const archived = { ...data, library: { ...data.library, trips: data.library.trips.map((t) => ({ ...t, settings: { ...t.settings, archived: true } })) } };
    const entities = projectTrip(archived, "trip-a")!;
    expect(Object.keys(entities).filter((k) => k.startsWith("page:"))).toEqual(["page:p1", "page:p2"]);
    expect(JSON.stringify(entities)).not.toContain("\"tripId\"");
    const rebuilt = applyEntities(emptyNotebook(), "copy", "~x", Object.entries(entities).map(([key, value]) => ({ key, value })), NOW);
    const parsed = parseNotebook(JSON.stringify(rebuilt));
    expect(parsed.pages.map((p) => p.id)).toEqual(["p1~x", "p2~x"]);
    expect(projectTrip(parsed, "copy", "~x")).toEqual(entities);
    expect(projectTrip(parsed, "nope")).toBeNull();
  });

  it("only shares photos once they are uploaded", () => {
    const data = ownerNotebook();
    const withPhotos = { ...data, album: [
      { id: "f1", tripId: "trip-a", date: "2026-11-20", authorMemberId: "a", file: "f1.jpg", createdAt: NOW.toISOString() },
      { id: "f2", tripId: "trip-a", date: "2026-11-20", authorMemberId: "a", file: "f2.jpg", objectKey: "t/f2.jpg", createdAt: NOW.toISOString() },
    ] };
    const keys = Object.keys(projectTrip(parseNotebook(JSON.stringify(withPhotos)), "trip-a")!);
    expect(keys).toContain("photo:f2");
    expect(keys).not.toContain("photo:f1");
  });
});

describe("invite links", () => {
  it("round-trips and rejects junk", () => {
    expect(inviteTokenFrom(inviteUrl("abcDEF123_-abcdefghijkl"))).toBe("abcDEF123_-abcdefghijkl");
    expect(inviteTokenFrom("margin://join?t=abcDEF123_-abcdefghijkl")).toBe("abcDEF123_-abcdefghijkl");
    expect(inviteTokenFrom("escale://join?t=short")).toBeNull();
    expect(inviteTokenFrom("https://evil.example/join?t=abcDEF123_-abcdefghijkl")).toBeNull();
  });
});

describe("shared trip sync", () => {
  it("copies the trip to a joining member and syncs edits both ways", async () => {
    const { owner, jun, members } = await setup();
    expect(jun.box.data.library.activeTripId).toBe("trip-b");
    expect(jun.box.data.pages.map((p) => p.title)).toEqual(["Castle", "Market"]);
    expect(jun.box.data.packing).toEqual([{ id: "k1", tripId: "trip-b", title: "Adapter", done: false }]);
    expect(jun.box.link!.memberId).toBe(members[1].id);
    expect(pendingChanges(jun.box.link!, projectTrip(jun.box.data, "trip-b")!)).toEqual([]);

    jun.edit((d) => ({ ...d, pages: [...d.pages, { id: "p3", tripId: "trip-b", kind: "plan", title: "Ramen", date: "2026-11-21", body: "", address: "", done: false, createdByMemberId: members[1].id }] }));
    jun.edit((d) => ({ ...d, packing: d.packing!.map((k) => ({ ...k, done: true })) }));
    expect(await jun.sync()).toBe("synced");
    expect(await owner.sync()).toBe("synced");
    expect(owner.box.data.pages.find((p) => p.id === "p3")).toEqual(expect.objectContaining({ tripId: "trip-a", createdByMemberId: members[1].id }));
    expect(owner.box.data.packing![0].done).toBe(true);
    // 기록(journal)은 개인 것이라 그대로 남는다.
    expect(owner.box.data.pages.some((p) => p.id === "j1")).toBe(true);

    owner.edit((d) => ({ ...d, pages: d.pages.filter((p) => p.id !== "p2") }));
    await owner.sync();
    await jun.sync();
    expect(jun.box.data.pages.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("marks concurrent edits as a conflict instead of overwriting, then resolves either way", async () => {
    const { owner, jun } = await setup();
    owner.edit(retitle("p1", "Castle 9am"));
    jun.edit(retitle("p1", "Castle 11am"));
    await owner.sync();
    expect(await jun.sync()).toBe("synced");
    expect(Object.keys(jun.box.link!.conflicts)).toEqual(["page:p1"]);
    expect(jun.box.data.pages.find((p) => p.id === "p1")!.title).toBe("Castle 11am");
    // 충돌을 고르기 전에는 보내지 않는다.
    await jun.sync();
    await owner.sync();
    expect(owner.box.data.pages.find((p) => p.id === "p1")!.title).toBe("Castle 9am");

    jun.box.link = keepMine(jun.box.link!, "page:p1");
    await jun.sync();
    await owner.sync();
    expect(owner.box.data.pages.find((p) => p.id === "p1")!.title).toBe("Castle 11am");

    owner.edit(retitle("p1", "Castle noon"));
    jun.edit(retitle("p1", "Castle 1pm"));
    await owner.sync();
    await jun.sync();
    jun.box.link = await takeTheirs(jun.box.link!, "page:p1", jun.deps());
    expect(jun.box.data.pages.find((p) => p.id === "p1")!.title).toBe("Castle noon");
    expect(pendingChanges(jun.box.link, projectTrip(jun.box.data, "trip-b")!)).toEqual([]);
  });

  it("resends the same operation after a lost response without applying twice (A6)", async () => {
    const { hub, owner } = await setup();
    const real = owner.box.backend;
    let drop = true;
    owner.box.backend = { ...real, push: async (op) => { const r = await real.push(op); if (drop) { drop = false; throw new Error("network"); } return r; } };
    owner.edit(retitle("p1", "Castle offline"));
    const before = hub.pull("u-ana", owner.box.link!.sharedTripId, 0).revision;
    expect(await owner.sync()).toBe("offline");
    const inflight = owner.box.link!.inflight!;
    expect(inflight.key).toBe("page:p1");
    // 앱을 다시 켠 것처럼 저장된 링크로 다시 시작한다.
    owner.box.link = JSON.parse(JSON.stringify(owner.box.link));
    expect(await owner.sync()).toBe("synced");
    expect(owner.box.link!.inflight).toBeUndefined();
    expect(hub.pull("u-ana", owner.box.link!.sharedTripId, 0).revision).toBe(before + 1);
    expect(pendingChanges(owner.box.link!, projectTrip(owner.box.data, "trip-a")!)).toEqual([]);
  });

  it("reverts a viewer's local edit the server refused, keeps their comment", async () => {
    const { hub, owner, members } = await setup();
    const invite = await owner.box.backend.createInvite(owner.box.link!.sharedTripId, "viewer");
    const min = device(deviceBackend(hub, "u-min"), emptyNotebook());
    min.box.link = await joinShared({ token: invite.token, operationId: "join-min", choice: { memberId: members[2].id }, localTripId: "trip-m" }, min.deps());
    expect(min.box.link.role).toBe("viewer");
    min.edit(retitle("p1", "Hacked"));
    min.edit((d) => ({ ...d, comments: [{ id: "c1", tripId: "trip-m", pageId: "p1", authorMemberId: members[2].id, body: "좋아요", createdAt: NOW.toISOString() }] }));
    await min.sync();
    expect(min.box.data.pages.find((p) => p.id === "p1")!.title).toBe("Castle");
    expect(min.box.link!.notice).toBe("reverted-role");
    await owner.sync();
    expect(owner.box.data.comments).toEqual([expect.objectContaining({ id: "c1", tripId: "trip-a", pageId: "p1", body: "좋아요" })]);
  });

  it("ends the link when a member is removed and keeps their device copy", async () => {
    const { owner, jun, members } = await setup();
    await owner.box.backend.removeMember(owner.box.link!.sharedTripId, members[1].id);
    jun.edit(retitle("p1", "after removal"));
    expect(await jun.sync()).toBe("ended");
    expect(jun.box.link!.ended).toBe("removed");
    expect(jun.box.data.pages.find((p) => p.id === "p1")!.title).toBe("after removal");
    expect(await jun.sync()).toBe("ended");
  });

  it("never sends deletions when the local trip is missing", async () => {
    const { owner, jun } = await setup();
    jun.edit((d) => ({ ...d, library: { ...d.library, trips: [], activeTripId: "" }, pages: [], packing: undefined }));
    expect(await jun.sync()).toBe("missing");
    await owner.sync();
    expect(owner.box.data.pages.filter((p) => p.kind === "plan")).toHaveLength(2);
  });

  it("shares companions added to settings before expenses that use them", async () => {
    const { owner, jun } = await setup();
    owner.edit((d) => ({ ...d, library: { ...d.library, trips: d.library.trips.map((t) => {
      const settings = { ...t.settings, members: [...t.settings.members, { id: "new-m", name: "Sora" }] };
      const expense = { id: "e1", amount: 1000, currency: "JPY" as const, rateToBase: "9.1", paidBy: { kind: "member" as const, memberId: "new-m" }, split: { kind: "even" as const, memberIds: ["new-m", settings.ownerId] }, category: "food" as const, occurredAt: "2026-11-20T03:00:00.000Z" };
      return { ...t, settings, ledger: { ...t.ledger, expenses: [expense] } };
    }) } }));
    expect(await owner.sync()).toBe("synced");
    expect(await jun.sync()).toBe("synced");
    expect(trip(jun.box.data, "trip-b").ledger.expenses.map((e) => e.id)).toEqual(["e1"]);
  });
});

