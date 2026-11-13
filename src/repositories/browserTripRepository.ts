import type { TripLibrary } from "../domain/workspace/types";
import {
  parseTripLibrary,
  TripWorkspaceDataError,
  type TripLibraryRepository,
} from "./tripRepository";

const databaseName = "osaka-pocket";
const storeName = "trip-workspace";
const libraryKey = "library-v3";
const previousLibraryKey = "library";
// 저장 형식 1이 쓰던 키. 새 키가 비어 있을 때만 읽어서 옮기고, 되돌릴 근거로 지우지 않고 둔다.
const legacyWorkspaceKey = "active";
const libraryStorageKey = "osaka-pocket.trip-library.v3";
const previousLibraryStorageKey = "osaka-pocket.trip-library.v2";
const legacyStorageKey = "osaka-pocket.trip-workspace.v1";

interface BrowserTripRepositoryDependencies {
  indexedDb?: IDBFactory;
  storage?: Storage;
}

export function createBrowserTripRepository(
  dependencies: BrowserTripRepositoryDependencies = {},
): TripLibraryRepository {
  const indexedDb = dependencies.indexedDb ?? globalThis.indexedDB;
  const storage = dependencies.storage ?? globalThis.localStorage;

  function importJson(json: string): TripLibrary {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json) as unknown;
    } catch {
      throw new TripWorkspaceDataError();
    }
    return parseTripLibrary(parsed);
  }

  return {
    async load() {
      let previousValue: unknown;
      if (indexedDb !== undefined) {
        try {
          const stored = await readIndexedDb(indexedDb, libraryKey);
          if (stored !== undefined) return parseTripLibrary(stored);
          previousValue =
            (await readIndexedDb(indexedDb, previousLibraryKey)) ??
            (await readIndexedDb(indexedDb, legacyWorkspaceKey));
        } catch (error) {
          if (error instanceof TripWorkspaceDataError) throw error;
        }
      }

      const currentFallback = storage.getItem(libraryStorageKey);
      if (currentFallback !== null) return importJson(currentFallback);
      if (previousValue !== undefined) return parseTripLibrary(previousValue);
      const fallback = storage.getItem(previousLibraryStorageKey) ?? storage.getItem(legacyStorageKey);
      return fallback === null ? null : importJson(fallback);
    },

    async save(library) {
      const safeLibrary = parseTripLibrary(library);
      if (indexedDb !== undefined) {
        try {
          await writeIndexedDb(indexedDb, libraryKey, safeLibrary);
          return;
        } catch {
          // Safari private mode can expose IndexedDB but reject transactions.
        }
      }
      storage.setItem(libraryStorageKey, JSON.stringify(safeLibrary));
    },

    async reset() {
      if (indexedDb !== undefined) {
        try {
          await deleteIndexedDbValues(indexedDb, [libraryKey, previousLibraryKey, legacyWorkspaceKey]);
        } catch {
          // Always clear the fallback even when IndexedDB is unavailable.
        }
      }
      storage.removeItem(libraryStorageKey);
      storage.removeItem(previousLibraryStorageKey);
      storage.removeItem(legacyStorageKey);
    },

    exportJson(library) {
      return JSON.stringify(parseTripLibrary(library), null, 2);
    },

    importJson,
  };
}

async function openDatabase(indexedDb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
}

async function readIndexedDb(indexedDb: IDBFactory, key: string): Promise<unknown> {
  const database = await openDatabase(indexedDb);
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result as unknown);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB read aborted"));
    });
  } finally {
    database.close();
  }
}

async function writeIndexedDb(
  indexedDb: IDBFactory,
  key: string,
  library: TripLibrary,
): Promise<void> {
  const database = await openDatabase(indexedDb);
  try {
    await runWriteTransaction(database, (store) => {
      store.put(library, key);
    });
  } finally {
    database.close();
  }
}

async function deleteIndexedDbValues(
  indexedDb: IDBFactory,
  keys: readonly string[],
): Promise<void> {
  const database = await openDatabase(indexedDb);
  try {
    await runWriteTransaction(database, (store) => {
      for (const key of keys) store.delete(key);
    });
  } finally {
    database.close();
  }
}

async function runWriteTransaction(
  database: IDBDatabase,
  operation: (store: IDBObjectStore) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    operation(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB write failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB write aborted"));
  });
}
