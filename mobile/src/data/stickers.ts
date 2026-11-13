import { isDateOnly } from "../../../src/repositories/schemaGuards";

// 그날의 장에 붙이는 장소 스티커. 모양·테두리·글꼴·반전·장식을 사용자가 하나씩 고른다(정해진 묶음이 아니다).
// 위치는 기기 너비와 상관없이 같은 자리에 보이도록 쪽 크기에 대한 비율로 저장한다.

export const STICKER_SHAPES = ["ticket", "stamp", "label", "receipt", "tag"] as const;
export const STICKER_BORDERS = ["none", "solid", "double", "dashed"] as const;
export const STICKER_FONTS = ["serif", "sans", "mono", "hand"] as const;
export const STICKER_DECORATIONS = ["none", "stars", "dots", "stripes", "stitch"] as const;
export type StickerShape = (typeof STICKER_SHAPES)[number];
export type StickerBorder = (typeof STICKER_BORDERS)[number];
export type StickerFont = (typeof STICKER_FONTS)[number];
export type StickerDecoration = (typeof STICKER_DECORATIONS)[number];
export const PHOTO_CUT_SHAPES = ["circle", "rounded", "stamp", "polaroid", "torn"] as const;
export type PhotoCutShape = (typeof PHOTO_CUT_SHAPES)[number];
export interface StickerPhoto {
  /** day-photos 폴더 안의 파일 이름만 저장한다. */
  file: string;
  shape: PhotoCutShape;
  caption: string;
}

export interface StickerStyle {
  shape: StickerShape;
  border: StickerBorder;
  font: StickerFont;
  /** 검은 바탕에 크림 글자. */
  inverted: boolean;
  decoration: StickerDecoration;
}

/** x·y: 스티커 가운데의 쪽 너비·높이 비율(0~1). scale: 기본 크기의 배수. rotation: 도(시계 방향). z: 클수록 위. */
export interface StickerTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z: number;
}

export interface DaySticker {
  id: string;
  tripId: string;
  /** 붙인 날 "YYYY-MM-DD"(수첩 현지 날짜). */
  date: string;
  /** 계획에서 만들었을 때 그 계획 한 줄의 id. 계획을 지워도 스티커는 남는다. */
  pageId?: string;
  place: string;
  time: string;
  area: string;
  memo: string;
  showMemo: boolean;
  /** 없으면 예전 장소 스티커다. */
  kind?: "photo";
  photo?: StickerPhoto;
  style: StickerStyle;
  transform: StickerTransform;
}

export const STICKER_LIMIT = 2000;
export const STICKER_TEXT_MAX = { place: 80, time: 20, area: 80, memo: 200 } as const;
export const SCALE_MIN = 0.5;
export const SCALE_MAX = 2.5;

// 기준 쪽 크기(pt). 390pt 화면에서 좌우 여백 22pt를 뺀 너비, 높이는 너비의 1.25배.
// 화면이 이보다 좁거나 넓으면 쪽과 스티커가 같은 비율로 줄고 는다. 예: 너비 300pt면 0.867배.
export const PAGE_REF_WIDTH = 346;
export const PAGE_ASPECT = 1.25;
const PAGE_REF_HEIGHT = PAGE_REF_WIDTH * PAGE_ASPECT;

/** 모양별 기본 크기(pt, 1배 기준). 그리기와 쪽 안 가두기가 같은 값을 쓴다. */
export const STICKER_SIZE: Record<StickerShape | "photo", { width: number; height: number }> = {
  ticket: { width: 200, height: 96 },
  stamp: { width: 132, height: 156 },
  label: { width: 188, height: 72 },
  receipt: { width: 150, height: 196 },
  tag: { width: 196, height: 90 },
  photo: { width: 160, height: 190 },
};

export function defaultStickerStyle(): StickerStyle {
  return { shape: "ticket", border: "solid", font: "serif", inverted: false, decoration: "none" };
}

/** 회전을 -180 초과 180 이하로 접고 0.1도로 반올림한다. 예: 190 → -170, 540 → 180. */
export function normalizeRotation(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  const wrapped = ((((degrees + 180) % 360) + 360) % 360) - 180;
  const rounded = Math.round((wrapped === -180 ? 180 : wrapped) * 10) / 10;
  return rounded === 0 ? 0 : rounded;
}

/** 회전한 스티커의 모서리까지 포함하는 반너비·반높이(쪽 비율). */
export function stickerBox(shape: StickerShape | "photo", scale: number, rotation = 0) {
  const size = STICKER_SIZE[shape];
  const angle = rotation * Math.PI / 180;
  const cosine = Math.abs(Math.cos(angle)), sine = Math.abs(Math.sin(angle));
  return {
    halfWidth: (size.width * cosine + size.height * sine) * scale / 2 / PAGE_REF_WIDTH,
    halfHeight: (size.width * sine + size.height * cosine) * scale / 2 / PAGE_REF_HEIGHT,
  };
}

const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * 스티커 전체가 쪽 안에 들어오도록 가운데 위치를 가둔다. 쪽보다 크면 그 방향으로는 가운데에 둔다.
 */
export function clampTransform(t: StickerTransform, shape: StickerShape | "photo"): StickerTransform {
  const scale = Math.round(clamp(finite(t.scale, 1), SCALE_MIN, SCALE_MAX) * 1000) / 1000;
  const rotation = normalizeRotation(t.rotation);
  const { halfWidth, halfHeight } = stickerBox(shape, scale, rotation);
  const axis = (value: number, half: number) => (half >= 0.5 ? 0.5 : clamp(finite(value, 0.5), half, 1 - half));
  return {
    x: axis(t.x, halfWidth),
    y: axis(t.y, halfHeight),
    scale,
    rotation,
    z: Math.max(0, Math.round(finite(t.z, 0))),
  };
}

