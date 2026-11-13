import { useCallback,useEffect,useRef,useState } from "react";
import { Directory,File,Paths } from "expo-file-system";
import { clearPhotoFolder,deleteCacheCopies,deletePhotoFiles } from "./photoFiles";
import { todayStore } from "./sqlite";
import { emptyDayPhotos,parseDayPhotos,type DayPhotoState } from "./photoDays";

// 그날의 장 사진은 첫 장 사진처럼 이 기기의 문서 폴더(day-photos/)에만 둔다. 수첩 백업과 서버에는 보내지 않는다.
// 자리·초안 표시도 기기 설정(today:dayPhotos:<tripId>)에 두어, 로그아웃하면 todayStore.clear()로 함께 지워진다.
const folder = () => new Directory(Paths.document, "day-photos");
const key = (tripId: string) => `dayPhotos:${tripId}`;

export const dayPhotoFile = (name: string) => new File(folder(), name);

export function dayPhotoExists(name: string): boolean {
  try {
    return dayPhotoFile(name).exists;
  } catch {
    return false;
  }
}

/** 사진 고르기가 캐시에 만든 사본을 지운다. 실패하면 OS 캐시 정리에 맡긴다. */
export function dropPickerCopies(uris: string[]): void {
  deleteCacheCopies(uris);
}

export function removeDayPhotoFiles(names: string[]): void {
  deletePhotoFiles("day-photos", names);
}

/** 로그아웃할 때 이 기기의 그날의 장 사진을 모두 지운다. */
export function clearDayPhotos(): void {
  clearPhotoFolder("day-photos");
}

/**
 * 한 수첩의 쪽 사진 상태. change는 앞선 저장이 끝난 뒤 최신 상태에 이어서 쓴다(빠르게 두 번 옮겨도 앞의 것을 덮지 않게).
 * 파일이 사라진 사진(앱 재설치·저장 공간 정리)은 읽을 때 뺀다.
 */
export function useDayPhotos(tripId: string) {
  const [state, setState] = useState<DayPhotoState>(emptyDayPhotos);
  const [ready, setReady] = useState(false);
  const latest = useRef(state);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let alive = true;
    setReady(false);
    const empty = emptyDayPhotos();
    latest.current = empty;
    setState(empty);
    todayStore.get(key(tripId)).then(
      (raw) => {
        if (!alive) return;
        const parsed = parseDayPhotos(raw);
        const present = new Set(parsed.photos.filter((p) => dayPhotoExists(p.file)).map((p) => p.id));
        const next = present.size === parsed.photos.length ? parsed : {
          ...parsed,
          photos: parsed.photos.filter((p) => present.has(p.id)),
          drafts: parsed.drafts.map((d) => ({ ...d, photoIds: d.photoIds.filter((id) => present.has(id)) })),
        };
        latest.current = next;
        setState(next);
        setReady(true);
      },
      // 읽지 못했을 때 빈 상태로 쓰기 시작하면 저장된 사진 자리를 덮어쓰므로, 준비되지 않은 채로 둔다.
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [tripId]);

  const change = useCallback(
    (update: (current: DayPhotoState) => DayPhotoState) => {
      const run = queue.current.catch(() => undefined).then(async () => {
        const next = update(latest.current);
        if (next === latest.current) return;
        await todayStore.set(key(tripId), JSON.stringify(next));
        latest.current = next;
        setState(next);
      });
      queue.current = run;
      return run;
    },
    [tripId],
  );

  return { state, ready, change };
}
