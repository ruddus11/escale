import { describe, expect, it } from "vitest";
import {
  DRAFT_PHOTOS_PER_DAY,
  DRAFT_STICKERS_PER_DAY,
  PHOTO_ASPECT_MAX,
  PHOTO_ASPECT_MIN,
  clampPhoto,
  distanceMeters,
  draftDays,
  emptyDayPhotos,
  exifPoint,
  exifTime,
  groupShots,
  matchPlan,
  minutesOff,
  parseDayPhotos,
  parseOffset,
  photoAspect,
  photoBox,
  photoSlots,
  photosForDay,
  pickForDay,
  readShot,
  shotLocal,
  type DayPhoto,
  type DayPhotoState,
  type PhotoShot,
  type PlanSpot,
} from "../src/data/photoDays";
import { clampTransform, isDaySticker, type DaySticker } from "../src/data/stickers";

const TOKYO = "Asia/Tokyo";
const DAYS = ["2026-10-08", "2026-10-09", "2026-10-10"];
// 도쿄역과 그 근처·먼 곳 좌표.
const STATION = { latitude: 35.6812, longitude: 139.7671 };
const NEAR_STATION = { latitude: 35.6822, longitude: 139.7671 }; // 약 111m 북쪽
const SHIBUYA = { latitude: 35.658, longitude: 139.7016 }; // 약 6.4km

const shot = (key: string, date?: string, minutes?: number, point?: PhotoShot["point"]): PhotoShot => ({
  key,
  uri: `file:///cache/${key}.jpg`,
  aspect: 4 / 3,
  ...(date !== undefined && minutes !== undefined ? { local: { date, minutes } } : {}),
  ...(point ? { point } : {}),
});
const plan = (id: string, date: string, time?: string, extra: Partial<PlanSpot> = {}): PlanSpot => ({ id, title: `곳 ${id}`, date, address: `주소 ${id}`, ...(time ? { time } : {}), ...extra });
const photo = (id: string, date: string, z: number, extra: Partial<DayPhoto> = {}): DayPhoto => ({
  id,
  tripId: "trip",
  date,
  file: `${id}.jpg`,
  source: `src-${id}`,
  aspect: 1,
  transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, z },
  ...extra,
});

describe("exifTime", () => {
  it("reads DateTimeOriginal with its offset", () => {
    expect(exifTime({ DateTimeOriginal: "2026:10:09 13:40:05", OffsetTimeOriginal: "+09:00" })).toEqual({ wall: "2026-10-09T13:40:05", offset: 540 });
  });

  it("falls back to digitized then plain DateTime", () => {
    expect(exifTime({ DateTimeDigitized: "2026:10:09 08:00:00" })).toEqual({ wall: "2026-10-09T08:00:00" });
    expect(exifTime({ DateTime: "2026:10:09 09:15:00", OffsetTime: "-04:00" })).toEqual({ wall: "2026-10-09T09:15:00", offset: -240 });
  });

  it("skips empty, impossible and placeholder dates", () => {
    expect(exifTime({ DateTimeOriginal: "0000:00:00 00:00:00", DateTime: "2026:10:09 10:00:00" })).toEqual({ wall: "2026-10-09T10:00:00" });
    expect(exifTime({ DateTimeOriginal: "2026:02:30 10:00:00" })).toBeUndefined();
    expect(exifTime({ DateTimeOriginal: "2026:10:09 25:00:00" })).toBeUndefined();
    expect(exifTime({ DateTimeOriginal: "    " })).toBeUndefined();
    expect(exifTime({ DateTimeOriginal: 20261009 })).toBeUndefined();
    expect(exifTime(null)).toBeUndefined();
    expect(exifTime({})).toBeUndefined();
  });

  it("ignores a malformed offset but keeps the time", () => {
    expect(exifTime({ DateTimeOriginal: "2026:10:09 13:40:05", OffsetTimeOriginal: "JST" })).toEqual({ wall: "2026-10-09T13:40:05" });
  });
});

describe("parseOffset", () => {
  it("reads signs and rejects impossible offsets", () => {
    expect(parseOffset("+05:30")).toBe(330);
    expect(parseOffset("-0430")).toBe(-270);
    expect(parseOffset("+15:00")).toBeUndefined();
    expect(parseOffset("9")).toBeUndefined();
    expect(parseOffset(undefined)).toBeUndefined();
  });
});