const sameDay = (a: DaySticker, b: Pick<DaySticker, "tripId" | "date">) => a.tripId === b.tripId && a.date === b.date;
const topZ = (list: DaySticker[]) => list.reduce((z, s) => Math.max(z, s.transform.z), 0);

// 새 스티커를 같은 자리에 겹쳐 붙이지 않도록 붙인 순서대로 조금씩 비켜 둔다.
const STAGGER = [0, 0.08, -0.08, 0.04, -0.04];

/** 그날 계획 한 줄로 장소·시각·지역을 채운다. 주소는 지역 칸 길이까지만 담는다. */
export function stickerFromPlan(plan: { id: string; title: string; time?: string; address: string }) {
  return {
    pageId: plan.id,
    place: plan.title.trim().slice(0, STICKER_TEXT_MAX.place),
    time: (plan.time ?? "").slice(0, STICKER_TEXT_MAX.time),
    area: plan.address.trim().slice(0, STICKER_TEXT_MAX.area),
  };
}

export function hasStickerText(s: Pick<DaySticker, "place" | "time" | "area" | "memo">): boolean {
  return [s.place, s.time, s.area, s.memo].some((text) => text.trim() !== "");
}

const STICKER_KEYS = ["id", "tripId", "date", "pageId", "place", "time", "area", "memo", "showMemo", "style", "transform", "kind", "photo"];
const STYLE_KEYS = ["shape", "border", "font", "inverted", "decoration"];
const TRANSFORM_KEYS = ["x", "y", "scale", "rotation", "z"];
const exactKeys = (value: object, keys: string[], optional: string[] = []) =>
  Object.keys(value).every((k) => keys.includes(k)) && keys.every((k) => optional.includes(k) || k in value);
const isText = (value: unknown, max: number) => typeof value === "string" && value.length <= max;
const inRange = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => list.includes(value as T);

/** 백업·동기화로 들어온 스티커 한 장 검사. 모르는 칸이나 범위를 벗어난 값이 있으면 false. */
export function isDaySticker(value: unknown, tripIds: Set<string>): value is DaySticker {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  const style = s.style as Record<string, unknown> | null, t = s.transform as Record<string, unknown> | null;
  return (
    exactKeys(s, STICKER_KEYS, ["pageId", "kind", "photo"]) &&
    typeof s.id === "string" && s.id.length > 0 && s.id.length <= 120 &&
    typeof s.tripId === "string" && tripIds.has(s.tripId) &&
    typeof s.date === "string" && isDateOnly(s.date) &&
    (s.pageId === undefined || (typeof s.pageId === "string" && s.pageId.length > 0 && s.pageId.length <= 120)) &&
    isText(s.place, STICKER_TEXT_MAX.place) && isText(s.time, STICKER_TEXT_MAX.time) &&
    isText(s.area, STICKER_TEXT_MAX.area) && isText(s.memo, STICKER_TEXT_MAX.memo) &&
    (s.kind === "photo"
      ? !!s.photo && typeof s.photo === "object" && !Array.isArray(s.photo)
        && exactKeys(s.photo as object, ["file", "shape", "caption"])
        && typeof (s.photo as StickerPhoto).file === "string"
        && /^sticker-[A-Za-z0-9_-]{1,120}\.(jpe?g|png|webp|heic|heif)$/i.test((s.photo as StickerPhoto).file)
        && oneOf(PHOTO_CUT_SHAPES, (s.photo as StickerPhoto).shape)
        && isText((s.photo as StickerPhoto).caption, 60)
      : s.kind === undefined && s.photo === undefined && hasStickerText(s as unknown as DaySticker)) &&
    typeof s.showMemo === "boolean" &&
    !!style && typeof style === "object" && exactKeys(style, STYLE_KEYS) &&
    oneOf(STICKER_SHAPES, style.shape) && oneOf(STICKER_BORDERS, style.border) &&
    oneOf(STICKER_FONTS, style.font) && oneOf(STICKER_DECORATIONS, style.decoration) &&
    typeof style.inverted === "boolean" &&
    !!t && typeof t === "object" && exactKeys(t, TRANSFORM_KEYS) &&
    inRange(t.x, 0, 1) && inRange(t.y, 0, 1) && inRange(t.scale, SCALE_MIN, SCALE_MAX) &&
    inRange(t.rotation, -180, 180) && Number.isInteger(t.z) && inRange(t.z, 0, 1_000_000)
  );
}

/** 빈 스티커 하나. existing은 수첩 전체 스티커이고 같은 날 것만 본다. */
export function newSticker(base: Pick<DaySticker, "id" | "tripId" | "date">, existing: DaySticker[]): DaySticker {
  const day = existing.filter((s) => sameDay(s, base));
  const n = day.length;
  const style = defaultStickerStyle();
  return {
    ...base,
    place: "",
    time: "",
    area: "",
    memo: "",
    showMemo: true,
    style,
    transform: clampTransform({ x: 0.5 + STAGGER[n % STAGGER.length], y: 0.4 + (n % 3) * 0.06, scale: 1, rotation: n % 2 ? 3 : -3, z: topZ(day) + 1 }, style.shape),
  };
}
