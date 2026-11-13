// 함께 쓰는 여행(2단계)의 서버·기기 공통 형식. 개인 수첩 백업과 따로 둔다.

export type TripRole = "owner" | "editor" | "viewer";
/** left: 스스로 나감, removed: owner가 내보냄. 둘 다 서버 접근이 막힌다. */
export type MembershipStatus = "active" | "left" | "removed";

/** 공유 여행의 참가자. memberId는 돈 계산의 동행자 Member.id와 같다. */
export interface TripMembership {
  memberId: string;
  userId: string;
  role: TripRole;
  status: MembershipStatus;
  joinedAt: string;
}

/** 공유 여행을 나누는 단위. settings·meta는 한 개뿐이다. */
export type EntityType =
  | "settings"
  | "meta"
  | "page"
  | "packing"
  | "expense"
  | "contribution"
  | "payment"
  | "reservation"
  | "comment"
  | "photo";

export const ENTITY_TYPES: readonly EntityType[] = ["settings", "meta", "page", "packing", "expense", "contribution", "payment", "reservation", "comment", "photo"];

/** "page:<id>" 또는 "settings:" 형식. */
export type EntityKey = string;

/** value가 null이면 지워진 엔티티(지움 기록). */
export interface EntityState {
  key: EntityKey;
  revision: number;
  value: unknown;
}

/** 기기가 보내는 변경 하나. baseRevision 0은 새로 만들기다. */
export interface ChangeOperation {
  operationId: string;
  sharedTripId: string;
  key: EntityKey;
  baseRevision: number;
  /** null이면 지우기. */
  value: unknown;
}

export type PushResult =
  | { status: "applied"; revision: number }
  | { status: "conflict"; current: EntityState }
  | { status: "forbidden"; reason: HubDenial }
  | { status: "invalid" };

export type HubDenial = "not-member" | "role" | "closed";

export interface PullResult {
  revision: number;
  changes: EntityState[];
  members: TripMembership[];
  me: TripMembership;
}

export interface InviteSummary {
  inviteId: string;
  role: Exclude<TripRole, "owner">;
  createdAt: string;
  expiresAt: string;
}

export interface InvitePreview {
  sharedTripId: string;
  title: string;
  role: Exclude<TripRole, "owner">;
  /** 아직 아무 계정과 연결되지 않은 동행자. 참가자가 이 중 본인을 고른다. */
  claimable: { id: string; name: string }[];
}

export type JoinChoice = { memberId: string } | { newName: string };

/** 서버가 거부한 이유. 화면 문구는 기기에서 고른다. */
export class HubError extends Error {
  constructor(readonly code: HubErrorCode) {
    super(code);
  }
}

export type HubErrorCode =
  | "not-found"
  | "forbidden"
  | "invite-expired"
  | "invite-revoked"
  | "invite-invalid"
  | "member-claimed"
  | "member-missing"
  | "name-invalid"
  | "limit"
  | "invalid"
  | "owner-only"
  | "closed";

export function entityKey(type: EntityType, id = ""): EntityKey {
  return `${type}:${id}`;
}

export function parseEntityKey(key: EntityKey): { type: EntityType; id: string } | null {
  const at = key.indexOf(":");
  if (at < 0) return null;
  const type = key.slice(0, at) as EntityType;
  const id = key.slice(at + 1);
  if (!ENTITY_TYPES.includes(type)) return null;
  const single = type === "settings" || type === "meta";
  if (single ? id !== "" : !/^[A-Za-z0-9_~.-]{1,120}$/.test(id)) return null;
  return { type, id };
}
