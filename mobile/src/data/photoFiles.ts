import { Directory, File, Paths } from "expo-file-system";
import { tripSettingKeys } from "./notebookDelete";
import { dayPhotoFileNames, isPhotoFileName, planPhotoSweep, PHOTO_SETTING_PREFIXES, type PhotoFolder, type StoredPhotoFile } from "./photoSweep";
import { todayStore } from "./sqlite";

// 앱이 복사해 둔 사진 파일을 지우는 곳. 사진첩 원본이나 앱 폴더 밖 경로는 절대 지우지 않는다.
// 지우기는 화면 동작을 막지 않도록 실패해도 던지지 않는다. 남은 파일은 다음 고아 정리 때 지워진다.
// 이름은 isPhotoFileName을 통과한 것만 받는다. 경로 구분자·".."가 섞이면 폴더 밖을 가리킬 수 있다.

const folderOf = (folder: PhotoFolder) => new Directory(Paths.document, folder);

const withSlash = (uri: string) => (uri.endsWith("/") ? uri : `${uri}/`);

// iOS는 같은 앱 폴더를 file:///var/...와 file:///private/var/...(심볼릭 링크) 두 가지로 돌려줄 수 있어 한쪽으로 맞춘다.
const sameVar = (uri: string) => uri.replace(/^file:\/\/\/private\/var\//, "file:///var/");

/** uri가 root 폴더 안의 파일인지. 퍼센트 인코딩 차이를 풀어 비교하고, 인코딩된 ".."도 막는다. */
export function isInside(uri: string, root: string): boolean {
  let decoded: string;
  let base: string;
  try {
    decoded = sameVar(decodeURIComponent(uri));
    base = withSlash(sameVar(decodeURIComponent(root)));
  } catch {
    return false;
  }
  if (decoded.split("/").includes("..")) return false;
  return decoded.startsWith(base) && decoded.length > base.length;
}

function deleteFile(file: File, root: string): void {
  try {
    if (!isInside(file.uri, root)) return;
    if (file.exists) file.delete();
  } catch {
    /* 이미 없거나 지울 수 없으면 다음 정리에 맡긴다. */
  }
}

/** 앱 사진 폴더(hero/, day-photos/)의 파일을 이름으로 지운다. 없는 파일·이상한 이름은 건너뛴다. */
export function deletePhotoFiles(folder: PhotoFolder, names: readonly string[]): void {
  let root: string;
  try {
    root = folderOf(folder).uri;
  } catch {
    return;
  }
  for (const name of names) {
    if (!isPhotoFileName(name)) continue;
    try {
      deleteFile(new File(folderOf(folder), name), root);
    } catch {
      /* 다음 정리에 맡긴다. */
    }
  }
}

/** 사진 고르기·문서 고르기가 캐시 폴더에 만든 사본을 지운다. 캐시 밖(사진첩 원본 등) 주소는 건드리지 않는다. */
export function deleteCacheCopies(uris: readonly (string | undefined)[]): void {
  let root: string;
  try {
    root = Paths.cache.uri;
  } catch {
    return;
  }
  for (const uri of uris) {
    if (!uri || !isInside(uri, root)) continue;
    try {
      deleteFile(new File(uri), root);
    } catch {
      /* OS 캐시 정리에 맡긴다. */
    }
  }
}

/** 로그아웃할 때 사진 폴더를 통째로 지운다. */
export function clearPhotoFolder(folder: PhotoFolder): void {
  try {
    const dir = folderOf(folder);
    if (dir.exists) dir.delete();
  } catch {
    /* 다음 로그아웃이나 고아 정리 때 지운다. */
  }
}

/** 폴더 안 파일 목록. 폴더가 없으면 빈 목록, 읽지 못하면 null(정리를 건너뛰게). */
export function listPhotoFiles(folder: PhotoFolder): StoredPhotoFile[] | null {
  try {
    const dir = folderOf(folder);
    if (!dir.exists) return [];
    return dir.list().flatMap((entry) => (entry instanceof File ? [{ name: entry.name, modifiedAt: entry.modificationTime ?? null }] : []));
  } catch {
    return null;
  }
}

/**
 * 어느 수첩에도 걸리지 않은 사진 파일과 사라진 수첩의 사진 설정을 지운다. 앱 시작 때 수첩을 읽은 뒤 한 번 부른다.
 * tripIds가 null이면(수첩을 읽지 못함) 아무것도 지우지 않는다. 판단 규칙은 planPhotoSweep에 있다.
 */
export async function sweepOrphanPhotos(tripIds: readonly string[] | null, now = Date.now()): Promise<void> {
  try {
    if (!tripIds) return;
    const settings = await todayStore.list(PHOTO_SETTING_PREFIXES);
    const plan = planPhotoSweep({
      tripIds,
      settings,
      files: { hero: listPhotoFiles("hero"), "day-photos": listPhotoFiles("day-photos") },
      now,
    });
    // 설정을 먼저 지운다. 실패하면 파일도 두어, 남은 설정이 가리키는 파일이 사라지지 않게 한다.
    for (const key of plan.settingKeys) await todayStore.remove(key);
    deletePhotoFiles("hero", plan.files.hero);
    deletePhotoFiles("day-photos", plan.files["day-photos"]);
  } catch {
    /* 다음 시작 때 다시 정리한다. */
  }
}

/**
 * 지운 수첩의 사진 파일(첫 장·그날의 장·사진 스티커)과 기기 설정(today:)을 지운다. 수첩 저장이 끝난 뒤 부른다.
 * 실패해도 던지지 않는다. 설정 하나가 실패해도 나머지 설정의 정리는 계속한다.
 * stickerFiles는 수첩 검사(isDaySticker)를 통과한 "sticker-<id>.<ext>" 이름이다.
 */
export async function deleteTripFiles(tripId: string, stickerFiles: readonly string[]): Promise<void> {
  deletePhotoFiles("day-photos", stickerFiles);
  try {
    // list는 접두어 비교라 "hero:ab"가 "hero:abc"까지 잡으므로 정확한 키로 하나씩 읽는다.
    const hero = await todayStore.get(`hero:${tripId}`);
    if (hero) deletePhotoFiles("hero", [hero]);
  } catch {
    /* 사진 설정을 읽지 못해도 다른 설정은 정리한다. */
  }
  try {
    const day = await todayStore.get(`dayPhotos:${tripId}`);
    if (day) deletePhotoFiles("day-photos", dayPhotoFileNames(day) ?? []);
  } catch {
    /* 사진 설정을 읽지 못해도 다른 설정은 정리한다. */
  }
  try {
    const dated = await todayStore.list([`arrivals:${tripId}:`, `dayRoute:${tripId}:`]);
    for (const row of dated) await todayStore.remove(row.key).catch(() => undefined);
  } catch {
    /* 날짜별 설정을 못 읽어도 나머지 정리는 계속한다. */
  }
  for (const key of tripSettingKeys(tripId)) {
    try {
      await todayStore.remove(key);
    } catch {
      /* 해당 설정을 못 지워도 나머지는 정리한다. */
    }
  }
}
