import { Directory,File,Paths } from "expo-file-system";

const folder = () => new Directory(Paths.document, "day-photos");
const SAFE_NAME = /^sticker-[A-Za-z0-9_-]{1,120}\.(?:jpe?g|png|webp|heic|heif)$/i;

export function stickerPhotoUri(name: string): string | null {
  return SAFE_NAME.test(name) ? new File(folder(), name).uri : null;
}
