import { parseNotebook, type NotebookData } from "./model";
import { dropDeletedTrips, mergeDeletedTrips } from "./notebookDelete";

// 계정 백업 동기화 규칙. 수첩 전체를 한 덩어리로 올리고 받는다.
// version: 서버에 저장될 때마다 1씩 오르는 번호. hash: 마지막으로 서버와 맞춘 수첩 내용의 지문.
// 이 기기 수첩의 지문이 hash와 다르면 "이 기기에서 바뀜", 서버 version이 더 크면 "다른 기기에서 바뀜".

export interface SyncState {
  userId: string;
  version: number;
  hash: string;
}

export interface RemoteNotebook {
  version: number;
  payload: unknown;
}

export type SyncPlan =
  | { kind: "none"; adopt?: SyncState }
  | { kind: "create" }
  | { kind: "upload"; baseVersion: number }
  | { kind: "download"; remote: RemoteNotebook }
  // 두 기기에서 모두 바뀌었거나, 이 기기를 처음 연결했는데 양쪽 내용이 다를 때. 사용자가 고른다.
  | { kind: "conflict"; remote: RemoteNotebook };

/** 키 순서와 상관없이 같은 내용이면 같은 문자열. 서버 jsonb는 키 순서를 바꾼다. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** 내용 비교용 지문(FNV-1a 32bit 두 번). 보안용이 아니라 바뀜 감지용이다. */
export function notebookHash(data: unknown): string {
  const text = canonicalJson(data);
  let a = 0x811c9dc5,
    b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
  }
  return `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}

export function isEmptyNotebook(data: NotebookData): boolean {
  return data.library.trips.length === 0 && data.pages.length === 0;
}

/**
 * 충돌을 "둘 다 남기기"로 풀 때 이 기기 수첩과 계정 수첩을 합친다.
 * 수첩·속지·준비물·표지는 id로 모으고, 같은 id가 양쪽에 있으면 이 기기 쪽을 남긴다.
 * 같은 스티커를 양쪽에서 다르게 고쳤다면 원격 수정본도 새 id로 남긴다.
 * 어느 한쪽에서 지운 수첩은 삭제 기록(deletedTrips)을 따라 합친 뒤 다시 뺀다. 지운 뒤 고친 수첩만 남는다.
 * 합친 결과가 앱 검사(수첩 50권, 속지 5000장 등)를 통과하지 못하면 예외를 던지고 아무것도 바꾸지 않는다.
 */
export function mergeNotebooks(local: NotebookData, remote: NotebookData, now: Date): NotebookData {
  const union = <T extends { id: string }>(mine: T[], theirs: T[]) => {
    const ids = new Set(mine.map((item) => item.id));
    return [...mine, ...theirs.filter((item) => !ids.has(item.id))];
  };
  const trips = union(local.library.trips, remote.library.trips);
  const activeTripId = trips.some((trip) => trip.id === local.library.activeTripId) ? local.library.activeTripId : (trips[0]?.id ?? "");
  const packing = union(local.packing ?? [], remote.packing ?? []);
  const stickers = [...(local.stickers ?? [])];
  for (const remoteSticker of remote.stickers ?? []) {
    const existing = stickers.find((sticker) => sticker.id === remoteSticker.id);
    if (!existing) {
      stickers.push(remoteSticker);
    } else if (canonicalJson(existing) !== canonicalJson(remoteSticker)) {
      // 같은 충돌을 다시 합쳐도 복사본이 늘지 않도록 id와 무관하게 내용을 비교한다.
      for (let n = 1; ; n++) {
        const suffix = n === 1 ? "~remote" : `~remote-${n}`;
        const id = remoteSticker.id.slice(0, 120 - suffix.length) + suffix;
        const copy = stickers.find((sticker) => sticker.id === id);
        if (!copy) {
          stickers.push({ ...remoteSticker, id });
          break;
        }
        if (canonicalJson({ ...copy, id: remoteSticker.id }) === canonicalJson(remoteSticker)) break;
      }
    }
  }
  const designs = { ...remote.designs, ...local.designs };
  const comments = union(local.comments ?? [], remote.comments ?? []);
  const album = union(local.album ?? [], remote.album ?? []);
  const deletedTrips = mergeDeletedTrips(local.deletedTrips, remote.deletedTrips);
  const merged: NotebookData = dropDeletedTrips({
    version: 1,
    library: { schemaVersion: 3, activeTripId, trips, updatedAt: now.toISOString() },
    pages: union(local.pages, remote.pages),
    ...(packing.length ? { packing } : {}),
    ...(Object.keys(designs).length ? { designs } : {}),
    ...(stickers.length ? { stickers } : {}),
    ...(comments.length ? { comments } : {}),
    ...(album.length ? { album } : {}),
    ...(deletedTrips.length ? { deletedTrips } : {}),
  });
  return parseNotebook(JSON.stringify(merged));
}

export function planSync(userId: string, local: NotebookData, state: SyncState | null, remote: RemoteNotebook | null): SyncPlan {
  const known = state?.userId === userId ? state : null;
  const localHash = notebookHash(local);
  if (!remote) return isEmptyNotebook(local) && !known ? { kind: "none" } : { kind: "create" };

  if (!known) {
    // 이 기기를 이 계정에 처음 연결했다.
    if (isEmptyNotebook(local)) return { kind: "download", remote };
    if (notebookHash(remote.payload) === localHash)
      return { kind: "none", adopt: { userId, version: remote.version, hash: localHash } };
    return { kind: "conflict", remote };
  }

  const localChanged = localHash !== known.hash;
  const remoteChanged = remote.version !== known.version;
  if (!localChanged && !remoteChanged) return { kind: "none" };
  if (localChanged && !remoteChanged) return { kind: "upload", baseVersion: known.version };
  if (!localChanged) return { kind: "download", remote };
  // 양쪽이 같은 내용으로 바뀐 경우(같은 백업 파일을 두 기기에서 가져옴 등)는 충돌이 아니다.
  if (notebookHash(remote.payload) === localHash)
    return { kind: "none", adopt: { userId, version: remote.version, hash: localHash } };
  return { kind: "conflict", remote };
}

/** 이 기기 수첩이 이 계정에 마지막으로 올린 내용과 같은지. 로그아웃해서 기기 수첩을 지워도 되는지 볼 때 쓴다. */
export function isBackedUp(userId: string, local: NotebookData, state: SyncState | null): boolean {
  return state?.userId === userId && state.hash === notebookHash(local);
}

/** 서버에서 받은 수첩을 앱 검증 규칙으로 다시 확인한다. 손상됐으면 예외. */
export function readRemoteNotebook(remote: RemoteNotebook): NotebookData {
  return parseNotebook(JSON.stringify(remote.payload));
}

export function parseSyncState(raw: string | null): SyncState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return typeof v?.userId === "string" && Number.isInteger(v?.version) && typeof v?.hash === "string"
      ? { userId: v.userId, version: v.version, hash: v.hash }
      : null;
  } catch {
    return null;
  }
}
