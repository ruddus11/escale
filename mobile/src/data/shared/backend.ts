import type {
  ChangeOperation,
  InvitePreview,
  InviteSummary,
  JoinChoice,
  PullResult,
  PushResult,
  TripMembership,
  TripRole,
} from "../../../../src/domain/sharing/types";
import type { Entities } from "./projection";

/**
 * 기기가 공유 여행 서버와 주고받는 통로. 한 인스턴스는 한 계정(actor)으로 동작한다.
 * 규칙 위반은 HubError, 네트워크 실패는 그 밖의 오류로 던진다(기기는 다음에 다시 보낸다).
 */
export interface SharedTripBackend {
  readonly kind: "device" | "supabase";
  readonly userId: string;
  share(input: { operationId: string; ownerMemberId: string; entities: Entities }): Promise<{ sharedTripId: string }>;
  createInvite(sharedTripId: string, role: Exclude<TripRole, "owner">): Promise<InviteSummary & { token: string }>;
  listInvites(sharedTripId: string): Promise<InviteSummary[]>;
  revokeInvite(sharedTripId: string, inviteId: string): Promise<void>;
  previewInvite(token: string): Promise<InvitePreview>;
  join(input: { token: string; operationId: string; choice: JoinChoice }): Promise<{ sharedTripId: string; membership: TripMembership }>;
  setRole(sharedTripId: string, memberId: string, role: Exclude<TripRole, "owner">): Promise<void>;
  removeMember(sharedTripId: string, memberId: string): Promise<void>;
  leave(sharedTripId: string): Promise<void>;
  closeTrip(sharedTripId: string): Promise<void>;
  push(op: ChangeOperation): Promise<PushResult>;
  pull(sharedTripId: string, cursor: number): Promise<PullResult>;
  /** 사진 바이트를 올리고 객체 이름을 돌려준다. 같은 photoId로 다시 올리면 같은 객체를 덮어쓴다. */
  uploadPhoto(sharedTripId: string, photoId: string, fileUri: string, mime: string): Promise<{ objectKey: string }>;
  /** 받은 사진을 화면에 띄울 주소. 없으면 null. */
  photoUri(sharedTripId: string, objectKey: string): Promise<string | null>;
}

/** 초대 링크. escale://join?t=<token> 앱 링크로 연다. */
export function inviteUrl(token: string): string {
  return `escale://join?t=${encodeURIComponent(token)}`;
}

export function inviteTokenFrom(url: string): string | null {
  const match = /^(?:escale|margin):\/\/join\/?\?(.*)$/.exec(url.trim());
  if (!match) return null;
  const token = new URLSearchParams(match[1]).get("t");
  return token && /^[A-Za-z0-9_-]{20,200}$/.test(token) ? token : null;
}
