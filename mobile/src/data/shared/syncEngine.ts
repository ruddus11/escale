import { HubError, type ChangeOperation, type EntityKey, type TripMembership, type TripRole } from "../../../../src/domain/sharing/types";
import type { NotebookData } from "../model";
import type { SharedTripBackend } from "./backend";
import { applyEntities, hashOf, projectTrip, type Entities } from "./projection";

// 공유 여행의 기기 쪽 동기화. 화면 저장 경로는 그대로 두고, 서버와 마지막으로 맞춘 기준 사본(base)과
// 지금 기기 사본을 비교해 바뀐 엔티티만 보낸다. 엔티티마다 전송 중 작업은 하나이고, 보내기 전에 기록해
// 앱이 꺼져도 같은 operationId로 다시 보낸다.

export type LinkEnd = "removed" | "closed";
export type LinkNotice = "reverted-role" | "reverted-invalid" | "apply-failed";

export interface SharedLink {
  version: 1;
  localTripId: string;
  sharedTripId: string;
  /** 이 기기 사용자의 동행자 Member.id. */
  memberId: string;
  /** 이 링크로 서버에 접근하는 계정. 로그인 계정이 바뀌면 동기화하지 않는다. */
  userId: string;
  role: TripRole;
  /** 개발용 같은 기기 참가 사본의 ID 접미사. */
  idSuffix?: string;
  cursor: number;
  base: Record<EntityKey, { revision: number; hash: string; value: unknown }>;
  inflight?: ChangeOperation;
  /** 다른 사람의 변경과 겹친 엔티티. value는 서버의 최신 값. */
  conflicts: Record<EntityKey, { revision: number; value: unknown }>;
  members: TripMembership[];
  ended?: LinkEnd;
  notice?: LinkNotice;
  lastSyncedAt?: string;
}

export interface SyncDeps {
  backend: SharedTripBackend;
  read: () => NotebookData | null;
  commit: (update: (data: NotebookData) => NotebookData) => Promise<void>;
  save: (link: SharedLink) => Promise<void>;
  newId: () => string;
  now: () => Date;
}

export type SyncOutcome = "synced" | "offline" | "ended" | "missing" | "error";

export interface PendingChange {
  key: EntityKey;
  baseRevision: number;
  value: unknown;
}

/** 보낼 변경. 충돌로 표시된 엔티티는 사용자가 고를 때까지 보내지 않는다. */
export function pendingChanges(link: SharedLink, entities: Entities): PendingChange[] {
  const keys = new Set([...Object.keys(link.base), ...Object.keys(entities)]);
  const out: PendingChange[] = [];
  for (const key of keys) {
    if (link.conflicts[key]) continue;
    const value = entities[key] ?? null;
    const base = link.base[key];
    if (hashOf(value) === (base?.hash ?? "null")) continue;
    out.push({ key, baseRevision: base?.revision ?? 0, value });
  }
  // 설정(동행자 목록)을 먼저 보내야 새 동행자를 쓰는 지출이 거부되지 않는다.
  const rank = (key: string) => (key === "settings:" ? 0 : key === "meta:" ? 1 : 2);
  return out.sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key));
}

function withBase(link: SharedLink, key: EntityKey, revision: number, value: unknown): SharedLink {
  const { [key]: _c, ...conflicts } = link.conflicts;
  return { ...link, conflicts, base: { ...link.base, [key]: { revision, hash: hashOf(value), value } } };
}

const MAX_PUSHES = 200;

export async function syncLink(start: SharedLink, deps: SyncDeps): Promise<{ link: SharedLink; outcome: SyncOutcome }> {
  let link = start;
  if (link.ended) return { link, outcome: "ended" };
  if (link.userId !== deps.backend.userId) return { link, outcome: "offline" };
  const data0 = deps.read();
  if (!data0 || !projectTrip(data0, link.localTripId, link.idSuffix)) return { link, outcome: "missing" };

  const end = async (why: LinkEnd) => {
    link = { ...link, ended: why, inflight: undefined };
    await deps.save(link);
    return { link, outcome: "ended" as const };
  };

  const revert = async (key: EntityKey, notice: LinkNotice) => {
    const base = link.base[key];
    await deps.commit((data) => applyEntities(data, link.localTripId, link.idSuffix ?? "", [{ key, value: base?.value ?? null }], deps.now()));
    link = { ...link, notice };
  };

  try {
    let pushes = 0;
    for (;;) {
      let op = link.inflight;
      if (!op) {
        const entities = projectTrip(deps.read()!, link.localTripId, link.idSuffix);
        if (!entities) return { link, outcome: "missing" };
        const next = pendingChanges(link, entities)[0];
        if (!next || pushes >= MAX_PUSHES) break;
        op = { operationId: deps.newId(), sharedTripId: link.sharedTripId, key: next.key, baseRevision: next.baseRevision, value: next.value };
        link = { ...link, inflight: op };
        await deps.save(link);
      }
      pushes += 1;
      const result = await deps.backend.push(op);
      link = { ...link, inflight: undefined };
      if (result.status === "applied") link = withBase(link, op.key, result.revision, op.value);
      else if (result.status === "conflict") {
        // 같은 내용으로 바뀌었으면 충돌이 아니다.
        if (hashOf(result.current.value) === hashOf(op.value)) link = withBase(link, op.key, result.current.revision, result.current.value);
        else link = { ...link, conflicts: { ...link.conflicts, [op.key]: { revision: result.current.revision, value: result.current.value } } };
      } else if (result.status === "forbidden") {
        if (result.reason !== "role") return await end(result.reason === "closed" ? "closed" : "removed");
        await revert(op.key, "reverted-role");
      } else await revert(op.key, "reverted-invalid");
      await deps.save(link);
    }

    const pulled = await deps.backend.pull(link.sharedTripId, link.cursor);
    const fresh = pulled.changes.filter((c) => c.revision > (link.base[c.key]?.revision ?? 0));
    let next = link;
    const apply: { key: EntityKey; value: unknown }[] = [];
    const decide = (data: NotebookData) => {
      const entities = projectTrip(data, link.localTripId, link.idSuffix) ?? {};
      next = link;
      apply.length = 0;
      for (const change of fresh) {
        const mine = entities[change.key] ?? null;
        const dirty = hashOf(mine) !== (link.base[change.key]?.hash ?? "null");
        if (dirty && hashOf(mine) !== hashOf(change.value)) {
          next = { ...next, conflicts: { ...next.conflicts, [change.key]: { revision: change.revision, value: change.value } } };
        } else {
          next = withBase(next, change.key, change.revision, change.value);
          if (hashOf(mine) !== hashOf(change.value)) apply.push({ key: change.key, value: change.value });
        }
      }
      return apply.length ? applyEntities(data, link.localTripId, link.idSuffix ?? "", apply, deps.now()) : data;
    };
    const current = deps.read();
    if (current && decide(current) !== current) {
      try {
        await deps.commit(decide);
      } catch {
        // 받은 내용이 이 기기 검사를 통과하지 못했다. cursor를 올리지 않고 다음에 다시 받는다.
        link = { ...link, notice: "apply-failed" };
        await deps.save(link);
        return { link, outcome: "error" };
      }
    }
    link = { ...next, cursor: pulled.revision, members: pulled.members, role: pulled.me.role, memberId: pulled.me.memberId, lastSyncedAt: deps.now().toISOString() };
    if (link.notice === "apply-failed") link = { ...link, notice: undefined };
    await deps.save(link);
    return { link, outcome: "synced" };
  } catch (error) {
    if (error instanceof HubError) {
      if (error.code === "closed") return await end("closed");
      if (error.code === "forbidden" || error.code === "not-found") return await end("removed");
      return { link, outcome: "error" };
    }
    // 네트워크 실패: 전송 중 작업(inflight)을 남겨 다음에 같은 operationId로 보낸다.
    await deps.save(link);
    return { link, outcome: "offline" };
  }
}

