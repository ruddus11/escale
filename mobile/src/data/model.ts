import { isDiaryMemory, type DiaryMemory } from "./diaryMemory";
import { isNotebookDesign, type NotebookDesign } from "./notebookDesign";
import { emptyTripLibrary } from "../../../src/domain/workspace/library";
import { isTripLibrary } from "../../../src/repositories/tripLibrarySchema";
import { isDateOnly } from "../../../src/repositories/schemaGuards";
import type { TripLibrary } from "../../../src/domain/workspace/types";
import { KeyedError } from "../i18n/errors";
import { STICKER_LIMIT, isDaySticker, type DaySticker } from "./stickers";
import { isDeletedTrips, type DeletedTrip } from "./notebookDelete";
import { ALBUM_LIMIT, COMMENT_LIMIT, isAlbumPhoto, isScheduleComment, validList, type AlbumPhoto, type ScheduleComment } from "./sharedContent";

export type PageKind = "plan" | "place" | "journal";
export interface PageEntry {
  id: string;
  tripId: string;
  kind: PageKind;
  title: string;
  date: string;
  body: string;
  address: string;
  done: boolean;
  /** 계획의 시작 시각 "HH:MM"(수첩 현지 시간). 없으면 시간 미정. */
  time?: string;
  /** 머무는 시간(분). 빈 시간과 다음 이동까지 여유를 계산할 때 쓴다. */
  minutes?: number;
  /** 장소 찾기로 고른 Google 장소 ID. 지도 위치는 이 ID로 다시 받는다(좌표는 수첩에 넣지 않는다). */
  placeId?: string;
  /** 일정을 만든 동행자 Member.id. 작성자 필터에 쓴다. 예전 일정에는 없다. */
  createdByMemberId?: string;
}
export interface PackingItem { id:string; tripId:string; title:string; done:boolean; }
export interface NotebookData {
  diaryMemories?: DiaryMemory[];
  version: 1;
  library: TripLibrary;
  pages: PageEntry[];
  packing?: PackingItem[];
  designs?: Record<string, NotebookDesign>;
  /** 그날의 장 스티커. 사진 파일은 기기 저장소에만 있고 여기는 상대 파일 이름만 담는다. */
  stickers?: DaySticker[];
  /** 지운 수첩 기록. 계정 백업을 합칠 때 다른 쪽 사본이 되살아나지 않게 한다. */
  deletedTrips?: DeletedTrip[];
  /** 일정 댓글. */
  comments?: ScheduleComment[];
  /** 여행 앨범의 사진 정보. 파일은 기기 album/ 폴더와 공유 저장소에 있다. */
  album?: AlbumPhoto[];
}
export function emptyNotebook(): NotebookData {
  return { version: 1, library: emptyTripLibrary(), pages: [] };
}
// 예전 백업에도 있는 필수 칸. time·minutes·placeId는 나중에 더한 선택 칸이다.
const fields = [
  "id",
  "tripId",
  "kind",
  "title",
  "date",
  "body",
  "address",
  "done",
];
const optionalFields = ["time", "minutes", "placeId", "createdByMemberId"];
// Google 장소 ID 형식. 예: "ChIJu46S-ZZhLxMROG5lkwZ3D7k"
const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export function parseNotebook(json: string): NotebookData {
  if (json.length > 5_000_000)
    throw new KeyedError("backup.tooBig");
  const value = JSON.parse(json);
  // 웹의 최신 형식 3 백업을 명시적으로 가져올 수 있다.
  if (isTripLibrary(value)) return { version: 1, library: value, pages: [] };
  if (
    !value ||
    value.version !== 1 ||
    Object.keys(value).some(
      (k) => !["version", "library", "pages", "designs", "packing", "stickers", "deletedTrips", "diaryMemories", "comments", "album"].includes(k),
    ) ||
    !isTripLibrary(value.library) ||
    !Array.isArray(value.pages) ||
    value.pages.length > 5000
  )
    throw new KeyedError("backup.invalid");
  if (value.diaryMemories !== undefined && (!Array.isArray(value.diaryMemories) || value.diaryMemories.length > 5000 || value.diaryMemories.some((m: unknown) => !isDiaryMemory(m) || !value.library.trips.some((t: {id:string}) => t.id === m.tripId)))) throw new KeyedError("backup.invalid");
  if (value.designs !== undefined && (
    !value.designs || typeof value.designs !== "object" || Array.isArray(value.designs)
    || Object.entries(value.designs).some(([id, design]) =>
      !value.library.trips.some((t: { id: string }) => t.id === id) || !isNotebookDesign(design))
  )) throw new KeyedError("backup.design");
  if (value.deletedTrips !== undefined && !isDeletedTrips(value.deletedTrips)) throw new KeyedError("backup.invalid");
  if (value.comments !== undefined || value.album !== undefined) {
    const tripIds = new Set<string>(value.library.trips.map((t: { id: string }) => t.id));
    if (value.comments !== undefined && !validList(value.comments, COMMENT_LIMIT, (c): c is ScheduleComment => isScheduleComment(c, tripIds))) throw new KeyedError("backup.invalid");
    if (value.album !== undefined && !validList(value.album, ALBUM_LIMIT, (p): p is AlbumPhoto => isAlbumPhoto(p, tripIds))) throw new KeyedError("backup.invalid");
  }
  if (value.packing !== undefined) {
    if (!Array.isArray(value.packing) || value.packing.length > 10000) throw new KeyedError("backup.packing");
    const packingIds = new Set<string>();
    for (const item of value.packing) {
      if (!item || Object.keys(item).length !== 4 || Object.keys(item).some(k=>!["id","tripId","title","done"].includes(k))
        || typeof item.id !== "string" || !item.id || item.id.length>120 || packingIds.has(item.id)
        || typeof item.title !== "string" || !item.title.trim() || item.title.length>120 || typeof item.done !== "boolean"
        || !value.library.trips.some((t:{id:string})=>t.id===item.tripId)) throw new KeyedError("backup.packingItem");
      packingIds.add(item.id);
    }
  }
  if (value.stickers !== undefined) {
    if (!Array.isArray(value.stickers) || value.stickers.length > STICKER_LIMIT) throw new KeyedError("backup.stickers");
    const tripIds = new Set<string>(value.library.trips.map((t: { id: string }) => t.id));
    const stickerIds = new Set<string>();
    // 새 버전에서 온 모르는 종류는 건너뛰되, 아는 종류의 손상은 그대로 오류로 알린다.
    value.stickers = value.stickers.filter((sticker: unknown) => {
      if (!sticker || typeof sticker !== "object" || Array.isArray(sticker)) return true;
      const kind = (sticker as { kind?: unknown }).kind;
      return kind === undefined || kind === "photo" || typeof kind !== "string";
    });
    for (const sticker of value.stickers) {
      if (!isDaySticker(sticker, tripIds) || stickerIds.has(sticker.id)) throw new KeyedError("backup.stickers");
      stickerIds.add(sticker.id);
    }
  }
  const ids = new Set<string>();
  for (const p of value.pages) {
    if (
      !p ||
      fields.some((k) => !(k in p)) ||
      Object.keys(p).some((k) => !fields.includes(k) && !optionalFields.includes(k)) ||
      (p.time !== undefined && (typeof p.time !== "string" || !TIME.test(p.time))) ||
      (p.minutes !== undefined && (!Number.isInteger(p.minutes) || p.minutes < 1 || p.minutes > 1440)) ||
      (p.placeId !== undefined && (typeof p.placeId !== "string" || !PLACE_ID.test(p.placeId))) ||
      (p.createdByMemberId !== undefined && (typeof p.createdByMemberId !== "string" || !p.createdByMemberId || p.createdByMemberId.length > 120)) ||
      typeof p.id !== "string" ||
      !p.id ||
      p.id.length > 120 ||
      ids.has(p.id) ||
      !value.library.trips.some((t: { id: string }) => t.id === p.tripId) ||
      !["plan", "place", "journal"].includes(p.kind) ||
      !isDateOnly(p.date) ||
      typeof p.done !== "boolean" ||
      typeof p.title !== "string" ||
      !p.title.trim() ||
      p.title.length > 120 ||
      typeof p.body !== "string" ||
      p.body.length > 2000 ||
      typeof p.address !== "string" ||
      p.address.length > 300
    )
      throw new KeyedError("backup.pages");
    ids.add(p.id);
  }
  return value;
}