describe("exifPoint", () => {
  it("applies iOS direction letters to positive values", () => {
    expect(exifPoint({ GPSLatitude: 33.86, GPSLatitudeRef: "S", GPSLongitude: 151.2, GPSLongitudeRef: "E" })).toEqual({ latitude: -33.86, longitude: 151.2 });
    expect(exifPoint({ GPSLatitude: 40.7, GPSLatitudeRef: "N", GPSLongitude: 74, GPSLongitudeRef: "W" })).toEqual({ latitude: 40.7, longitude: -74 });
  });

  it("does not flip Android's already-signed values twice", () => {
    expect(exifPoint({ GPSLatitude: -33.86, GPSLatitudeRef: "S", GPSLongitude: -74, GPSLongitudeRef: "W" })).toEqual({ latitude: -33.86, longitude: -74 });
  });

  it("reads degree/minute/second rational strings", () => {
    const point = exifPoint({ GPSLatitude: "35/1,40/1,5232/100", GPSLatitudeRef: "N", GPSLongitude: "139/1,46/1,152/100", GPSLongitudeRef: "E" })!;
    expect(point.latitude).toBeCloseTo(35.6812, 4);
    expect(point.longitude).toBeCloseTo(139.76709, 4);
  });

  it("drops missing, out-of-range and null-island points", () => {
    expect(exifPoint({ GPSLatitude: 35 })).toBeUndefined();
    expect(exifPoint({ GPSLatitude: 95, GPSLongitude: 10 })).toBeUndefined();
    expect(exifPoint({ GPSLatitude: 0, GPSLongitude: 0 })).toBeUndefined();
    expect(exifPoint({ GPSLatitude: "1/0", GPSLongitude: 10 })).toBeUndefined();
    expect(exifPoint({ GPSLatitude: "1,2", GPSLongitude: 10 })).toBeUndefined();
    expect(exifPoint(undefined)).toBeUndefined();
  });
});

describe("shotLocal", () => {
  it("moves an offset time into the notebook time zone", () => {
    // 파리 밤 11시 반 = 도쿄 다음 날 아침 7시 반.
    expect(shotLocal({ DateTimeOriginal: "2026:10:09 23:30:00", OffsetTimeOriginal: "+01:00" }, TOKYO)).toEqual({ date: "2026-10-10", minutes: 450 });
  });

  it("treats a time without offset as already local", () => {
    expect(shotLocal({ DateTimeOriginal: "2026:10:09 23:30:00" }, TOKYO)).toEqual({ date: "2026-10-09", minutes: 1410 });
  });

  it("returns undefined without a time", () => {
    expect(shotLocal({ GPSLatitude: 35 }, TOKYO)).toBeUndefined();
  });
});

describe("readShot and photoAspect", () => {
  it("keeps portrait and landscape within the frame range", () => {
    expect(photoAspect(3000, 4000)).toBe(0.75);
    expect(photoAspect(4000, 3000)).toBe(1.333);
    expect(photoAspect(9000, 1000)).toBe(PHOTO_ASPECT_MAX);
    expect(photoAspect(1000, 9000)).toBe(PHOTO_ASPECT_MIN);
    expect(photoAspect(0, 0)).toBe(PHOTO_ASPECT_MAX);
  });

  it("uses assetId, then file name with time, then uri as the key", () => {
    const exif = { DateTimeOriginal: "2026:10:09 10:00:00", GPSLatitude: 35.68, GPSLongitude: 139.76 };
    expect(readShot({ uri: "u1", width: 4, height: 3, assetId: "A", fileName: "IMG_1.HEIC", exif }, TOKYO)).toEqual({
      key: "A",
      uri: "u1",
      aspect: 1.333,
      local: { date: "2026-10-09", minutes: 600 },
      point: { latitude: 35.68, longitude: 139.76 },
    });
    expect(readShot({ uri: "u1", width: 4, height: 3, assetId: null, fileName: "IMG_1.HEIC", exif }, TOKYO).key).toBe("IMG_1.HEIC@2026-10-09T10:00:00");
    expect(readShot({ uri: "u1", width: 4, height: 3 }, TOKYO)).toEqual({ key: "u1", uri: "u1", aspect: 1.333 });
  });
});

describe("distanceMeters", () => {
  it("measures short and long distances", () => {
    expect(distanceMeters(STATION, STATION)).toBe(0);
    expect(distanceMeters(STATION, NEAR_STATION)).toBeGreaterThan(100);
    expect(distanceMeters(STATION, NEAR_STATION)).toBeLessThan(120);
    expect(distanceMeters(STATION, SHIBUYA)).toBeGreaterThan(6000);
  });
});

