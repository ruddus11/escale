import type { TripWorkspace } from "../../../../src/domain/workspace/types";
import { entityKey, parseEntityKey, type EntityKey } from "../../../../src/domain/sharing/types";
import { notebookHash } from "../cloudSync";
import type { NotebookData, PackingItem, PageEntry } from "../model";
import type { AlbumPhoto, ScheduleComment } from "../sharedContent";

// 공유 여행 한 권과 엔티티 목록 사이의 변환. 서버에는 기기 수첩 ID(tripId)를 보내지 않는다.
// 개발용 "다른 사람으로 참가" 사본은 같은 수첩 안에서 ID가 겹치지 않도록 일정·준비물·댓글·사진 ID에 접미사를 붙인다.
// 기록(journal)·표지·스티커·여권·보관함 여부는 개인 것이라 보내지 않는다.

export type Entities = Record<EntityKey, unknown>;

const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export function hashOf(value: unknown): string {
  return value === null || value === undefined ? "null" : notebookHash(value);
}

const local = (id: string, suffix: string) => id + suffix;
const remote = (id: string, suffix: string) => (suffix && id.endsWith(suffix) ? id.slice(0, -suffix.length) : id);

/** 여행이 기기에 없으면 null. 없는 여행을 "모두 지움"으로 보내지 않기 위해서다. */
export function projectTrip(data: NotebookData, tripId: string, suffix = ""): Entities | null {
  const trip = data.library.trips.find((t) => t.id === tripId);
  if (!trip) return null;
  const out: Entities = {};
  const { archived: _archived, ...settings } = trip.settings;
  out[entityKey("settings")] = plain(settings);
  out[entityKey("meta")] = plain({ schedule: trip.schedule, budget: trip.budget, legacyYenBudget: trip.legacyYenBudget, routeSegments: trip.routeSegments });
  for (const e of trip.ledger.expenses) out[entityKey("expense", e.id)] = plain(e);
  for (const c of trip.ledger.fundContributions) out[entityKey("contribution", c.id)] = plain(c);
  for (const p of trip.ledger.payments) out[entityKey("payment", p.id)] = plain(p);
  for (const r of trip.reservations ?? []) out[entityKey("reservation", r.id)] = plain(r);
  for (const page of data.pages) {
    if (page.tripId !== tripId || page.kind === "journal") continue;
    const { tripId: _t, ...rest } = page;
    const id = remote(page.id, suffix);
    out[entityKey("page", id)] = plain({ ...rest, id });
  }
  for (const item of data.packing ?? []) {
    if (item.tripId !== tripId) continue;
    const id = remote(item.id, suffix);
    out[entityKey("packing", id)] = { id, title: item.title, done: item.done };
  }
  for (const c of data.comments ?? []) {
    if (c.tripId !== tripId) continue;
    const { tripId: _t, ...rest } = c;
    const id = remote(c.id, suffix);
    out[entityKey("comment", id)] = plain({ ...rest, id, pageId: remote(c.pageId, suffix) });
  }
  // 업로드가 끝난 사진만 보낸다. 사진이 올라가기 전에 다른 사람에게 빈 자리로 보이지 않게.
  for (const p of data.album ?? []) {
    if (p.tripId !== tripId || !p.objectKey) continue;
    const { tripId: _t, file: _f, ...rest } = p;
    const id = remote(p.id, suffix);
    out[entityKey("photo", id)] = plain({ ...rest, id, ...(p.pageId ? { pageId: remote(p.pageId, suffix) } : {}) });
  }
  return out;
}

function upsert<T extends { id: string }>(list: T[], item: T | null, id: string): T[] {
  const at = list.findIndex((x) => x.id === id);
  if (item === null) return at < 0 ? list : list.filter((x) => x.id !== id);
  if (at < 0) return [...list, item];
  const next = list.slice();
  next[at] = item;
  return next;
}

