import type { EntityType, TripRole } from "./types";

// 공유 여행의 권한 규칙. 서버 허브와 화면이 같은 함수를 쓴다. 화면에서 숨기는 것만으로 권한을 처리하지 않는다.
// owner=초대·역할·여행 설정, editor=일정·돈·준비물·예약·사진, viewer=조회·댓글.

export type SharingAction = "invite" | "manage-members" | "edit-settings" | "edit-content" | "comment" | "add-photo";

export function can(role: TripRole, action: SharingAction): boolean {
  if (role === "owner") return true;
  if (role === "editor") return action === "edit-content" || action === "comment" || action === "add-photo";
  return action === "comment";
}

/** 엔티티 쓰기 권한. 댓글·사진은 작성자 본인 확인이 따로 붙는다. prev/next는 null이면 없음·지우기. */
export function canWriteEntity(
  role: TripRole,
  memberId: string,
  type: EntityType,
  prev: unknown,
  next: unknown,
): boolean {
  if (type === "settings") return can(role, "edit-settings");
  if (type === "comment" || type === "photo") {
    const author = (value: unknown) => (value && typeof value === "object" ? (value as { authorMemberId?: unknown }).authorMemberId : undefined);
    if (type === "photo" && next !== null && !can(role, "add-photo")) return false;
    if (type === "comment" && next !== null && !can(role, "comment")) return false;
    // 새로 만들기: 작성자가 본인이어야 한다.
    if (prev === null) return next !== null && author(next) === memberId;
    // 지우기: 작성자 또는 owner.
    if (next === null) return author(prev) === memberId || role === "owner";
    // 고치기: 작성자만, 작성자를 바꿀 수 없다.
    return author(prev) === memberId && author(next) === memberId;
  }
  if (type === "page" && next && typeof next === "object") {
    const by = (value: unknown) => (value && typeof value === "object" ? (value as { createdByMemberId?: unknown }).createdByMemberId : undefined);
    // 작성자는 만들 때 본인으로만 적고, 고칠 때는 바꾸지 않는다.
    if (prev === null ? by(next) !== undefined && by(next) !== memberId : by(next) !== by(prev)) return false;
  }
  return can(role, "edit-content");
}