describe("groupShots", () => {
  it("splits by trip day, sorts by time and counts the rest", () => {
    const groups = groupShots(
      [shot("b", "2026-10-09", 600), shot("a", "2026-10-09", 540), shot("c", "2026-10-08", 700), shot("x"), shot("late", "2026-10-20", 600), shot("a", "2026-10-09", 540)],
      DAYS,
    );
    expect([...groups.byDay.keys()]).toEqual(["2026-10-08", "2026-10-09"]);
    expect(groups.byDay.get("2026-10-09")!.map((s) => s.key)).toEqual(["a", "b"]);
    expect(groups.undated).toBe(1);
    expect(groups.outside).toBe(1);
  });
});

describe("minutesOff", () => {
  it("counts minutes outside the stay window", () => {
    // 13:00 시작, 60분 머묾 → 12:30~14:30이 그곳에 있던 시간.
    const p = { time: "13:00", minutes: 60 };
    expect(minutesOff(13 * 60 + 10, p)).toBe(0);
    expect(minutesOff(12 * 60 + 30, p)).toBe(0);
    expect(minutesOff(12 * 60, p)).toBe(30);
    expect(minutesOff(15 * 60, p)).toBe(30);
    // 머무는 시간을 모르면 90분.
    expect(minutesOff(15 * 60, { time: "13:00" })).toBe(0);
    expect(minutesOff(600, {})).toBeUndefined();
  });
});

describe("matchPlan", () => {
  const day = "2026-10-09";
  const lunch = plan("lunch", day, "12:00", { minutes: 60 });
  const museum = plan("museum", day, "15:00", { minutes: 120 });

  it("matches by time when no location is known", () => {
    expect(matchPlan(shot("s", day, 12 * 60 + 20), [lunch, museum])?.id).toBe("lunch");
    expect(matchPlan(shot("s", day, 16 * 60), [lunch, museum])?.id).toBe("museum");
  });

  it("does not match a photo far from every plan's time", () => {
    expect(matchPlan(shot("s", day, 7 * 60), [lunch, museum])).toBeUndefined();
  });

  it("does not match an untimed plan without coordinates", () => {
    expect(matchPlan(shot("s", day, 600), [plan("free", day)])).toBeUndefined();
  });

  it("matches a nearby place even when the time is off", () => {
    const station = plan("station", day, "09:00", { point: STATION });
    expect(matchPlan(shot("s", day, 20 * 60, NEAR_STATION), [station])?.id).toBe("station");
  });

  it("matches an untimed plan by distance only", () => {
    const free = plan("free", day, undefined, { point: STATION });
    expect(matchPlan(shot("s", day, 600, NEAR_STATION), [free])?.id).toBe("free");
  });

  it("rejects a place far away even at the right time", () => {
    const station = plan("station", day, "12:00", { point: STATION });
    expect(matchPlan(shot("s", day, 12 * 60, SHIBUYA), [station])).toBeUndefined();
  });

  it("prefers the closer place when two plans share the time", () => {
    const a = plan("a", day, "12:00", { point: SHIBUYA });
    const b = plan("b", day, "12:00", { point: STATION });
    expect(matchPlan(shot("s", day, 12 * 60, NEAR_STATION), [a, b])?.id).toBe("b");
  });

  it("prefers a plan with evidence over an unknown distance", () => {
    const known = plan("known", day, "12:00", { point: STATION });
    const unknown = plan("unknown", day, "12:00");
    expect(matchPlan(shot("s", day, 12 * 60, NEAR_STATION), [unknown, known])?.id).toBe("known");
  });

  it("keeps plan order on a tie", () => {
    const a = plan("a", day, "12:00");
    const b = plan("b", day, "12:00");
    expect(matchPlan(shot("s", day, 12 * 60), [a, b])?.id).toBe("a");
  });
});

