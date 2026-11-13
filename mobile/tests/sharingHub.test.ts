import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTripHub, emptyHubState } from "../../src/domain/sharing/hub";
import { sha256Hex } from "../../src/domain/sharing/sha256";
import { HubError, parseEntityKey } from "../../src/domain/sharing/types";

function setup(start = "2026-11-13T00:00:00Z") {
  let now = new Date(start);
  let n = 0;
  const hub = createTripHub({ state: emptyHubState(), now: () => now, newId: () => `id${++n}`, newToken: () => `token-${++n}-abcdefghijklmnopqrstuvwxyz0123456789` });
  const settings = { id: undefined, title: "Osaka", members: [{ id: "me", name: "Ana" }, { id: "jun", name: "Jun" }, { id: "min", name: "Min" }] };
  const { sharedTripId } = hub.shareTrip("u-owner", {
    operationId: "share-1",
    ownerMemberId: "me",
    entities: { "settings:": { title: settings.title, members: settings.members }, "meta:": { budget: {} }, "page:p1": { id: "p1", title: "Castle" } },
  });
  return { hub, sharedTripId, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}

const code = (fn: () => unknown) => {
  try { fn(); } catch (e) { return e instanceof HubError ? e.code : String(e); }
  return "ok";
};

describe("sha256Hex", () => {
  it("matches node crypto", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    for (const text of ["", "초대 토큰 ✈️", "x".repeat(200)]) expect(sha256Hex(text)).toBe(createHash("sha256").update(text).digest("hex"));
  });
});

describe("entity keys", () => {
  it("accepts singletons and ids, rejects the rest", () => {
    expect(parseEntityKey("settings:")).toEqual({ type: "settings", id: "" });
    expect(parseEntityKey("page:a-1~x")).toEqual({ type: "page", id: "a-1~x" });
    expect(parseEntityKey("settings:x")).toBeNull();
    expect(parseEntityKey("page:")).toBeNull();
    expect(parseEntityKey("diary:1")).toBeNull();
    expect(parseEntityKey("page:a/b")).toBeNull();
  });
});

