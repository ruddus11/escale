import { removeTrip } from "../../../src/domain/workspace/library";
import type { NotebookData } from "./model";

// 수첩 한 권을 지울 때의 순수 계산. 파일·기기 설정 정리는 photoFiles가 한다.
// 계정 동기화는 수첩 전체를 한 덩어리로 주고받아서, 지운 수첩은 다음 업로드에서 계정에서도 사라진다.
// 다만 충돌을 "둘 다 남기기"로 합치면 다른 쪽에 남은 사본이 되살아나므로, 지운 수첩 id를 삭제 기록으로 남긴다.

export interface DeletedTrip {
  id: string;
  /** 지운 시각(ISO). 이보다 나중에 고친 수첩은 다른 기기에서 다시 쓴 것으로 보고 남긴다. */
  deletedAt: string;
}

/** 삭제 기록 최대 개수. 수첩은 최대 50권이라 넉넉하다. 넘치면 오래된 기록부터 버린다. */
export const DELETED_TRIP_LIMIT = 200;

/** 수첩별로 기기 설정(today:)에 두는 값의 접두어. 키는 "<접두어><tripId>". */
export const TRIP_SETTING_PREFIXES = ["hero:", "dayPhotos:", "taste:", "dismissed:", "autofill:"] as const;

export const tripSettingKeys = (tripId: string) => TRIP_SETTING_PREFIXES.map((prefix) => `${prefix}${tripId}`);

/** 속지·준비물·스티커 편집 시각도 충돌 판정에 반영한다. */
export function touchNotebookTrip(data: NotebookData, tripId: string, now: Date): NotebookData {
  const updatedAt = now.toISOString();
  return {
    ...data,
    library: {
      ...data.library,
      updatedAt,
      trips: data.library.trips.map((trip) => trip.id === tripId ? { ...trip, updatedAt } : trip),
    },
  };
}

export function isDeletedTrips(value: unknown): value is DeletedTrip[] {
  return (
    Array.isArray(value) &&
    value.length <= DELETED_TRIP_LIMIT &&
    value.every(
      (item) =>
        !!item &&
        typeof item === "object" &&
        Object.keys(item).length === 2 &&
        typeof item.id === "string" &&
        !!item.id &&
        item.id.length <= 120 &&
        typeof item.deletedAt === "string" &&
        !Number.isNaN(Date.parse(item.deletedAt)),
    )
  );
}

/** 같은 수첩은 늦게 지운 기록 하나만 남기고, 최근 기록부터 한도만큼 둔다. */
export function mergeDeletedTrips(...lists: (readonly DeletedTrip[] | undefined)[]): DeletedTrip[] {
  const latest = new Map<string, DeletedTrip>();
  for (const item of lists.flatMap((list) => list ?? [])) {
    const seen = latest.get(item.id);
    if (!seen || Date.parse(item.deletedAt) > Date.parse(seen.deletedAt)) latest.set(item.id, item);
  }
  return [...latest.values()]
    .sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt))
    .slice(0, DELETED_TRIP_LIMIT);
}

/** 수첩과 그 수첩에 딸린 속지·준비물·표지·스티커를 빼고 삭제 기록을 더한다. */
export function deleteNotebook(data: NotebookData, tripId: string, now: Date): NotebookData {
  const stamp = now.toISOString();
  const { [tripId]: _design, ...designs } = data.designs ?? {};
  const packing = (data.packing ?? []).filter((item) => item.tripId !== tripId);
  const stickers = (data.stickers ?? []).filter((sticker) => sticker.tripId !== tripId);
  const comments = (data.comments ?? []).filter((c) => c.tripId !== tripId);
  const album = (data.album ?? []).filter((p) => p.tripId !== tripId);
  const { designs: _d, packing: _p, stickers: _s, deletedTrips: _t, comments: _c, album: _a, ...rest } = data;
  return {
    ...rest,
    library: removeTrip(data.library, tripId, stamp),
    pages: data.pages.filter((page) => page.tripId !== tripId),
    ...(packing.length ? { packing } : {}),
    ...(Object.keys(designs).length ? { designs } : {}),
    ...(stickers.length ? { stickers } : {}),
    ...(comments.length ? { comments } : {}),
    ...(album.length ? { album } : {}),
    deletedTrips: mergeDeletedTrips(data.deletedTrips, [{ id: tripId, deletedAt: stamp }]),
  };
}

/**
 * 합친 수첩에서 삭제 기록에 걸린 수첩과 딸린 기록을 뺀다.
 * 지운 뒤에 고친 수첩(updatedAt이 지운 시각보다 나중)은 남기고 그 삭제 기록을 지운다.
 * 예: 10:00에 지웠는데 다른 기기에서 10:05에 고쳤다면 남긴다.
 */
export function dropDeletedTrips(data: NotebookData): NotebookData {
  const records = data.deletedTrips ?? [];
  if (!records.length) return data;
  const deletedAt = new Map(records.map((r) => [r.id, Date.parse(r.deletedAt)]));
  const gone = new Set(
    data.library.trips
      .filter((trip) => deletedAt.has(trip.id) && Date.parse(trip.updatedAt) <= deletedAt.get(trip.id)!)
      .map((trip) => trip.id),
  );
  const kept = new Set(data.library.trips.filter((trip) => !gone.has(trip.id)).map((trip) => trip.id));
  const trips = data.library.trips.filter((trip) => kept.has(trip.id));
  const packing = (data.packing ?? []).filter((item) => kept.has(item.tripId));
  const stickers = (data.stickers ?? []).filter((sticker) => kept.has(sticker.tripId));
  const designs = Object.fromEntries(Object.entries(data.designs ?? {}).filter(([id]) => kept.has(id)));
  const deletedTrips = records.filter((r) => !kept.has(r.id));
  const comments = (data.comments ?? []).filter((c) => kept.has(c.tripId));
  const album = (data.album ?? []).filter((p) => kept.has(p.tripId));
  const { designs: _d, packing: _p, stickers: _s, deletedTrips: _t, comments: _c, album: _a, ...rest } = data;
  return {
    ...rest,
    library: {
      ...data.library,
      trips,
      activeTripId: kept.has(data.library.activeTripId) ? data.library.activeTripId : (trips[0]?.id ?? ""),
    },
    pages: data.pages.filter((page) => kept.has(page.tripId)),
    ...(packing.length ? { packing } : {}),
    ...(Object.keys(designs).length ? { designs } : {}),
    ...(stickers.length ? { stickers } : {}),
    ...(comments.length ? { comments } : {}),
    ...(album.length ? { album } : {}),
    ...(deletedTrips.length ? { deletedTrips } : {}),
  };
}

/** 이 수첩의 사진 스티커 파일 이름. 다른 수첩 스티커가 같은 파일을 쓰면 남긴다. */
export function stickerPhotoFiles(data: NotebookData, tripId: string): string[] {
  const others = new Set(
    (data.stickers ?? []).filter((s) => s.tripId !== tripId && s.photo).map((s) => s.photo!.file),
  );
  const mine = (data.stickers ?? []).filter((s) => s.tripId === tripId && s.photo).map((s) => s.photo!.file);
  return [...new Set(mine)].filter((file) => !others.has(file));
}