describe("pickForDay", () => {
  const day = "2026-10-09";
  const many = Array.from({ length: 10 }, (_, i) => shot(`s${i}`, day, 600 + i * 10));

  it("keeps every photo when they fit", () => {
    expect(pickForDay(many.slice(0, 3), new Map())).toHaveLength(3);
  });

  it("takes one photo per matched plan first, then spreads the rest", () => {
    const matched = new Map([["s5", "p1"], ["s6", "p1"]]);
    const picked = pickForDay(many, matched).map((s) => s.key);
    expect(picked).toHaveLength(DRAFT_PHOTOS_PER_DAY);
    expect(picked).toContain("s5");
    expect(picked).not.toContain("s6");
    // 남은 9장(s0~s4, s6~s9)에서 0·4·8번째: s0, s4, s9. 결과는 시각 순.
    expect(picked).toEqual(["s0", "s4", "s5", "s9"]);
  });

  it("handles a single free slot", () => {
    const matched = new Map([["s1", "a"], ["s3", "b"], ["s5", "c"]]);
    expect(pickForDay(many, matched).map((s) => s.key)).toEqual(["s0", "s1", "s3", "s5"]);
  });

  it("caps at the limit when every photo matches a different plan", () => {
    const matched = new Map(many.map((s, i) => [s.key, `p${i}`]));
    expect(pickForDay(many, matched).map((s) => s.key)).toEqual(["s0", "s1", "s2", "s3"]);
  });
});

describe("photo layout", () => {
  it("places 1 to 4 photos inside the page with rising z", () => {
    for (let n = 1; n <= 4; n++) {
      const slots = photoSlots(Array(n).fill(0.75), 5);
      expect(slots).toHaveLength(n);
      slots.forEach((t, i) => {
        expect(t.z).toBe(6 + i);
        const box = photoBox(0.75, t.scale);
        expect(t.x - box.halfWidth).toBeGreaterThanOrEqual(0);
        expect(t.x + box.halfWidth).toBeLessThanOrEqual(1);
        expect(t.y - box.halfHeight).toBeGreaterThanOrEqual(0);
        expect(t.y + box.halfHeight).toBeLessThanOrEqual(1);
      });
    }
    expect(photoSlots([], 0)).toEqual([]);
  });

  it("clamps a dragged photo back onto the page", () => {
    const t = clampPhoto({ x: 1.4, y: -0.2, scale: 9, rotation: 400, z: 1 }, 1);
    expect(t.scale).toBe(2.5);
    expect(t.rotation).toBe(40);
    expect(t.x).toBeLessThanOrEqual(1);
    expect(t.y).toBeGreaterThanOrEqual(0);
  });
});

