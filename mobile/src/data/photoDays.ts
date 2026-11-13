import { localDateTime } from "../../../src/domain/time/zoned";
import { isDateOnly } from "../../../src/repositories/schemaGuards";
import {
  PAGE_ASPECT,
  PAGE_REF_WIDTH,
  SCALE_MAX,
  SCALE_MIN,
  clampTransform,
  defaultStickerStyle,
  normalizeRotation,
  stickerFromPlan,
  type DaySticker,
  type StickerTransform,
} from "./stickers";

// 사진첩에서 고른 사진으로 그날의 장 초안을 만든다.
// 1) 사진의 찍은 시각을 수첩 시간대의 날짜·시각으로 바꿔 여행 날에 나눈다.
// 2) 그날 계획 중 시각·거리가 가장 가까운 곳에 사진을 맞춘다.
// 3) 하루에 사진 몇 장과, 사진이 맞은 계획의 장소 스티커를 쪽 위에 놓는다.
// 사진 파일은 기기에만 두므로 여기서는 파일을 다루지 않는다. 위치·크기는 스티커처럼 쪽 비율로 저장한다.

/** 하루 초안에 놓는 사진 수. 이보다 많으면 계획마다 한 장을 먼저 고르고 나머지는 시간 간격을 고르게 뽑는다. */
export const DRAFT_PHOTOS_PER_DAY = 4;
/** 하루 초안에 붙이는 장소 스티커 수. */
export const DRAFT_STICKERS_PER_DAY = 3;
/** 한 번에 고를 수 있는 사진 수. EXIF를 함께 읽어 메모리를 많이 쓴다. */
export const PICK_LIMIT = 60;
/** 한 수첩에 둘 수 있는 쪽 사진 수. */
export const DAY_PHOTO_LIMIT = 1000;

/** 사진 틀의 기본 너비(pt, 1배·기준 쪽 346pt). 높이는 사진 비율로 정한다. */
export const PHOTO_REF_WIDTH = 132;
// 아주 긴 파노라마도 쪽을 가로지르지 않게 틀 비율(너비/높이)을 가둔다. 넘는 부분은 잘라 보인다.
export const PHOTO_ASPECT_MIN = 0.75;
export const PHOTO_ASPECT_MAX = 4 / 3;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** 수첩 현지 날짜와 자정부터의 분. 예: 오후 1시 40분 → { date, minutes: 820 }. */
export interface LocalShot {
  date: string;
  minutes: number;
}

/** 고른 사진 한 장을 읽은 결과. key는 같은 사진을 두 번 넣지 않게 하는 열쇠다. */
export interface PhotoShot {
  key: string;
  uri: string;
  aspect: number;
  local?: LocalShot;
  point?: GeoPoint;
}

/** 맞춰 볼 그날 계획 한 줄. point는 기기 캐시에 있는 좌표(없으면 시각만 본다). */
export interface PlanSpot {
  id: string;
  title: string;
  date: string;
  time?: string;
  minutes?: number;
  address: string;
  point?: GeoPoint;
}

/** 쪽에 놓인 사진 한 장. file은 기기 문서 폴더의 파일 이름이다(백업·동기화에 넣지 않는다). */
export interface DayPhoto {
  id: string;
  tripId: string;
  date: string;
  file: string;
  /** 같은 사진을 다시 넣지 않게 하는 원본 열쇠. */
  source: string;
  aspect: number;
  /** 찍은 시각(수첩 현지, 자정부터의 분). */
  minutes?: number;
  /** 맞춘 계획 한 줄의 id. 계획을 지워도 사진은 남는다. */
  planId?: string;
  transform: StickerTransform;
}

/** 사진으로 만든 날의 표시. 확정하거나 지울 때까지 남는다. 지우면 여기 적힌 사진·스티커만 뗀다. */
export interface DayDraft {
  date: string;
  photoIds: string[];
  stickerIds: string[];
}

export interface DayPhotoState {
  version: 1;
  photos: DayPhoto[];
  drafts: DayDraft[];
}

export function emptyDayPhotos(): DayPhotoState {
  return { version: 1, photos: [], drafts: [] };
}

const pad = (n: number) => String(n).padStart(2, "0");

