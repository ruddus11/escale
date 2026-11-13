import { useCallback, useEffect, useRef, useState } from "react";
import { createTrip } from "../../domain/workspace/tripForm";
import { deviceTimeZone, zonedDate } from "../../domain/time/zoned";
import { emptyTripLibrary } from "../../domain/workspace/library";
import {
  createTripLibrary,
  getActiveTrip,
  replaceTrip,
} from "../../domain/workspace/library";
import type { TripLibrary, TripWorkspace } from "../../domain/workspace/types";
import { createBrowserTripRepository } from "../../repositories/browserTripRepository";
import type { TripLibraryRepository } from "../../repositories/tripRepository";
import { migrateTripLibrary } from "./migrateTripWorkspace";

interface WorkspaceClock {
  now(): Date;
}

interface UseTripWorkspaceOptions {
  repository?: TripLibraryRepository;
  /** 저장값이 없을 때 펼칠 기본 수첩 */
  seed?: TripWorkspace;
  clock?: WorkspaceClock;
}

type WorkspaceUpdater = (workspace: TripWorkspace) => TripWorkspace;

const blankNow = new Date();
const blankTimeZone = deviceTimeZone();
const blankDate = zonedDate(blankNow, blankTimeZone);
const blankWorkspace = createTrip({
  title: "새 여행",
  startDate: blankDate,
  endDate: blankDate,
  timeZone: blankTimeZone,
  baseCurrency: "KRW",
  localCurrency: "KRW",
  members: [{ name: "나" }],
  coverColor: "cobalt",
}, { id: "blank", now: blankNow });
const systemClock: WorkspaceClock = { now: () => new Date() };
const defaultRepository = createBrowserTripRepository();

/** 수첩 목록을 저장소와 맞춰 두고, 화면에는 지금 펼친 수첩을 workspace로 준다. */
export function useTripWorkspace({
  repository = defaultRepository,
  seed = blankWorkspace,
  clock = systemClock,
}: UseTripWorkspaceOptions = {}) {
  const [library, setLibrary] = useState<TripLibrary>(() =>
    (seed === blankWorkspace ? emptyTripLibrary() : createTripLibrary(structuredClone(seed))),
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const libraryRef = useRef(library);
  const hydratedRef = useRef(false);
  const loadFailedRef = useRef(false);
  const saveQueueRef = useRef(Promise.resolve());
  const isResettingRef = useRef(false);
  const resetPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let active = true;
    hydratedRef.current = false;
    setIsHydrated(false);

    repository
      .load()
      .then((storedLibrary) => {
        if (!active) return;
        loadFailedRef.current = false;
        setLoadFailed(false);
        if (storedLibrary === null) return;
        const migration = migrateTripLibrary(storedLibrary, seed);
        const safeLibrary = migration.library;
        libraryRef.current = safeLibrary;
        setLibrary(safeLibrary);
        if (migration.migrated) {
          saveQueueRef.current = saveQueueRef.current
            .catch(() => undefined)
            .then(() => repository.save(structuredClone(safeLibrary)))
            .catch(() => {
              if (active) setError("여행 데이터를 저장하지 못했습니다.");
            });
        }
      })
      .catch(() => {
        if (active) {
          loadFailedRef.current = true;
          setLoadFailed(true);
          setError("저장된 여행 데이터를 불러오지 못했습니다. 원본은 보존됩니다. 새로고침하거나 백업을 복구해주세요.");
        }
      })
      .finally(() => {
        if (!active) return;
        hydratedRef.current = true;
        setIsHydrated(true);
      });

    return () => {
      active = false;
    };
  }, [repository, seed]);

  const persist = useCallback(
    (nextLibrary: TripLibrary) => {
      const snapshot = structuredClone(nextLibrary);
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(() => repository.save(snapshot))
        .catch(() => {
          setError("여행 데이터를 저장하지 못했습니다.");
        });
    },
    [repository],
  );

  const commit = useCallback(
    (nextLibrary: TripLibrary) => {
      libraryRef.current = nextLibrary;
      setLibrary(nextLibrary);
      setError(null);
      persist(nextLibrary);
    },
    [persist],
  );

  const updateWorkspace = useCallback(
    (updater: WorkspaceUpdater) => {
      if (!hydratedRef.current || loadFailedRef.current || isResettingRef.current || libraryRef.current.trips.length === 0) return;

      const updatedAt = clock.now().toISOString();
      const current = libraryRef.current;
      const nextWorkspace = updater(structuredClone(getActiveTrip(current)));
      const stampedWorkspace: TripWorkspace = {
        ...nextWorkspace,
        schedule: {
          ...nextWorkspace.schedule,
          updatedAt,
        },
        updatedAt,
      };
      commit(replaceTrip(current, stampedWorkspace));
    },
    [clock, commit],
  );

  // 수첩 고르기·더하기·보관·지우기처럼 목록 전체를 바꾸는 일. 갱신 시각은 호출하는 쪽이 넣는다.
  const updateLibrary = useCallback(
    (updater: (library: TripLibrary) => TripLibrary) => {
      if (!hydratedRef.current || loadFailedRef.current || isResettingRef.current) return;
      commit(updater(structuredClone(libraryRef.current)));
    },
    [commit],
  );

  const replaceWorkspace = useCallback(
    (nextWorkspace: TripWorkspace) => {
      updateWorkspace(() => nextWorkspace);
    },
    [updateWorkspace],
  );

  // 가져오기는 목록 전체를 바꾼다. 백업 파일 하나가 이 기기의 수첩 전체다.
  const importWorkspace = useCallback(
    (json: string) => {
      if (isResettingRef.current) {
        throw new Error("Workspace reset is in progress");
      }
      const imported = repository.importJson(json);
      const migrated = migrateTripLibrary(imported, seed).library;
      const updatedAt = clock.now().toISOString();
      const stamped: TripLibrary = {
        ...migrated,
        trips: migrated.trips.map((trip) =>
          trip.id === migrated.activeTripId
            ? { ...trip, schedule: { ...trip.schedule, updatedAt }, updatedAt }
            : trip,
        ),
        updatedAt,
      };
      // 불러오기가 끝나기 전에는 저장값이 덮어쓸 수 있으므로 반영하지 않는다(기존 동작과 같음).
      if (hydratedRef.current) {
        loadFailedRef.current = false;
        setLoadFailed(false);
        commit(stamped);
      }
      return stamped;
    },
    [clock, commit, repository, seed],
  );

  const resetWorkspace = useCallback(() => {
    if (resetPromiseRef.current !== null) return resetPromiseRef.current;

    isResettingRef.current = true;
    const resetOperation = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await repository.reset();
        const restoredSeed = (seed === blankWorkspace ? emptyTripLibrary() : createTripLibrary(structuredClone(seed)));
        libraryRef.current = restoredSeed;
        setLibrary(restoredSeed);
        setError(null);
        loadFailedRef.current = false;
        setLoadFailed(false);
      });
    const completion = resetOperation.finally(() => {
      isResettingRef.current = false;
      resetPromiseRef.current = null;
    });
    resetPromiseRef.current = completion;
    saveQueueRef.current = completion.catch(() => undefined);
    return completion;
  }, [repository, seed]);

  return {
    workspace: library.trips.length === 0 ? blankWorkspace : getActiveTrip(library),
    library,
    isHydrated,
    loadFailed,
    error,
    updateWorkspace,
    updateLibrary,
    replaceWorkspace,
    importWorkspace,
    exportWorkspace: () => repository.exportJson(libraryRef.current),
    resetWorkspace,
    clearError: () => setError(null),
  };
}