describe("draftDays", () => {
  const base = { tripId: "trip", days: DAYS, photos: [] as DayPhoto[], stickers: [] as DaySticker[] };
  const plans = [
    plan("cafe", "2026-10-09", "10:00", { minutes: 60 }),
    plan("temple", "2026-10-09", "14:00", { point: STATION }),
    plan("market", "2026-10-09", "17:00"),
    plan("tower", "2026-10-09", "19:00"),
    plan("dinner", "2026-10-09", "21:00"),
    plan("other", "2026-10-10", "10:00"),
  ];

  it("drafts one page per day with photos and stickers for matched plans", () => {
    const result = draftDays({
      ...base,
      plans,
      shots: [shot("a", "2026-10-09", 10 * 60 + 15), shot("b", "2026-10-09", 14 * 60 + 5, NEAR_STATION), shot("c", "2026-10-08", 600), shot("nodate"), shot("away", "2026-11-01", 600)],
    });
    expect(result.days.map((d) => d.date)).toEqual(["2026-10-08", "2026-10-09"]);
    expect(result.undated).toBe(1);
    expect(result.outside).toBe(1);
    const day = result.days[1];
    expect(day.photos.map((p) => [p.shot.key, p.planId])).toEqual([["a", "cafe"], ["b", "temple"]]);
    expect(day.stickers.map((s) => s.place)).toEqual(["곳 cafe", "곳 temple"]);
    expect(day.stickers[0]).toMatchObject({ date: "2026-10-09", pageId: "cafe", time: "10:00", area: "주소 cafe", memo: "", showMemo: false });
    expect(day.hasContent).toBe(false);
    // 다른 날은 계획이 없어 스티커 없이 사진만.
    expect(result.days[0].stickers).toEqual([]);
  });

  it("makes stickers that pass the backup check", () => {
    const result = draftDays({ ...base, plans, shots: [shot("a", "2026-10-09", 10 * 60)] });
    const sticker = { ...result.days[0].stickers[0], id: "id-1", tripId: "trip" };
    expect(isDaySticker(sticker, new Set(["trip"]))).toBe(true);
    expect(clampTransform(sticker.transform, sticker.style.shape)).toEqual(sticker.transform);
  });

  it("limits stickers per day and orders them by plan time", () => {
    const shots = ["10:10", "14:00", "17:00", "19:00", "21:00"].map((t, i) => shot(`s${i}`, "2026-10-09", Number(t.slice(0, 2)) * 60 + Number(t.slice(3))));
    const day = draftDays({ ...base, plans, shots }).days[0];
    expect(day.stickers).toHaveLength(DRAFT_STICKERS_PER_DAY);
    expect(day.stickers.map((s) => s.pageId)).toEqual(["cafe", "temple", "market"]);
    expect(day.photos).toHaveLength(DRAFT_PHOTOS_PER_DAY);
    expect(day.total).toBe(5);
  });

  it("skips photos already on a page and stickers already made for that plan", () => {
    const existing = photo("p1", "2026-10-09", 3, { source: "a" });
    const sticker: DaySticker = {
      id: "st",
      tripId: "trip",
      date: "2026-10-09",
      pageId: "temple",
      place: "절",
      time: "",
      area: "",
      memo: "",
      showMemo: true,
      style: { shape: "ticket", border: "solid", font: "serif", inverted: false, decoration: "none" },
      transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, z: 7 },
    };
    const result = draftDays({ ...base, plans, photos: [existing], stickers: [sticker], shots: [shot("a", "2026-10-09", 600), shot("b", "2026-10-09", 14 * 60)] });
    expect(result.duplicates).toBe(1);
    const day = result.days[0];
    expect(day.photos.map((p) => p.shot.key)).toEqual(["b"]);
    expect(day.photos[0].transform.z).toBe(4);
    expect(day.stickers).toEqual([]);
    expect(day.hasContent).toBe(true);
  });

  it("ignores photos and stickers from other notebooks", () => {
    const other = photo("p1", "2026-10-09", 3, { source: "a", tripId: "other" });
    const result = draftDays({ ...base, plans: [], photos: [other], shots: [shot("a", "2026-10-09", 600)] });
    expect(result.duplicates).toBe(0);
    expect(result.days[0].hasContent).toBe(false);
  });

  it("counts the same photo picked twice as a duplicate", () => {
    const result = draftDays({ ...base, plans: [], shots: [shot("a", "2026-10-09", 600), shot("a", "2026-10-09", 600), shot("b", "2026-10-09", 700)] });
    expect(result.duplicates).toBe(1);
    expect(result.days[0].photos.map((p) => p.shot.key)).toEqual(["a", "b"]);
  });

  it("returns no days when nothing was taken during the trip", () => {
    const result = draftDays({ ...base, plans, shots: [shot("x"), shot("y", "2025-01-01", 0)] });
    expect(result.days).toEqual([]);
    expect(result.undated + result.outside).toBe(2);
  });
});

describe("parseDayPhotos", () => {
  it("round-trips a saved state", () => {
    const s: DayPhotoState = { version: 1, photos: [photo("a", "2026-10-09", 1, { minutes: 600, planId: "p" })], drafts: [{ date: "2026-10-09", photoIds: ["a"], stickerIds: ["s"] }] };
    expect(parseDayPhotos(JSON.stringify(s))).toEqual(s);
  });

  it("returns an empty state for missing or broken values", () => {
    expect(parseDayPhotos(null)).toEqual(emptyDayPhotos());
    expect(parseDayPhotos("{")).toEqual(emptyDayPhotos());
    expect(parseDayPhotos(JSON.stringify({ version: 2, photos: [], drafts: [] }))).toEqual(emptyDayPhotos());
  });

  it("drops bad rows and draft ids for dropped photos", () => {
    const raw = JSON.stringify({
      version: 1,
      photos: [photo("ok", "2026-10-09", 1), photo("path", "2026-10-09", 1, { file: "../../etc.jpg" }), photo("big", "2026-10-09", 1, { aspect: 9 }), { id: "x" }],
      drafts: [{ date: "2026-10-09", photoIds: ["ok", "path"], stickerIds: [] }, { date: "nope", photoIds: [], stickerIds: [] }],
    });
    const parsed = parseDayPhotos(raw);
    expect(parsed.photos.map((p) => p.id)).toEqual(["ok"]);
    expect(parsed.drafts).toEqual([{ date: "2026-10-09", photoIds: ["ok"], stickerIds: [] }]);
  });
});