// EXIF 값은 iOS에서 숫자, Android에서 숫자나 "35/1,40/1,1234/100" 같은 분수 문자열로 온다.
function number(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parts = value.split(",").map((part) => {
    const [a, b] = part.trim().split("/");
    const n = Number(a), d = b === undefined ? 1 : Number(b);
    return d ? n / d : NaN;
  });
  if (parts.some((n) => !Number.isFinite(n))) return undefined;
  // 도·분·초 세 칸이면 도 단위로 합친다. 예: 35°40'12.34" → 35.6701.
  return parts.length === 3 ? parts[0] + parts[1] / 60 + parts[2] / 3600 : parts.length === 1 ? parts[0] : undefined;
}

/** "+09:00" → 540, "-04:30" → -270. 형식이 다르면 undefined. */
export function parseOffset(value: unknown): number | undefined {
  const m = typeof value === "string" ? /^([+-])(\d{2}):?(\d{2})$/.exec(value.trim()) : null;
  if (!m) return undefined;
  const minutes = Number(m[2]) * 60 + Number(m[3]);
  return minutes > 14 * 60 ? undefined : m[1] === "-" ? -minutes : minutes;
}

/**
 * EXIF의 찍은 시각. wall은 카메라 시계 그대로의 "YYYY-MM-DDTHH:MM:SS", offset은 그때 시간대(분)다.
 * DateTimeOriginal을 먼저, 없으면 DateTimeDigitized, DateTime 순으로 본다. 0000 같은 빈 값은 버린다.
 */
