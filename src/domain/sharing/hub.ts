import { canWriteEntity, can } from "./permissions";
import { sha256Hex } from "./sha256";
import {
  HubError,
  parseEntityKey,
  type ChangeOperation,
  type EntityKey,
  type EntityState,
  type InvitePreview,
  type InviteSummary,
  type JoinChoice,
  type PullResult,
  type PushResult,
  type TripMembership,
  type TripRole,
} from "./types";

// 공유 여행 서버의 규칙(허브). 저장은 JSON 하나라 기기 안 허브와 테스트가 그대로 쓰고,
// Supabase 마이그레이션(supabase/migrations/*_shared_trips.sql)의 RPC가 같은 규칙을 따른다.
// 모든 변경은 사본에 적용한 뒤 성공했을 때만 바꿔 끼운다. 중간에 거부되면 아무것도 바뀌지 않는다.

export const INVITE_TTL_MS = 7 * 86_400_000;
export const LIMITS = { entities: 20_000, members: 20, invites: 20, entityBytes: 64_000, operations: 50_000, nameLength: 40 } as const;

interface StoredInvite {
  id: string;
  tokenHash: string;
  role: Exclude<TripRole, "owner">;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface HubTrip {
  id: string;
  createdAt: string;
  revision: number;
  closed?: boolean;
  entities: Record<EntityKey, { revision: number; value: unknown }>;
  members: TripMembership[];
  invites: StoredInvite[];
}

export interface HubState {
  trips: Record<string, HubTrip>;
  /** 처리한 operationId와 결과. 같은 요청을 다시 보내면 같은 결과를 돌려준다. */
  operations: Record<string, { userId: string; result: unknown }>;
}

export function emptyHubState(): HubState {
  return { trips: {}, operations: {} };
}

export interface HubOptions {
  state?: HubState;
  save?: (state: HubState) => void;
  now: () => Date;
  newId: () => string;
  /** 초대 토큰. 32바이트 이상 난수의 base64url. */
  newToken: () => string;
}

interface SettingsShape {
  title: string;
  members: { id: string; name: string }[];
}

function isSettings(value: unknown): value is SettingsShape {
  const v = value as SettingsShape;
  return !!v && typeof v === "object" && typeof v.title === "string" && Array.isArray(v.members)
    && v.members.every((m) => !!m && typeof m.id === "string" && typeof m.name === "string");
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export function createTripHub(options: HubOptions) {
  let state = options.state ?? emptyHubState();
  const iso = () => options.now().toISOString();

  function mutate<T>(fn: (draft: HubState) => T): T {
    const draft = clone(state);
    const result = fn(draft);
    state = draft;
    options.save?.(state);
    return result;
  }

  function remember<T>(draft: HubState, operationId: string, userId: string, result: T): T {
    if (Object.keys(draft.operations).length >= LIMITS.operations) {
      // 가장 오래된 기록부터 비운다. 이 정도 지난 재전송은 기준 revision 비교로 충돌이 된다.
      const oldest = Object.keys(draft.operations).slice(0, LIMITS.operations / 10);
      for (const id of oldest) delete draft.operations[id];
    }
    draft.operations[operationId] = { userId, result };
    return result;
  }

  function replay<T>(operationId: string, userId: string): { hit: true; result: T } | { hit: false } {
    const done = state.operations[operationId];
    if (!done) return { hit: false };
    if (done.userId !== userId) throw new HubError("invalid");
    return { hit: true, result: clone(done.result) as T };
  }

  function tripOf(draft: HubState, id: string): HubTrip {
    const trip = draft.trips[id];
    if (!trip) throw new HubError("not-found");
    return trip;
  }

  function activeMember(trip: HubTrip, userId: string): TripMembership {
    const me = trip.members.find((m) => m.userId === userId && m.status === "active");
    if (!me) throw new HubError("forbidden");
    if (trip.closed) throw new HubError("closed");
    return me;
  }

  function settingsOf(trip: HubTrip): SettingsShape {
    const value = trip.entities["settings:"]?.value;
    if (!isSettings(value)) throw new HubError("invalid");
    return value;
  }

  function validValue(trip: HubTrip, key: EntityKey, value: unknown): boolean {
    const parsed = parseEntityKey(key);
    if (!parsed) return false;
    if (value === null) return parsed.type !== "settings" && parsed.type !== "meta";
    if (typeof value !== "object" || Array.isArray(value)) return false;
    if (JSON.stringify(value).length > LIMITS.entityBytes) return false;
    if (parsed.id && (value as { id?: unknown }).id !== parsed.id) return false;
    if (parsed.type === "settings") {
      if (!isSettings(value) || !value.title.trim()) return false;
      // 계정과 연결된 동행자는 여행 설정에서 뺄 수 없다(돈 기록과 멤버 연결이 끊긴다).
      const ids = new Set(value.members.map((m) => m.id));
      if (trip.members.some((m) => m.status === "active" && !ids.has(m.memberId))) return false;
    }
    if (!trip.entities[key] && Object.keys(trip.entities).length >= LIMITS.entities) return false;
    return true;
  }

  function findInvite(token: string) {
    const hash = sha256Hex(token);
    for (const trip of Object.values(state.trips)) {
      const invite = trip.invites.find((i) => i.tokenHash === hash);
      if (invite) return { trip, invite };
    }
    throw new HubError("invite-invalid");
  }

  function checkInvite(trip: HubTrip, invite: StoredInvite) {
    if (trip.closed) throw new HubError("closed");
    if (invite.revokedAt) throw new HubError("invite-revoked");
    if (Date.parse(invite.expiresAt) <= options.now().getTime()) throw new HubError("invite-expired");
  }

  const claimable = (trip: HubTrip) => {
    const held = new Set(trip.members.filter((m) => m.status === "active").map((m) => m.memberId));
    return settingsOf(trip).members.filter((m) => !held.has(m.id)).map((m) => ({ id: m.id, name: m.name }));
  };

  return {
    /** 개인 여행 하나를 공유 공간에 복사한다. 같은 operationId는 같은 공유 여행을 돌려준다. */
    shareTrip(userId: string, input: { operationId: string; ownerMemberId: string; entities: Record<EntityKey, unknown> }): { sharedTripId: string; revision: number } {
      const again = replay<{ sharedTripId: string; revision: number }>(input.operationId, userId);
      if (again.hit) return again.result;
      return mutate((draft) => {
        const trip: HubTrip = { id: options.newId(), createdAt: iso(), revision: 0, entities: {}, members: [], invites: [] };
        const keys = Object.keys(input.entities);
        if (keys.length > LIMITS.entities) throw new HubError("limit");
        for (const key of keys) {
          const value = input.entities[key];
          if (value === null || !validValue(trip, key, value)) throw new HubError("invalid");
          trip.revision += 1;
          trip.entities[key] = { revision: trip.revision, value };
        }
        const settings = settingsOf(trip);
        if (!settings.members.some((m) => m.id === input.ownerMemberId)) throw new HubError("member-missing");
        trip.members.push({ memberId: input.ownerMemberId, userId, role: "owner", status: "active", joinedAt: iso() });
        draft.trips[trip.id] = trip;
        return remember(draft, input.operationId, userId, { sharedTripId: trip.id, revision: trip.revision });
      });
    },

    createInvite(userId: string, sharedTripId: string, role: Exclude<TripRole, "owner">, ttlMs = INVITE_TTL_MS): InviteSummary & { token: string } {
      return mutate((draft) => {
        const trip = tripOf(draft, sharedTripId);
        const me = activeMember(trip, userId);
        if (!can(me.role, "invite")) throw new HubError("owner-only");
        const now = options.now().getTime();
        const live = trip.invites.filter((i) => !i.revokedAt && Date.parse(i.expiresAt) > now);
        if (live.length >= LIMITS.invites) throw new HubError("limit");
        if (ttlMs <= 0 || ttlMs > 30 * 86_400_000) throw new HubError("invalid");
        const token = options.newToken();
        const invite: StoredInvite = { id: options.newId(), tokenHash: sha256Hex(token), role, createdBy: userId, createdAt: iso(), expiresAt: new Date(now + ttlMs).toISOString() };
        // 만료·회수된 초대 기록은 오래 두지 않는다.
        trip.invites = [...live, invite];
        return { inviteId: invite.id, role, createdAt: invite.createdAt, expiresAt: invite.expiresAt, token };
      });
    },

    listInvites(userId: string, sharedTripId: string): InviteSummary[] {
      const trip = tripOf(state, sharedTripId);
      const me = activeMember(trip, userId);
      if (!can(me.role, "invite")) throw new HubError("owner-only");
      const now = options.now().getTime();
      return trip.invites
        .filter((i) => !i.revokedAt && Date.parse(i.expiresAt) > now)
        .map((i) => ({ inviteId: i.id, role: i.role, createdAt: i.createdAt, expiresAt: i.expiresAt }));
    },

    revokeInvite(userId: string, sharedTripId: string, inviteId: string): void {
      mutate((draft) => {
        const trip = tripOf(draft, sharedTripId);
        const me = activeMember(trip, userId);
        if (!can(me.role, "invite")) throw new HubError("owner-only");
        const invite = trip.invites.find((i) => i.id === inviteId);
        if (!invite) throw new HubError("not-found");
        invite.revokedAt ??= iso();
      });
    },

    previewInvite(token: string): InvitePreview {
      const { trip, invite } = findInvite(token);
      checkInvite(trip, invite);
      return { sharedTripId: trip.id, title: settingsOf(trip).title, role: invite.role, claimable: claimable(trip) };
    },

    /** 초대로 참가한다. 이미 참가한 계정이면 기존 멤버를 그대로 돌려준다. */
    join(userId: string, input: { token: string; operationId: string; choice: JoinChoice }): { sharedTripId: string; membership: TripMembership } {
      const again = replay<{ sharedTripId: string; membership: TripMembership }>(input.operationId, userId);
      if (again.hit) return again.result;
      return mutate((draft) => {
        const found = (() => {
          const hash = sha256Hex(input.token);
          for (const trip of Object.values(draft.trips)) {
            const invite = trip.invites.find((i) => i.tokenHash === hash);
            if (invite) return { trip, invite };
          }
          throw new HubError("invite-invalid");
        })();
        const { trip, invite } = found;
        const current = trip.members.find((m) => m.userId === userId);
        if (current?.status === "active" && !trip.closed) return remember(draft, input.operationId, userId, { sharedTripId: trip.id, membership: current });
        checkInvite(trip, invite);
        const settings = settingsOf(trip);
        let memberId: string;
        if ("memberId" in input.choice) {
          memberId = input.choice.memberId;
          if (!settings.members.some((m) => m.id === memberId)) throw new HubError("member-missing");
          if (trip.members.some((m) => m.memberId === memberId && m.status === "active")) throw new HubError("member-claimed");
        } else {
          const name = input.choice.newName.trim();
          if (!name || name.length > LIMITS.nameLength) throw new HubError("name-invalid");
          if (settings.members.length >= LIMITS.members) throw new HubError("limit");
          memberId = options.newId();
          const next = { ...settings, members: [...settings.members, { id: memberId, name }] };
          trip.revision += 1;
          trip.entities["settings:"] = { revision: trip.revision, value: next };
        }
        if (trip.members.filter((m) => m.status === "active").length >= LIMITS.members) throw new HubError("limit");
        const membership: TripMembership = { memberId, userId, role: invite.role, status: "active", joinedAt: iso() };
        trip.members = [...trip.members.filter((m) => m.userId !== userId), membership];
        return remember(draft, input.operationId, userId, { sharedTripId: trip.id, membership });
      });
    },

    setRole(userId: string, sharedTripId: string, memberId: string, role: Exclude<TripRole, "owner">): void {
      mutate((draft) => {
        const trip = tripOf(draft, sharedTripId);
        const me = activeMember(trip, userId);
        if (!can(me.role, "manage-members")) throw new HubError("owner-only");
        const target = trip.members.find((m) => m.memberId === memberId && m.status === "active");
        if (!target) throw new HubError("not-found");
        if (target.role === "owner") throw new HubError("invalid");
        target.role = role;
      });
    },

    removeMember(userId: string, sharedTripId: string, memberId: string): void {
      mutate((draft) => {
        const trip = tripOf(draft, sharedTripId);
        const me = activeMember(trip, userId);
        if (!can(me.role, "manage-members")) throw new HubError("owner-only");
        const target = trip.members.find((m) => m.memberId === memberId && m.status === "active");
        if (!target) throw new HubError("not-found");
        if (target.role === "owner") throw new HubError("invalid");
        target.status = "removed";
      });
    },

    /** owner가 아닌 멤버가 나간다. 돈 계산의 동행자 기록은 남는다. */
    leave(userId: string, sharedTripId: string): void {
      mutate((draft) => {
        const trip = tripOf(draft, sharedTripId);
        const me = activeMember(trip, userId);
        if (me.role === "owner") throw new HubError("invalid");
        trip.members.find((m) => m.userId === userId)!.status = "left";
      });
    },

    /** owner가 공유를 끝낸다. 모든 멤버의 서버 접근이 막히고 각 기기의 사본은 개인 여행으로 남는다. */
    closeTrip(userId: string, sharedTripId: string): void {
      mutate((draft) => {
        const trip = tripOf(draft, sharedTripId);
        const me = activeMember(trip, userId);
        if (me.role !== "owner") throw new HubError("owner-only");
        trip.closed = true;
        trip.invites = [];
      });
    },

    push(userId: string, op: ChangeOperation): PushResult {
      // 다른 계정이 쓴 operationId는 결과를 알려 주지 않고 거부한다.
      if (state.operations[op.operationId] && state.operations[op.operationId].userId !== userId) return { status: "invalid" };
      const again = replay<PushResult>(op.operationId, userId);
      if (again.hit) return again.result;
      const trip = state.trips[op.sharedTripId];
      if (!trip) return { status: "forbidden", reason: "not-member" };
      if (trip.closed) return { status: "forbidden", reason: "closed" };
      const me = trip.members.find((m) => m.userId === userId && m.status === "active");
      if (!me) return { status: "forbidden", reason: "not-member" };
      const parsed = parseEntityKey(op.key);
      if (!parsed || !Number.isInteger(op.baseRevision) || op.baseRevision < 0 || op.value === undefined) return { status: "invalid" };
      const current = trip.entities[op.key];
      const currentRevision = current?.revision ?? 0;
      // 결과를 기록하지 않는 거부(충돌·권한)는 같은 operationId로 다시 보내면 다시 판정한다.
      if (op.baseRevision !== currentRevision) return { status: "conflict", current: { key: op.key, revision: currentRevision, value: clone(current?.value ?? null) } };
      const prev = current?.value ?? null;
      if (!validValue(trip, op.key, op.value)) return { status: "invalid" };
      if (!canWriteEntity(me.role, me.memberId, parsed.type, prev, op.value)) return { status: "forbidden", reason: "role" };
      return mutate((draft) => {
        const t = draft.trips[op.sharedTripId];
        if (prev === null && op.value === null) return remember<PushResult>(draft, op.operationId, userId, { status: "applied", revision: currentRevision });
        t.revision += 1;
        t.entities[op.key] = { revision: t.revision, value: clone(op.value) };
        return remember<PushResult>(draft, op.operationId, userId, { status: "applied", revision: t.revision });
      });
    },

    /** cursor 다음의 변경과 멤버 목록. 활성 멤버만 읽을 수 있다. */
    pull(userId: string, sharedTripId: string, cursor: number): PullResult {
      const trip = state.trips[sharedTripId];
      if (!trip) throw new HubError("forbidden");
      const me = activeMember(trip, userId);
      const changes: EntityState[] = Object.entries(trip.entities)
        .filter(([, e]) => e.revision > cursor)
        .sort(([, a], [, b]) => a.revision - b.revision)
        .map(([key, e]) => ({ key, revision: e.revision, value: clone(e.value) }));
      return { revision: trip.revision, changes, members: clone(trip.members), me: clone(me) };
    },

    /** 테스트·기기 안 허브 저장용. */
    snapshot(): HubState {
      return clone(state);
    },
  };
}

export type TripHub = ReturnType<typeof createTripHub>;
