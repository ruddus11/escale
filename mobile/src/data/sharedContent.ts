import { isDateOnly } from "../../../src/repositories/schemaGuards";
import { isPhotoFileName } from "./photoSweep";

// 일정 댓글(F16)과 여행 앨범(F18). 혼자 쓰는 여행에서도 기기에 남고, 공유 여행에서는 엔티티로 동기화된다.

export interface ScheduleComment {
  id: string;
  tripId: string;
  pageId: string;
  /** 돈 계산의 동행자 Member.id. */
  authorMemberId: string;
  body: string;
  createdAt: string;
  editedAt?: string;
}

export interface AlbumPhoto {
  id: string;
  tripId: string;
  /** 연결한 일정. 없으면 날짜에만 붙는다. */
  pageId?: string;
  date: string;
  authorMemberId: string;
  /** 이 기기 album/ 폴더의 파일 이름. 다른 사람이 올린 사진은 받기 전까지 없다. */
  file?: string;
  /** 공유 저장소의 객체 이름. 업로드가 끝나야 생긴다. */
  objectKey?: string;
  takenAt?: string;
  createdAt: string;
}

export const COMMENT_LIMIT = 20_000;
export const COMMENT_LENGTH = 1000;
export const ALBUM_LIMIT = 5000;

const ID = (v: unknown) => typeof v === "string" && /^[A-Za-z0-9_~.-]{1,120}$/.test(v);
const ISO = (v: unknown) => typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));
const OBJECT_KEY = /^[A-Za-z0-9][A-Za-z0-9/_.-]{0,299}$/;

function exactKeys(value: object, required: string[], optional: string[]) {
  const keys = Object.keys(value);
  return required.every((k) => keys.includes(k)) && keys.every((k) => required.includes(k) || optional.includes(k));
}

export function isScheduleComment(value: unknown, tripIds: ReadonlySet<string>): value is ScheduleComment {
  const c = value as ScheduleComment;
  return !!c && typeof c === "object" && !Array.isArray(c)
    && exactKeys(c, ["id", "tripId", "pageId", "authorMemberId", "body", "createdAt"], ["editedAt"])
    && ID(c.id) && tripIds.has(c.tripId) && ID(c.pageId) && ID(c.authorMemberId)
    && typeof c.body === "string" && !!c.body.trim() && c.body.length <= COMMENT_LENGTH
    && ISO(c.createdAt) && (c.editedAt === undefined || ISO(c.editedAt));
}

export function isAlbumPhoto(value: unknown, tripIds: ReadonlySet<string>): value is AlbumPhoto {
  const p = value as AlbumPhoto;
  return !!p && typeof p === "object" && !Array.isArray(p)
    && exactKeys(p, ["id", "tripId", "date", "authorMemberId", "createdAt"], ["pageId", "file", "objectKey", "takenAt"])
    && ID(p.id) && tripIds.has(p.tripId) && (p.pageId === undefined || ID(p.pageId)) && isDateOnly(p.date) && ID(p.authorMemberId)
    && (p.file === undefined || (typeof p.file === "string" && isPhotoFileName(p.file)))
    && (p.objectKey === undefined || (typeof p.objectKey === "string" && OBJECT_KEY.test(p.objectKey) && !p.objectKey.includes("..")))
    && (p.file !== undefined || p.objectKey !== undefined)
    && (p.takenAt === undefined || ISO(p.takenAt)) && ISO(p.createdAt);
}

/** 목록 전체 검사. 같은 id가 두 번 있으면 거부한다. */
export function validList<T extends { id: string }>(list: unknown, limit: number, check: (v: unknown) => v is T): list is T[] {
  if (!Array.isArray(list) || list.length > limit) return false;
  const ids = new Set<string>();
  for (const item of list) {
    if (!check(item) || ids.has(item.id)) return false;
    ids.add(item.id);
  }
  return true;
}

/** 일정 하나의 댓글. 오래된 것부터. */
export function commentsFor(comments: readonly ScheduleComment[] | undefined, pageId: string): ScheduleComment[] {
  return (comments ?? []).filter((c) => c.pageId === pageId).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/** 댓글 지우기 권한: 작성자 본인 또는 여행 owner. 공유하지 않는 여행은 기기 주인이 모두 지운다. */
export function canDeleteComment(comment: ScheduleComment, me: string, isOwner: boolean): boolean {
  return comment.authorMemberId === me || isOwner;
}