/** 충돌을 내 쪽으로: 서버 최신 revision을 기준으로 기기 내용을 다시 보낸다. */
export function keepMine(link: SharedLink, key: EntityKey): SharedLink {
  const conflict = link.conflicts[key];
  if (!conflict) return link;
  return withBase(link, key, conflict.revision, conflict.value);
}

/** 충돌을 상대 쪽으로: 서버 최신 값을 기기에 적는다. commit이 성공한 뒤 돌려준 링크를 저장한다. */
export async function takeTheirs(link: SharedLink, key: EntityKey, deps: Pick<SyncDeps, "commit" | "now">): Promise<SharedLink> {
  const conflict = link.conflicts[key];
  if (!conflict) return link;
  await deps.commit((data) => applyEntities(data, link.localTripId, link.idSuffix ?? "", [{ key, value: conflict.value }], deps.now()));
  return withBase(link, key, conflict.revision, conflict.value);
}

/** 개인 여행을 공유 여행으로 바꾼다. 같은 operationId로 다시 부르면 같은 공유 여행을 쓴다. */
export async function startSharing(input: { data: NotebookData; tripId: string; ownerMemberId: string; operationId: string }, deps: SyncDeps): Promise<SharedLink> {
  const entities = projectTrip(input.data, input.tripId);
  if (!entities) throw new HubError("not-found");
  const { sharedTripId } = await deps.backend.share({ operationId: input.operationId, ownerMemberId: input.ownerMemberId, entities });
  const link: SharedLink = { version: 1, localTripId: input.tripId, sharedTripId, memberId: input.ownerMemberId, userId: deps.backend.userId, role: "owner", cursor: 0, base: {}, conflicts: {}, members: [] };
  await deps.save(link);
  return (await syncLink(link, deps)).link;
}

/** 초대를 받아 참가하고 여행 사본을 기기에 만든다. */
export async function joinShared(
  input: { token: string; operationId: string; choice: { memberId: string } | { newName: string }; localTripId: string; idSuffix?: string },
  deps: SyncDeps,
): Promise<SharedLink> {
  const { sharedTripId, membership } = await deps.backend.join({ token: input.token, operationId: input.operationId, choice: input.choice });
  const pulled = await deps.backend.pull(sharedTripId, 0);
  const suffix = input.idSuffix ?? "";
  const live = pulled.changes.filter((c) => c.value !== null);
  await deps.commit((data) => {
    const next = applyEntities(data, input.localTripId, suffix, live, deps.now());
    return { ...next, library: { ...next.library, activeTripId: input.localTripId } };
  });
  let link: SharedLink = {
    version: 1, localTripId: input.localTripId, sharedTripId, memberId: membership.memberId, userId: deps.backend.userId, role: membership.role,
    ...(suffix ? { idSuffix: suffix } : {}), cursor: pulled.revision, base: {}, conflicts: {}, members: pulled.members, lastSyncedAt: deps.now().toISOString(),
  };
  for (const c of pulled.changes) link = withBase(link, c.key, c.revision, c.value);
  await deps.save(link);
  return link;
}

/** 화면 표시용 상태. */
export function linkSummary(link: SharedLink, data: NotebookData | null) {
  const entities = data ? projectTrip(data, link.localTripId, link.idSuffix) : null;
  return {
    pending: entities ? pendingChanges(link, entities).length + (link.inflight ? 1 : 0) : 0,
    conflicts: Object.keys(link.conflicts),
    activeMembers: link.members.filter((m) => m.status === "active"),
  };
}
