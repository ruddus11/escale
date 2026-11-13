import { openDatabaseAsync } from "expo-sqlite";
import { createNotebookRepository } from "./repository";
import { createPremiumStore } from "./premium";
import { parseConsent, type ConsentState } from "./consent";
import { LOCATION_DAYS, parseCachedPoint, type CachedPoint } from "./places";
import { createModeStore } from "./travelMode";
let opening: ReturnType<typeof open> | undefined;
async function open() {
  const db = await openDatabaseAsync("travel-pouch.db");
  await db.execAsync(
    "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS notebook (id INTEGER PRIMARY KEY CHECK(id = 1), payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS place_cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, at TEXT NOT NULL);",
  );
  return db;
}
export function database() {
  return (opening ??= open().catch((error) => {
    opening = undefined;
    throw error;
  }));
}
export const notebookRepository = createNotebookRepository({
  async read() {
    return (
      (
        await (
          await database()
        ).getFirstAsync<{ payload: string }>(
          "SELECT payload FROM notebook WHERE id = 1",
        )
      )?.payload ?? null
    );
  },
  async write(json) {
    await (
      await database()
    ).runAsync(
      "INSERT INTO notebook (id, payload) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
      json,
    );
  },
});
export const premiumStore = createPremiumStore({
  async read(key) {
    return (
      (
        await (
          await database()
        ).getFirstAsync<{ value: string }>(
          "SELECT value FROM app_settings WHERE key = ?",
          key,
        )
      )?.value ?? null
    );
  },
  async write(key, value) {
    await (
      await database()
    ).runAsync(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      key,
      value,
    );
  },
});
// 계정 동기화 상태(마지막으로 맞춘 서버 version과 수첩 지문). 수첩 백업 파일에는 넣지 않는다.
export const syncStateStore = {
  async load() {
    return (
      (
        await (
          await database()
        ).getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key = 'sync'")
      )?.value ?? null
    );
  },
  async save(value: string) {
    await (
      await database()
    ).runAsync(
      "INSERT INTO app_settings (key, value) VALUES ('sync', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      value,
    );
  },
  async clear() {
    await (await database()).runAsync("DELETE FROM app_settings WHERE key = 'sync'");
  },
};
// 세션이 만료되어도 기기 수첩의 마지막 소유자를 기억해 다른 계정과의 자동 병합을 막는다.
export const notebookOwnerStore = {
  async load(): Promise<string | null> {
    const row = await (await database()).getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key = 'notebook_owner'");
    if (row?.value) return row.value;
    const legacy = await syncStateStore.load();
    try {
      const parsed = legacy ? JSON.parse(legacy) as { userId?: unknown } : null;
      return typeof parsed?.userId === "string" ? parsed.userId : null;
    } catch { return null; }
  },
  async save(userId: string) {
    await (await database()).runAsync("INSERT INTO app_settings (key, value) VALUES ('notebook_owner', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", userId);
  },
  async clear() {
    await (await database()).runAsync("DELETE FROM app_settings WHERE key = 'notebook_owner'");
  },
};
// 앱 언어와 "큰 제목은 영어로". 수첩 백업 파일에는 넣지 않는다. 큰 제목은 처음엔 영어로 둔다.
export const prefsStore = {
  async load() {
    const rows = await (await database()).getAllAsync<{ key: string; value: string }>(
      "SELECT key, value FROM app_settings WHERE key IN ('language', 'titles_en')",
    );
    const saved = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { language: saved.language ?? null, titlesInEnglish: saved.titles_en !== "0" };
  },
  async save(key: "language" | "titles_en", value: string) {
    await (await database()).runAsync(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      key,
      value,
    );
  },
};
// 오늘 탭의 기기 전용 값(첫 장 채우기 닫음 dismissed:<tripId>, 첫 장 사진 파일 이름 hero:<tripId>, 추천 취향 taste:<tripId>,
// 예약에서 일정 채우기의 넣음·거절 기록 autofill:<tripId>). 수첩 백업에는 넣지 않는다.
export const todayStore = {
  async get(key: string) {
    const row = await (await database()).getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key = ?", `today:${key}`);
    return row?.value ?? null;
  },
  async set(key: string, value: string) {
    await (await database()).runAsync(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      `today:${key}`,
      value,
    );
  },
  async remove(key: string) {
    await (await database()).runAsync("DELETE FROM app_settings WHERE key = ?", `today:${key}`);
  },
  /** 접두어로 시작하는 값들. 키에서 "today:"는 뺀다. LIKE는 "_"를 와일드카드로 보므로 substr로 비교한다. */
  async list(prefixes: readonly string[]) {
    const db = await database();
    const out: { key: string; value: string }[] = [];
    for (const prefix of prefixes) {
      const full = `today:${prefix}`;
      const rows = await db.getAllAsync<{ key: string; value: string }>(
        "SELECT key, value FROM app_settings WHERE substr(key, 1, ?) = ?",
        full.length,
        full,
      );
      for (const r of rows) out.push({ key: r.key.slice("today:".length), value: r.value });
    }
    return out;
  },
  async clear() {
    await (await database()).runAsync("DELETE FROM app_settings WHERE key LIKE 'today:%'");
  },
};
// 여행 방식(계획형·즉흥형). 동기화 데이터가 아닌 기기 설정에만 둔다. 이유는 travelMode.ts의 createModeStore 설명.
// "today:" 접두어 밖에 두어 로그아웃해도 첫 실행 퀴즈를 다시 묻지 않는다. 수첩별 값은 수첩을 지울 때 함께 지운다.
export const modeStore = createModeStore({
  async get(key) {
    const row = await (await database()).getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key = ?", key);
    return row?.value ?? null;
  },
  async set(key, value) {
    await (await database()).runAsync(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      key,
      value,
    );
  },
  async remove(key) {
    await (await database()).runAsync("DELETE FROM app_settings WHERE key = ?", key);
  },
});
// 첫 화면에서 "로그인 없이 둘러보기"를 골랐는지. 로그아웃하면 지워서 첫 화면을 다시 보인다.
export const welcomeStore = {
  async skipped() {
    return !!(await (await database()).getFirstAsync("SELECT 1 FROM app_settings WHERE key = 'welcome_skipped'"));
  },
  async skip() {
    await (await database()).runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('welcome_skipped', '1')");
  },
  async reset() {
    await (await database()).runAsync("DELETE FROM app_settings WHERE key = 'welcome_skipped'");
  },
};
// 약관·개인정보·AI 기능 동의 기록. 수첩 백업 파일에는 넣지 않는다.
export const consentStore = {
  async load() {
    const row = await (await database()).getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key = 'consent'");
    return parseConsent(row?.value ?? null);
  },
  async save(state: ConsentState) {
    await (await database()).runAsync(
      "INSERT INTO app_settings (key, value) VALUES ('consent', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      JSON.stringify(state),
    );
  },
};
// 지도 위치 캐시. Google 정책상 좌표는 30일까지만 두므로 수첩·백업 파일에 넣지 않고 여기에만 둔다.
export const placeCacheStore = {
  async get(keys: string[]): Promise<Record<string, CachedPoint>> {
    if (!keys.length) return {};
    const rows = await (await database()).getAllAsync<{ key: string; value: string }>(
      `SELECT key, value FROM place_cache WHERE key IN (${keys.map(() => "?").join(",")})`,
      ...keys,
    );
    const found: Record<string, CachedPoint> = {};
    for (const row of rows) {
      const point = parseCachedPoint(row.value);
      if (point) found[row.key] = point;
    }
    return found;
  },
  async set(key: string, point: CachedPoint) {
    await (await database()).runAsync(
      "INSERT INTO place_cache (key, value, at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, at = excluded.at",
      key,
      JSON.stringify(point),
      point.at,
    );
  },
  /** 30일이 지난 좌표를 지운다. 앱을 열 때 한 번 부른다. */
  async purge(now: Date) {
    const cutoff = new Date(now.getTime() - LOCATION_DAYS * 86_400_000).toISOString();
    await (await database()).runAsync("DELETE FROM place_cache WHERE at < ?", cutoff);
  },
  /** 로그아웃해 기기 수첩을 지울 때 함께 지운다. */
  async clear() {
    await (await database()).runAsync("DELETE FROM place_cache");
  },
};
