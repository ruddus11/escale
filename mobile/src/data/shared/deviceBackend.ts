import type { TripHub } from "../../../../src/domain/sharing/hub";
import type { SharedTripBackend } from "./backend";

// 기기 안 허브를 서버처럼 쓰는 통로. 개발 빌드에서 한 기기로 두 멤버 흐름을 확인하고, 테스트에서 두 기기를 흉내 낸다.
// 실제 다른 기기와는 공유되지 않는다. 사진 바이트 저장은 기기별 구현을 받는다.

export interface DeviceMedia {
  upload(sharedTripId: string, photoId: string, fileUri: string, mime: string): Promise<{ objectKey: string }>;
  uri(sharedTripId: string, objectKey: string): Promise<string | null>;
}

export function deviceBackend(hub: TripHub, userId: string, media?: DeviceMedia): SharedTripBackend {
  const run = async <T,>(fn: () => T): Promise<T> => fn();
  return {
    kind: "device",
    userId,
    share: (input) => run(() => hub.shareTrip(userId, input)),
    createInvite: (id, role) => run(() => hub.createInvite(userId, id, role)),
    listInvites: (id) => run(() => hub.listInvites(userId, id)),
    revokeInvite: (id, inviteId) => run(() => hub.revokeInvite(userId, id, inviteId)),
    previewInvite: (token) => run(() => hub.previewInvite(token)),
    join: (input) => run(() => hub.join(userId, input)),
    setRole: (id, memberId, role) => run(() => hub.setRole(userId, id, memberId, role)),
    removeMember: (id, memberId) => run(() => hub.removeMember(userId, id, memberId)),
    leave: (id) => run(() => hub.leave(userId, id)),
    closeTrip: (id) => run(() => hub.closeTrip(userId, id)),
    push: (op) => run(() => hub.push(userId, op)),
    pull: (id, cursor) => run(() => hub.pull(userId, id, cursor)),
    async uploadPhoto(id, photoId, fileUri, mime) {
      // 멤버가 아니면 올리지 않는다(서버 저장소 정책과 같다).
      hub.pull(userId, id, Number.MAX_SAFE_INTEGER);
      if (!media) throw new Error("media unavailable");
      return media.upload(id, photoId, fileUri, mime);
    },
    async photoUri(id, objectKey) {
      hub.pull(userId, id, Number.MAX_SAFE_INTEGER);
      return media ? media.uri(id, objectKey) : null;
    },
  };
}
