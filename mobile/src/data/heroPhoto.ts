import * as ImagePicker from "expo-image-picker";
import { Directory, File, Paths } from "expo-file-system";
import { heroFileName } from "./firstPage";
import { clearPhotoFolder, deleteCacheCopies, deletePhotoFiles } from "./photoFiles";

// 첫 장 사진은 이 기기의 문서 폴더(hero/)에만 둔다. 수첩 백업과 서버에는 보내지 않는다.
const folder = () => new Directory(Paths.document, "hero");

export const heroFile = (name: string) => new File(folder(), name);

export function heroExists(name: string): boolean {
  try {
    return heroFile(name).exists;
  } catch {
    return false;
  }
}

/** 사진을 고르면 문서 폴더로 복사하고 파일 이름을 돌려준다. 취소하면 null. */
export async function pickHeroPhoto(tripId: string): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, exif: false, allowsMultipleSelection: false });
  const picked = result.canceled ? undefined : result.assets[0]?.uri;
  if (!picked) return null;
  const dir = folder();
  if (!dir.exists) dir.create({ intermediates: true });
  const name = heroFileName(tripId, new Date());
  await new File(picked).copy(heroFile(name));
  // 사진 고르기가 캐시에 만든 사본은 바로 지운다.
  deleteCacheCopies([picked]);
  return name;
}

export function removeHeroPhoto(name: string | null): void {
  if (name) deletePhotoFiles("hero", [name]);
}

/** 로그아웃할 때 이 기기의 첫 장 사진을 모두 지운다. */
export function clearHeroPhotos(): void {
  clearPhotoFolder("hero");
}