export function exifTime(exif: Record<string, unknown> | null | undefined): { wall: string; offset?: number } | undefined {
  if (!exif) return undefined;
  const pairs: [string, string][] = [
    ["DateTimeOriginal", "OffsetTimeOriginal"],
    ["DateTimeDigitized", "OffsetTimeDigitized"],
    ["DateTime", "OffsetTime"],
  ];
  for (const [timeKey, offsetKey] of pairs) {
    const raw = exif[timeKey];
    const m = typeof raw === "string" ? /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw.trim()) : null;
    if (!m) continue;
    const wall = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}`;
    const naive = Date.parse(`${wall}Z`);
    // 2월 30일·25시처럼 달력에 없는 값은 Date가 다음 날로 넘겨 버리므로 되돌려 비교해 거른다.
    if (!Number.isFinite(naive) || new Date(naive).toISOString().slice(0, 19) !== wall || Number(m[1]) < 1990) continue;
    const offset = parseOffset(exif[offsetKey]);
    return offset === undefined ? { wall } : { wall, offset };
  }
  return undefined;
}

const isLat = (v: number | undefined): v is number => v !== undefined && v >= -90 && v <= 90;
const isLng = (v: number | undefined): v is number => v !== undefined && v >= -180 && v <= 180;

/**
 * EXIF의 GPS 위치. iOS는 양수와 방향 글자(N/S, E/W)를, Android는 부호가 붙은 값을 준다.
 * 이미 음수면 방향 글자로 한 번 더 뒤집지 않는다. 0,0(위치 없음으로 저장된 값)은 버린다.
 */
export function exifPoint(exif: Record<string, unknown> | null | undefined): GeoPoint | undefined {
  if (!exif) return undefined;
  let latitude = number(exif.GPSLatitude);
  let longitude = number(exif.GPSLongitude);
  if (latitude === undefined || longitude === undefined) return undefined;
  const ref = (key: string) => (typeof exif[key] === "string" ? (exif[key] as string).trim().toUpperCase() : "");
  if (latitude > 0 && ref("GPSLatitudeRef") === "S") latitude = -latitude;
  if (longitude > 0 && ref("GPSLongitudeRef") === "W") longitude = -longitude;
  if (!isLat(latitude) || !isLng(longitude) || (latitude === 0 && longitude === 0)) return undefined;
  return { latitude, longitude };
}

/**
 * 찍은 시각을 수첩 시간대의 날짜·분으로. 시간대(offset)가 적혀 있으면 실제 순간으로 바꿔 수첩 시간대로 옮긴다.
 * 없으면 카메라 시계가 이미 여행지 시각이었다고 본다(휴대폰은 보통 현지 시간대로 자동 맞춰진다).
 * 예: "2026:10:09 23:30:00" +01:00, 수첩 Asia/Tokyo → 10월 10일 07:30(450분).
 */
export function shotLocal(exif: Record<string, unknown> | null | undefined, timeZone: string): LocalShot | undefined {
  const time = exifTime(exif);
  if (!time) return undefined;
  let local = time.wall;
  if (time.offset !== undefined) {
    const sign = time.offset < 0 ? "-" : "+";
    const abs = Math.abs(time.offset);
    const instant = Date.parse(`${time.wall}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`);
    try {
      local = localDateTime(new Date(instant), timeZone);
    } catch {
      return undefined;
    }
  }
  return { date: local.slice(0, 10), minutes: Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16)) };
}

/** 사진 틀 비율(너비/높이). 크기를 모르면 4:3 가로로 본다. */
export function photoAspect(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return PHOTO_ASPECT_MAX;
  return Math.min(PHOTO_ASPECT_MAX, Math.max(PHOTO_ASPECT_MIN, Math.round((width / height) * 1000) / 1000));
}

/** 사진 고르기 결과 한 장을 읽는다. key가 없으면(파일 이름도 시각도 없으면) uri를 쓴다. */
export function readShot(
  asset: { uri: string; width: number; height: number; assetId?: string | null; fileName?: string | null; exif?: Record<string, unknown> | null },
  timeZone: string,
): PhotoShot {
  const local = shotLocal(asset.exif, timeZone);
  const point = exifPoint(asset.exif);
  const wall = exifTime(asset.exif)?.wall;
  const key = asset.assetId || (asset.fileName ? `${asset.fileName}@${wall ?? ""}` : asset.uri);
  return { key, uri: asset.uri, aspect: photoAspect(asset.width, asset.height), ...(local ? { local } : {}), ...(point ? { point } : {}) };
}

/** 두 지점 사이 거리(m). 지구를 반지름 6,371km 공으로 본다. */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude), dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface ShotGroups {
  /** 여행 날짜 → 그날 사진(찍은 시각 순). 사진이 없는 날은 넣지 않는다. */
  byDay: Map<string, PhotoShot[]>;
  /** 찍은 시각을 몰라 날을 정하지 못한 사진 수. */
  undated: number;
  /** 여행 기간 밖에서 찍은 사진 수. */
  outside: number;
}

/** 사진을 여행 날짜에 나눈다. 같은 key는 처음 한 장만 센다. */
export function groupShots(shots: PhotoShot[], days: string[]): ShotGroups {
  const tripDays = new Set(days);
  const byDay = new Map<string, PhotoShot[]>();
  const seen = new Set<string>();
  let undated = 0, outside = 0;
  for (const shot of shots) {
    if (seen.has(shot.key)) continue;
    seen.add(shot.key);
    if (!shot.local) undated++;
    else if (!tripDays.has(shot.local.date)) outside++;
    else byDay.set(shot.local.date, [...(byDay.get(shot.local.date) ?? []), shot]);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.local!.minutes - b.local!.minutes);
  return { byDay: new Map(days.filter((d) => byDay.has(d)).map((d) => [d, byDay.get(d)!])), undated, outside };
}

// 맞추기 기준. 계획 시각 앞뒤로 이만큼(분)은 "그곳에 있던 시간"으로 본다. 머무는 시간을 모르면 90분으로 잡는다.
const BEFORE_MIN = 30;
const AFTER_MIN = 30;
const STAY_DEFAULT_MIN = 90;
// 이 시간(분)보다 벗어나면 시각만으로는 맞추지 않는다.
const TIME_REACH_MIN = 90;
// 이 거리(m) 안이면 시각이 어긋나도 그곳으로 본다. 이보다 멀면 시각이 맞아도 그곳이 아니다.
const NEAR_M = 300;
const FAR_M = 2_000;

/** 사진 시각이 계획의 머무는 구간에서 몇 분 벗어났는지. 안이면 0, 계획 시각이 없으면 undefined. */
export function minutesOff(shot: number, plan: Pick<PlanSpot, "time" | "minutes">): number | undefined {
  const m = plan.time ? /^(\d{2}):(\d{2})$/.exec(plan.time) : null;
  if (!m) return undefined;
  const start = Number(m[1]) * 60 + Number(m[2]);
  const from = start - BEFORE_MIN, to = start + (plan.minutes ?? STAY_DEFAULT_MIN) + AFTER_MIN;
  return shot < from ? from - shot : shot > to ? shot - to : 0;
}

/**
 * 사진 한 장에 맞는 계획 하나를 고른다. 없으면 undefined.
 * 쉬운 말로: 가까운 곳(300m 안)이거나 그곳에 있던 시간(앞뒤 90분 안)이면 후보가 되고, 2km 넘게 떨어진 곳은 뺀다.
 * 후보가 여럿이면 "벗어난 시간(시간 단위) + 거리(500m 단위)"가 작은 쪽, 같으면 계획 순서가 앞인 쪽을 고른다.
 * 모르는 값은 1(한 시간·500m만큼 어긋난 것)로 쳐서 근거가 있는 후보가 앞서게 한다.
 */
export function matchPlan(shot: PhotoShot, plans: PlanSpot[]): PlanSpot | undefined {
  let best: { plan: PlanSpot; cost: number } | undefined;
  for (const plan of plans) {
    const off = shot.local ? minutesOff(shot.local.minutes, plan) : undefined;
    const meters = shot.point && plan.point ? distanceMeters(shot.point, plan.point) : undefined;
    if (meters !== undefined && meters > FAR_M) continue;
    const near = meters !== undefined && meters <= NEAR_M;
    const onTime = off !== undefined && off <= TIME_REACH_MIN;
    if (!near && !onTime) continue;
    const cost = (off === undefined ? 1 : off / 60) + (meters === undefined ? 1 : meters / 500);
    if (!best || cost < best.cost) best = { plan, cost };
  }
  return best?.plan;
}

/**
 * 하루에 놓을 사진을 고른다. 계획마다 가장 이른 한 장을 먼저, 남은 자리는 남은 사진에서 시간 간격이 고르게 뽑는다.
 * 결과는 찍은 시각 순이다. 예: 사진 10장·자리 4, 맞은 계획 1곳 → 그곳 한 장 + 나머지 9장 중 0·4·8번째.
 */
export function pickForDay(shots: PhotoShot[], matched: Map<string, string>, limit = DRAFT_PHOTOS_PER_DAY): PhotoShot[] {
  if (shots.length <= limit) return shots;
  const chosen = new Set<PhotoShot>();
  const plans = new Set<string>();
  for (const shot of shots) {
    const plan = matched.get(shot.key);
    if (plan && !plans.has(plan) && chosen.size < limit) {
      plans.add(plan);
      chosen.add(shot);
    }
  }
  const rest = shots.filter((s) => !chosen.has(s));
  const room = limit - chosen.size;
  for (let i = 0; i < room; i++) chosen.add(rest[room === 1 ? 0 : Math.round((i * (rest.length - 1)) / (room - 1))]);
  return shots.filter((s) => chosen.has(s));
}

// 쪽 위 자리(쪽 너비·높이 비율). 수첩에 사진을 붙인 듯 조금씩 기울이고 엇갈리게 둔다.
// 사진은 위쪽, 장소 스티커는 사진 아래 가장자리에 걸쳐 붙인다.
const PHOTO_SLOTS: { x: number; y: number; scale: number; rotation: number }[][] = [
  [{ x: 0.5, y: 0.36, scale: 1.5, rotation: -2 }],
  [
    { x: 0.32, y: 0.3, scale: 1.1, rotation: -4 },
    { x: 0.68, y: 0.5, scale: 1.1, rotation: 3 },
  ],
  [
    { x: 0.29, y: 0.24, scale: 1, rotation: -4 },
    { x: 0.71, y: 0.36, scale: 1, rotation: 3 },
    { x: 0.36, y: 0.6, scale: 1, rotation: 2 },
  ],
  [
    { x: 0.28, y: 0.22, scale: 0.95, rotation: -3 },
    { x: 0.72, y: 0.25, scale: 0.95, rotation: 4 },
    { x: 0.3, y: 0.56, scale: 0.95, rotation: 2 },
    { x: 0.72, y: 0.6, scale: 0.95, rotation: -3 },
  ],
];
const STICKER_SLOTS = [
  { x: 0.68, y: 0.86, rotation: -3 },
  { x: 0.3, y: 0.9, rotation: 2 },
  { x: 0.5, y: 0.76, rotation: 4 },
];
const DRAFT_STICKER_SCALE = 0.7;

/** 사진 틀의 반너비·반높이(쪽 비율). 틀의 흰 여백까지 포함한 크기다. */
export function photoBox(aspect: number, scale: number) {
  const width = PHOTO_REF_WIDTH * scale;
  const height = (PHOTO_REF_WIDTH / aspect) * scale;
  return { halfWidth: width / 2 / PAGE_REF_WIDTH, halfHeight: height / 2 / (PAGE_REF_WIDTH * PAGE_ASPECT) };
}

const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * 사진 틀 전체가 쪽 안에 들어오도록 가운데 위치를 가둔다. 쪽보다 크면 그 방향으로는 가운데에 둔다.
 * 스티커 규칙(stickers.ts)과 따로 두어 스티커 쪽 변경과 섞이지 않게 한다. 회전한 모서리는 계산하지 않는다.
 */
export function clampPhoto(t: StickerTransform, aspect: number): StickerTransform {
  const scale = Math.round(clamp(finite(t.scale, 1), SCALE_MIN, SCALE_MAX) * 1000) / 1000;
  const { halfWidth, halfHeight } = photoBox(aspect, scale);
  const axis = (value: number, half: number) => (half >= 0.5 ? 0.5 : Math.round(clamp(finite(value, 0.5), half, 1 - half) * 10000) / 10000);
  return { x: axis(t.x, halfWidth), y: axis(t.y, halfHeight), scale, rotation: normalizeRotation(t.rotation), z: Math.max(0, Math.round(finite(t.z, 0))) };
}

/** n장(1~4)을 놓을 자리. z는 base+1부터 차례로. */
export function photoSlots(aspects: number[], baseZ: number): StickerTransform[] {
  const slots = PHOTO_SLOTS[Math.min(aspects.length, PHOTO_SLOTS.length) - 1] ?? [];
  return aspects.slice(0, slots.length).map((aspect, i) => clampPhoto({ ...slots[i], z: baseZ + i + 1 }, aspect));
}

/** 계획 한 줄로 만든 초안 스티커의 내용(id·자리 제외). */
export type DraftSticker = Omit<DaySticker, "id" | "tripId">;

export interface DayDraftPlan {
  date: string;
  /** 놓을 사진과 자리. */
  photos: { shot: PhotoShot; planId?: string; transform: StickerTransform }[];
  stickers: DraftSticker[];
  /** 그날 사진 전체 수(놓지 않은 것 포함). */
  total: number;
  /** 이미 사진·스티커가 있는 날. 그 위에 더할지 사용자에게 먼저 묻는다. */
  hasContent: boolean;
}

export interface DraftInput {
  tripId: string;
  days: string[];
  shots: PhotoShot[];
  plans: PlanSpot[];
  /** 이 수첩에 이미 놓인 사진. 같은 원본은 다시 넣지 않는다. */
  photos: DayPhoto[];
  /** 이 수첩의 스티커. 같은 계획 스티커가 그날 이미 있으면 다시 붙이지 않는다. */
  stickers: DaySticker[];
}

export interface DraftResult {
  days: DayDraftPlan[];
  undated: number;
  outside: number;
  /** 이미 쪽에 있는 사진이라 뺀 수. */
  duplicates: number;
}

const byTime = (a: PlanSpot, b: PlanSpot) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99");

/** 고른 사진 전체로 날마다 초안을 계산한다. 저장은 하지 않는다. */
export function draftDays(input: DraftInput): DraftResult {
  // 이미 쪽에 있는 사진과, 이번에 같은 사진을 두 번 고른 것을 함께 뺀다.
  const known = new Set(input.photos.filter((p) => p.tripId === input.tripId).map((p) => p.source));
  const fresh = input.shots.filter((s) => !known.has(s.key) && (known.add(s.key), true));
  const groups = groupShots(fresh, input.days);
  const days: DayDraftPlan[] = [];
  for (const [date, shots] of groups.byDay) {
    const plans = input.plans.filter((p) => p.date === date).sort(byTime);
    const matched = new Map<string, string>();
    for (const shot of shots) {
      const plan = matchPlan(shot, plans);
      if (plan) matched.set(shot.key, plan.id);
    }
    const dayPhotos = input.photos.filter((p) => p.tripId === input.tripId && p.date === date);
    const dayStickers = input.stickers.filter((s) => s.tripId === input.tripId && s.date === date);
    const chosen = pickForDay(shots, matched);
    const photoZ = dayPhotos.reduce((z, p) => Math.max(z, p.transform.z), 0);
    const slots = photoSlots(chosen.map((s) => s.aspect), photoZ);
    const photos = chosen.map((shot, i) => ({ shot, transform: slots[i], ...(matched.has(shot.key) ? { planId: matched.get(shot.key) } : {}) }));
    const already = new Set(dayStickers.map((s) => s.pageId).filter(Boolean));
    const hit = new Set(matched.values());
    const visited = plans.filter((p) => hit.has(p.id) && !already.has(p.id)).slice(0, DRAFT_STICKERS_PER_DAY);
    const stickerZ = dayStickers.reduce((z, s) => Math.max(z, s.transform.z), 0);
    const style = defaultStickerStyle();
    const stickers = visited.map((plan, i): DraftSticker => ({
      date,
      ...stickerFromPlan(plan),
      memo: "",
      showMemo: false,
      style,
      transform: clampTransform({ ...STICKER_SLOTS[i], scale: DRAFT_STICKER_SCALE, z: stickerZ + i + 1 }, style.shape),
    }));
    days.push({ date, photos, stickers, total: shots.length, hasContent: dayPhotos.length > 0 || dayStickers.length > 0 });
  }
  return { days, undated: groups.undated, outside: groups.outside, duplicates: input.shots.length - fresh.length };
}

/** 그날 쪽 사진을 아래부터 위 순서로. */
export function photosForDay(photos: DayPhoto[], tripId: string, date: string): DayPhoto[] {
  return photos.filter((p) => p.tripId === tripId && p.date === date).sort((a, b) => a.transform.z - b.transform.z);
}

// 기기에 저장한 값 검사. 모르는 칸이나 범위를 벗어난 값이 있으면 그 줄을 버린다(앱이 멈추지 않게).
const FILE = /^[A-Za-z0-9_-]{1,120}\.jpg$/;
const isId = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 300;
const inRange = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

function isDayPhoto(v: unknown): v is DayPhoto {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const p = v as Record<string, unknown>;
  const t = p.transform as Record<string, unknown> | null;
  return (
    isId(p.id) && isId(p.tripId) && isId(p.source) &&
    typeof p.date === "string" && (p.date === "" || isDateOnly(p.date)) &&
    typeof p.file === "string" && FILE.test(p.file) &&
    inRange(p.aspect, PHOTO_ASPECT_MIN, PHOTO_ASPECT_MAX) &&
    (p.minutes === undefined || (Number.isInteger(p.minutes) && inRange(p.minutes, 0, 1439))) &&
    (p.planId === undefined || isId(p.planId)) &&
    !!t && typeof t === "object" &&
    inRange(t.x, 0, 1) && inRange(t.y, 0, 1) && inRange(t.scale, 0.5, 2.5) && inRange(t.rotation, -180, 180) && Number.isInteger(t.z) && inRange(t.z, 0, 1_000_000)
  );
}

/** 기기에 저장한 쪽 사진 상태를 읽는다. 깨진 값이면 빈 상태, 틀린 줄은 버린다. */
export function parseDayPhotos(raw: string | null): DayPhotoState {
  if (!raw) return emptyDayPhotos();
  try {
    const v = JSON.parse(raw);
    if (!v || v.version !== 1 || !Array.isArray(v.photos) || !Array.isArray(v.drafts)) return emptyDayPhotos();
    const photos: DayPhoto[] = v.photos.filter(isDayPhoto).slice(0, DAY_PHOTO_LIMIT);
    const ids = new Set(photos.map((p) => p.id));
    const drafts: DayDraft[] = v.drafts
      .filter((d: unknown): d is DayDraft => {
        const x = d as Record<string, unknown> | null;
        return !!x && typeof x.date === "string" && isDateOnly(x.date) && Array.isArray(x.photoIds) && Array.isArray(x.stickerIds) && [...x.photoIds, ...x.stickerIds].every(isId);
      })
      .map((d: DayDraft) => ({ date: d.date, photoIds: d.photoIds.filter((id) => ids.has(id)), stickerIds: d.stickerIds }));
    return { version: 1, photos, drafts };
  } catch {
    return emptyDayPhotos();
  }
}
