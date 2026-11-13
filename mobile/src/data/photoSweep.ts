// 기기에만 둔 사진 파일 중 어느 수첩에도 걸리지 않은 것을 골라낸다. 파일을 직접 다루지 않는 순수 계산이다.
// 지우면 되돌릴 수 없으므로 애매하면 남긴다.
// - 수첩이 한 권도 없으면(첫 실행·읽기 이상) 아무것도 고르지 않는다.
// - 남은 수첩의 사진 설정을 읽을 수 없으면 그 폴더는 통째로 건너뛴다.
// - 방금 만든 파일(GRACE_MS 안)은 아직 설정에 적히기 전일 수 있어 남긴다.
// - 앱이 만드는 이름("<uuid>.jpg", "<tripId>-<ms>.jpg")이 아닌 파일은 건드리지 않는다(SWEEPABLE).

export type PhotoFolder = "hero" | "day-photos";

/** 기기 설정(today:) 안의 사진 설정 접두어. 값은 hero:<tripId> → 파일 이름, dayPhotos:<tripId> → DayPhotoState JSON. */
export const PHOTO_SETTING_PREFIXES = ["hero:", "dayPhotos:"] as const;

/** 복사 직후 설정 저장 전까지의 여유. 1시간 = 3,600,000ms. 사진 60장을 복사해도 이보다 훨씬 짧다. */
export const GRACE_MS = 60 * 60 * 1000;

export interface StoredPhotoFile {
  name: string;
  /** 마지막 수정 시각(ms). 모르면 null이고 지우지 않는다. */
  modifiedAt: number | null;
}

export interface PhotoSetting {
  /** "today:"를 뺀 키. 예: "hero:trip-1". */
  key: string;
  value: string;
}

export interface PhotoSweepPlan {
  /** 사라진 수첩의 사진 설정 키("today:"를 뺀 것). */
  settingKeys: string[];
  files: Record<PhotoFolder, string[]>;
}

// 정리 대상은 앱이 만드는 이름뿐이다. 그날의 장 사진은 "<uuid>.jpg", 첫 장 사진은 "<tripId>-<ms>.jpg".
// 같은 폴더를 다른 기능이 쓸 수 있으므로(예: 사진 스티커 "sticker-<id>.jpg") 다른 모양은 참조를 몰라도 남긴다.
const SWEEPABLE: Record<PhotoFolder, RegExp> = {
  "day-photos": /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i,
  hero: /^.+-\d{10,}\.jpg$/,
};

export function isPhotoFileName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(name) && !name.includes("..");
}

/** dayPhotos 값에서 파일 이름을 모두 꺼낸다. 형식이 낯설면 null(그 폴더를 정리하지 않게). parseDayPhotos와 달리 이상한 항목도 남긴다. */
export function dayPhotoFileNames(raw: string): string[] | null {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || !Array.isArray((v as { photos?: unknown }).photos)) return null;
    return ((v as { photos: unknown[] }).photos).flatMap((p) =>
      p && typeof p === "object" && typeof (p as { file?: unknown }).file === "string" ? [(p as { file: string }).file] : [],
    );
  } catch {
    return null;
  }
}

export function planPhotoSweep(input: {
  tripIds: readonly string[];
  settings: readonly PhotoSetting[];
  /** 폴더별 파일 목록. null이면 읽지 못한 것이라 그 폴더는 건너뛴다. */
  files: Record<PhotoFolder, readonly StoredPhotoFile[] | null>;
  now: number;
}): PhotoSweepPlan {
  const plan: PhotoSweepPlan = { settingKeys: [], files: { hero: [], "day-photos": [] } };
  if (!input.tripIds.length) return plan;
  const known = new Set(input.tripIds);
  const used: Record<PhotoFolder, Set<string>> = { hero: new Set(), "day-photos": new Set() };
  const blocked: Record<PhotoFolder, boolean> = { hero: false, "day-photos": false };

  for (const { key, value } of input.settings) {
    const folder: PhotoFolder | null = key.startsWith("hero:") ? "hero" : key.startsWith("dayPhotos:") ? "day-photos" : null;
    if (!folder) continue;
    const tripId = key.slice(key.indexOf(":") + 1);
    if (!known.has(tripId)) {
      plan.settingKeys.push(key);
      continue;
    }
    if (folder === "hero") {
      used.hero.add(value);
      continue;
    }
    const names = dayPhotoFileNames(value);
    if (names) names.forEach((n) => used["day-photos"].add(n));
    else blocked["day-photos"] = true;
  }

  for (const folder of ["hero", "day-photos"] as const) {
    const files = input.files[folder];
    if (!files || blocked[folder]) continue;
    plan.files[folder] = files
      .filter(
        (f) =>
          isPhotoFileName(f.name) &&
          SWEEPABLE[folder].test(f.name) &&
          !used[folder].has(f.name) &&
          f.modifiedAt !== null &&
          input.now - f.modifiedAt >= GRACE_MS,
      )
      .map((f) => f.name);
  }
  return plan;
}