describe("trip hub", () => {
  it("shares one trip idempotently with the owner as the only member", () => {
    const { hub, sharedTripId } = setup();
    const again = hub.shareTrip("u-owner", { operationId: "share-1", ownerMemberId: "me", entities: {} });
    expect(again.sharedTripId).toBe(sharedTripId);
    const pulled = hub.pull("u-owner", sharedTripId, 0);
    expect(pulled.revision).toBe(3);
    expect(pulled.changes.map((c) => c.key)).toEqual(["settings:", "meta:", "page:p1"]);
    expect(pulled.members).toEqual([expect.objectContaining({ memberId: "me", role: "owner", status: "active" })]);
  });

  it("leaves no state behind when a share is rejected", () => {
    const { hub } = setup();
    const before = hub.snapshot();
    expect(code(() => hub.shareTrip("u2", { operationId: "bad", ownerMemberId: "me", entities: { "settings:": { title: "x", members: [] }, "page:p1": { id: "other" } } }))).toBe("invalid");
    expect(hub.snapshot()).toEqual(before);
  });

  it("stores only the token hash and checks expiry and revocation", () => {
    const { hub, sharedTripId, advance } = setup();
    const invite = hub.createInvite("u-owner", sharedTripId, "editor");
    expect(JSON.stringify(hub.snapshot())).not.toContain(invite.token);
    expect(hub.previewInvite(invite.token)).toEqual({ sharedTripId, title: "Osaka", role: "editor", claimable: [{ id: "jun", name: "Jun" }, { id: "min", name: "Min" }] });
    expect(code(() => hub.previewInvite("nope"))).toBe("invite-invalid");
    advance(7 * 86_400_000);
    expect(code(() => hub.previewInvite(invite.token))).toBe("invite-expired");
    const second = hub.createInvite("u-owner", sharedTripId, "viewer");
    hub.revokeInvite("u-owner", sharedTripId, second.inviteId);
    expect(code(() => hub.join("u-jun", { token: second.token, operationId: "j", choice: { memberId: "jun" } }))).toBe("invite-revoked");
    expect(hub.listInvites("u-owner", sharedTripId)).toEqual([]);
  });

  it("lets only the owner invite and manage members", () => {
    const { hub, sharedTripId } = setup();
    const invite = hub.createInvite("u-owner", sharedTripId, "editor");
    hub.join("u-jun", { token: invite.token, operationId: "j1", choice: { memberId: "jun" } });
    expect(code(() => hub.createInvite("u-jun", sharedTripId, "viewer"))).toBe("owner-only");
    expect(code(() => hub.setRole("u-jun", sharedTripId, "jun", "viewer"))).toBe("owner-only");
    expect(code(() => hub.removeMember("u-owner", sharedTripId, "me"))).toBe("invalid");
    expect(code(() => hub.leave("u-owner", sharedTripId))).toBe("invalid");
    expect(code(() => hub.createInvite("stranger", sharedTripId, "viewer"))).toBe("forbidden");
  });

  it("joins once per account and keeps companions unique", () => {
    const { hub, sharedTripId } = setup();
    const invite = hub.createInvite("u-owner", sharedTripId, "editor");
    const first = hub.join("u-jun", { token: invite.token, operationId: "j1", choice: { memberId: "jun" } });
    expect(first.membership).toEqual(expect.objectContaining({ memberId: "jun", role: "editor" }));
    // 다른 요청으로 다시 수락해도 같은 멤버.
    expect(hub.join("u-jun", { token: invite.token, operationId: "j2", choice: { memberId: "min" } }).membership.memberId).toBe("jun");
    expect(code(() => hub.join("u-other", { token: invite.token, operationId: "j3", choice: { memberId: "jun" } }))).toBe("member-claimed");
    const fresh = hub.join("u-new", { token: invite.token, operationId: "j4", choice: { newName: "  Sora " } });
    const settings = hub.pull("u-owner", sharedTripId, 0).changes.find((c) => c.key === "settings:")!;
    expect((settings.value as { members: { id: string; name: string }[] }).members.at(-1)).toEqual({ id: fresh.membership.memberId, name: "Sora" });
    expect(settings.revision).toBe(4);
    expect(code(() => hub.join("u-x", { token: invite.token, operationId: "j5", choice: { newName: " " } }))).toBe("name-invalid");
    expect(hub.pull("u-owner", sharedTripId, 0).members.filter((m) => m.status === "active")).toHaveLength(3);
  });

  it("detects stale writes and replays a retried operation without applying twice", () => {
    const { hub, sharedTripId } = setup();
    const op = { operationId: "op1", sharedTripId, key: "page:p1", baseRevision: 3, value: { id: "p1", title: "Castle at 10" } };
    expect(hub.push("u-owner", op)).toEqual({ status: "applied", revision: 4 });
    expect(hub.push("u-owner", op)).toEqual({ status: "applied", revision: 4 });
    expect(hub.pull("u-owner", sharedTripId, 0).revision).toBe(4);
    const stale = hub.push("u-owner", { ...op, operationId: "op2", value: { id: "p1", title: "Other" } });
    expect(stale).toEqual({ status: "conflict", current: { key: "page:p1", revision: 4, value: { id: "p1", title: "Castle at 10" } } });
    expect(hub.push("u-other", op)).toEqual({ status: "invalid" });
    expect(hub.push("u-other", { ...op, operationId: "op3" })).toEqual({ status: "forbidden", reason: "not-member" });
  });

  it("supports delete tombstones and recreating from the tombstone revision", () => {
    const { hub, sharedTripId } = setup();
    expect(hub.push("u-owner", { operationId: "d", sharedTripId, key: "page:p1", baseRevision: 3, value: null })).toEqual({ status: "applied", revision: 4 });
    expect(hub.pull("u-owner", sharedTripId, 3).changes).toEqual([{ key: "page:p1", revision: 4, value: null }]);
    expect(hub.push("u-owner", { operationId: "c", sharedTripId, key: "page:p1", baseRevision: 0, value: { id: "p1" } }).status).toBe("conflict");
    expect(hub.push("u-owner", { operationId: "c2", sharedTripId, key: "page:p1", baseRevision: 4, value: { id: "p1" } }).status).toBe("applied");
    expect(hub.push("u-owner", { operationId: "s", sharedTripId, key: "settings:", baseRevision: 1, value: null }).status).toBe("invalid");
  });

  it("enforces roles for content, settings, comments and photos", () => {
    const { hub, sharedTripId } = setup();
    hub.join("u-jun", { token: hub.createInvite("u-owner", sharedTripId, "editor").token, operationId: "j1", choice: { memberId: "jun" } });
    hub.join("u-min", { token: hub.createInvite("u-owner", sharedTripId, "viewer").token, operationId: "j2", choice: { memberId: "min" } });
    const push = (user: string, key: string, baseRevision: number, value: unknown) => hub.push(user, { operationId: `${user}-${key}-${baseRevision}-${JSON.stringify(value)}`, sharedTripId, key, baseRevision, value });
    expect(push("u-min", "page:p2", 0, { id: "p2" })).toEqual({ status: "forbidden", reason: "role" });
    expect(push("u-jun", "settings:", 1, { title: "Mine", members: [{ id: "me", name: "Ana" }, { id: "jun", name: "Jun" }, { id: "min", name: "Min" }] })).toEqual({ status: "forbidden", reason: "role" });
    expect(push("u-jun", "page:p2", 0, { id: "p2", createdByMemberId: "me" })).toEqual({ status: "forbidden", reason: "role" });
    expect(push("u-jun", "page:p2", 0, { id: "p2", createdByMemberId: "jun" }).status).toBe("applied");
    // viewer도 자기 댓글은 단다.
    const comment = push("u-min", "comment:c1", 0, { id: "c1", pageId: "p1", authorMemberId: "min", body: "좋아요" });
    expect(comment.status).toBe("applied");
    const rev = (comment as { revision: number }).revision;
    expect(push("u-min", "comment:c2", 0, { id: "c2", authorMemberId: "jun", body: "x" })).toEqual({ status: "forbidden", reason: "role" });
    expect(push("u-jun", "comment:c1", rev, null)).toEqual({ status: "forbidden", reason: "role" });
    expect(push("u-jun", "comment:c1", rev, { id: "c1", authorMemberId: "min", body: "edit" })).toEqual({ status: "forbidden", reason: "role" });
    expect(push("u-owner", "comment:c1", rev, null).status).toBe("applied");
    expect(push("u-min", "photo:f1", 0, { id: "f1", authorMemberId: "min" })).toEqual({ status: "forbidden", reason: "role" });
    expect(push("u-jun", "photo:f1", 0, { id: "f1", authorMemberId: "jun" }).status).toBe("applied");
    // 계정과 연결된 동행자를 설정에서 빼면 거부.
    expect(push("u-owner", "settings:", 1, { title: "Osaka", members: [{ id: "me", name: "Ana" }, { id: "jun", name: "Jun" }] })).toEqual({ status: "invalid" });
    hub.setRole("u-owner", sharedTripId, "min", "editor");
    expect(push("u-min", "page:p3", 0, { id: "p3" }).status).toBe("applied");
  });

  it("blocks removed, departed and closed members from reading and writing", () => {
    const { hub, sharedTripId } = setup();
    hub.join("u-jun", { token: hub.createInvite("u-owner", sharedTripId, "editor").token, operationId: "j1", choice: { memberId: "jun" } });
    hub.join("u-min", { token: hub.createInvite("u-owner", sharedTripId, "editor").token, operationId: "j2", choice: { memberId: "min" } });
    hub.removeMember("u-owner", sharedTripId, "jun");
    hub.leave("u-min", sharedTripId);
    for (const user of ["u-jun", "u-min"]) {
      expect(code(() => hub.pull(user, sharedTripId, 0))).toBe("forbidden");
      expect(hub.push(user, { operationId: `${user}-w`, sharedTripId, key: "page:x1", baseRevision: 0, value: { id: "x1" } })).toEqual({ status: "forbidden", reason: "not-member" });
    }
    // 내보낸 동행자 자리는 다시 초대할 수 있고, 지출 기록용 동행자는 설정에 남는다.
    expect(hub.previewInvite(hub.createInvite("u-owner", sharedTripId, "viewer").token).claimable.map((m) => m.id)).toEqual(["jun", "min"]);
    hub.closeTrip("u-owner", sharedTripId);
    expect(code(() => hub.pull("u-owner", sharedTripId, 0))).toBe("closed");
  });
});