/** 받은 엔티티를 기기 수첩에 반영한다. 여행이 없으면 settings·meta로 새로 만든다(참가 직후). */
export function applyEntities(data: NotebookData, tripId: string, suffix: string, changes: { key: EntityKey; value: unknown }[], now: Date): NotebookData {
  if (!changes.length) return data;
  let trips = data.library.trips;
  let trip: TripWorkspace | undefined = trips.find((t) => t.id === tripId);
  let pages = data.pages;
  let packing = data.packing ?? [];
  let comments = data.comments ?? [];
  let album = data.album ?? [];
  const stamp = now.toISOString();
  if (!trip) {
    const settings = changes.find((c) => c.key === "settings:")?.value as TripWorkspace["settings"] | undefined;
    const meta = changes.find((c) => c.key === "meta:")?.value as Pick<TripWorkspace, "schedule" | "budget"> | undefined;
    if (!settings || !meta) throw new Error("shared trip is missing settings");
    trip = { id: tripId, settings, schedule: meta.schedule, budget: meta.budget, ledger: { expenses: [], fundContributions: [], payments: [] }, reservations: [], updatedAt: stamp };
    trips = [...trips, trip];
  }
  let t: TripWorkspace = trip;
  for (const { key, value } of changes) {
    const parsed = parseEntityKey(key);
    if (!parsed) continue;
    const id = parsed.id;
    const v = value === null ? null : plain(value);
    switch (parsed.type) {
      case "settings":
        if (v) t = { ...t, settings: { ...(v as TripWorkspace["settings"]), ...(t.settings.archived ? { archived: true } : {}) } };
        break;
      case "meta": {
        if (!v) break;
        const m = v as Pick<TripWorkspace, "schedule" | "budget" | "legacyYenBudget" | "routeSegments">;
        const { legacyYenBudget: _l, routeSegments: _r, ...rest } = t;
        t = { ...rest, schedule: m.schedule, budget: m.budget, ...(m.legacyYenBudget ? { legacyYenBudget: m.legacyYenBudget } : {}), ...(m.routeSegments ? { routeSegments: m.routeSegments } : {}) };
        break;
      }
      case "expense":
        t = { ...t, ledger: { ...t.ledger, expenses: upsert(t.ledger.expenses, v as never, id) } };
        break;
      case "contribution":
        t = { ...t, ledger: { ...t.ledger, fundContributions: upsert(t.ledger.fundContributions, v as never, id) } };
        break;
      case "payment":
        t = { ...t, ledger: { ...t.ledger, payments: upsert(t.ledger.payments, v as never, id) } };
        break;
      case "reservation":
        t = { ...t, reservations: upsert(t.reservations ?? [], v as never, id) };
        break;
      case "page":
        pages = upsert(pages, v ? ({ ...(v as PageEntry), id: local(id, suffix), tripId }) : null, local(id, suffix));
        break;
      case "packing":
        packing = upsert(packing, v ? ({ ...(v as Omit<PackingItem, "tripId">), id: local(id, suffix), tripId }) : null, local(id, suffix));
        break;
      case "comment":
        comments = upsert(comments, v ? ({ ...(v as ScheduleComment), id: local(id, suffix), pageId: local((v as ScheduleComment).pageId, suffix), tripId }) : null, local(id, suffix));
        break;
      case "photo": {
        const lid = local(id, suffix);
        const before = album.find((p) => p.id === lid);
        const photo = v as AlbumPhoto | null;
        album = upsert(album, photo ? ({ ...photo, id: lid, tripId, ...(photo.pageId ? { pageId: local(photo.pageId, suffix) } : {}), ...(before?.file ? { file: before.file } : {}) }) : null, lid);
        break;
      }
    }
  }
  t = { ...t, updatedAt: stamp };
  const { packing: _p, comments: _c, album: _a, ...rest } = data;
  return {
    ...rest,
    library: {
      ...data.library,
      updatedAt: stamp,
      trips: trips.map((x) => (x.id === tripId ? t : x)),
      activeTripId: trips.some((x) => x.id === data.library.activeTripId) ? data.library.activeTripId : tripId,
    },
    pages,
    ...(packing.length ? { packing } : {}),
    ...(comments.length ? { comments } : {}),
    ...(album.length ? { album } : {}),
  };
}
