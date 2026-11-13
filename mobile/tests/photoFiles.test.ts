import { beforeEach, describe, expect, it, vi } from "vitest";

// 메모리 안의 가짜 파일 시스템. 키는 파일 uri, 값은 수정 시각(ms).
const fs = vi.hoisted(() => ({ files: new Map<string, number | null>(), failDelete: new Set<string>(), failList: false }));
const settings = vi.hoisted(() => ({ rows: new Map<string, string>(), failList: false, failRemove: false, failRemoveKey: "" }));

vi.mock("expo-file-system", () => {
  const uriOf = (part: unknown) => (typeof part === "string" ? part : (part as { uri: string }).uri);
  const join = (parts: unknown[]) => parts.map(uriOf).map((p, i) => (i === 0 ? p.replace(/\/$/, "") : p.replace(/^\/|\/$/g, ""))).join("/");
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return fs.files.has(this.uri);
    }
    get name() {
      return this.uri.slice(this.uri.lastIndexOf("/") + 1);
    }
    get modificationTime() {
      return fs.files.get(this.uri) ?? null;
    }
    delete() {
      if (fs.failDelete.has(this.uri) || !fs.files.has(this.uri)) throw new Error("cannot delete");
      fs.files.delete(this.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = `${join(parts)}/`;
    }
    get exists() {
      return [...fs.files.keys()].some((k) => k.startsWith(this.uri));
    }
    list() {
      if (fs.failList) throw new Error("cannot list");
      return [...fs.files.keys()].filter((k) => k.startsWith(this.uri) && !k.slice(this.uri.length).includes("/")).map((k) => new File(k));
    }
    delete() {
      for (const k of [...fs.files.keys()]) if (k.startsWith(this.uri)) fs.files.delete(k);
    }
  }
  return { File, Directory, Paths: { document: new Directory("file:///app/Documents"), cache: new Directory("file:///app/Caches") } };
});
vi.mock("../src/data/sqlite", () => ({
  todayStore: {
    async list(prefixes: readonly string[]) {
      if (settings.failList) throw new Error("db");
      return [...settings.rows].filter(([k]) => prefixes.some((p) => k.startsWith(p))).map(([key, value]) => ({ key, value }));
    },
    async remove(key: string) {
      if (settings.failRemove || settings.failRemoveKey === key) throw new Error("db");
      settings.rows.delete(key);
    },
    async get(key: string) {
      return settings.rows.get(key) ?? null;
    },
    set: vi.fn(),
  },
}));
vi.mock("expo-image-picker", () => ({}));

import { GRACE_MS } from "../src/data/photoSweep";
import { clearPhotoFolder, deleteCacheCopies, deletePhotoFiles, deleteTripFiles, isInside, sweepOrphanPhotos } from "../src/data/photoFiles";
import { clearDayPhotos, dropPickerCopies, removeDayPhotoFiles } from "../src/data/dayPhotoStore";
import { clearHeroPhotos, removeHeroPhoto } from "../src/data/heroPhoto";

const DOC = "file:///app/Documents";
const CACHE = "file:///app/Caches";
const NOW = 1_800_000_000_000;
const OLD = NOW - GRACE_MS - 1;
const uuid = (c: string) => `${c.repeat(8)}-${c.repeat(4)}-4${c.repeat(3)}-8${c.repeat(3)}-${c.repeat(12)}.jpg`;
const [A, G, STRAY, FRESH] = [uuid("a"), uuid("b"), uuid("c"), uuid("d")];
const H1 = "t1-1700000000001.jpg";
const HG = "gone-1700000000001.jpg";
const day = (...files: string[]) => JSON.stringify({ version: 1, photos: files.map((file, i) => ({ id: `p${i}`, file })), drafts: [] });

beforeEach(() => {
  fs.files.clear();
  fs.failDelete.clear();
  fs.failList = false;
  settings.rows.clear();
  settings.failList = false;
  settings.failRemove = false;
  settings.failRemoveKey = "";
  settings.failRemove = false;
});

describe("isInside", () => {
  it("only allows paths under the root", () => {
    expect(isInside(`${DOC}/hero/a.jpg`, `${DOC}/hero/`)).toBe(true);
    expect(isInside(`${DOC}/hero/`, `${DOC}/hero/`)).toBe(false);
    expect(isInside(`${DOC}/hero-x/a.jpg`, `${DOC}/hero`)).toBe(false);
    expect(isInside(`${DOC}/hero/../secret.db`, `${DOC}/hero/`)).toBe(false);
    expect(isInside(`${DOC}/hero/%2e%2e/secret.db`, `${DOC}/hero/`)).toBe(false);
    expect(isInside("ph://ABC-123", `${CACHE}/`)).toBe(false);
  });

  it("treats iOS /private/var and percent-encoded forms as the same folder", () => {
    const root = "file:///var/mobile/Containers/Data/Application/X/Library/Caches/";
    expect(isInside("file:///private/var/mobile/Containers/Data/Application/X/Library/Caches/ImagePicker/a.jpg", root)).toBe(true);
    expect(isInside("file:///var/mobile/Containers/Data/Application/X/Library/Caches/a%20b.jpg", "file:///private/var/mobile/Containers/Data/Application/X/Library/Caches")).toBe(true);
    expect(isInside("file:///private/var/mobile/Containers/Data/Application/X/Documents/a.jpg", root)).toBe(false);
    expect(isInside("file:///private/var/mobile/Media/DCIM/100APPLE/IMG_0001.JPG", root)).toBe(false);
  });
});

describe("deletePhotoFiles", () => {
  it("deletes named files in the folder and ignores missing or unsafe names", () => {
    fs.files.set(`${DOC}/day-photos/a.jpg`, OLD);
    fs.files.set(`${DOC}/day-photos/keep.jpg`, OLD);
    fs.files.set(`${DOC}/travel-pouch.db`, OLD);
    deletePhotoFiles("day-photos", ["a.jpg", "missing.jpg", "../travel-pouch.db", "a.jpg"]);
    expect([...fs.files.keys()].sort()).toEqual([`${DOC}/day-photos/keep.jpg`, `${DOC}/travel-pouch.db`]);
  });

  it("never throws when the file system refuses", () => {
    fs.files.set(`${DOC}/hero/a.jpg`, OLD);
    fs.failDelete.add(`${DOC}/hero/a.jpg`);
    expect(() => deletePhotoFiles("hero", ["a.jpg"])).not.toThrow();
    expect(fs.files.has(`${DOC}/hero/a.jpg`)).toBe(true);
  });
});

describe("deleteCacheCopies", () => {
  it("deletes cache copies only", () => {
    fs.files.set(`${CACHE}/ImagePicker/x.jpg`, OLD);
    fs.files.set(`${DOC}/hero/x.jpg`, OLD);
    deleteCacheCopies([`${CACHE}/ImagePicker/x.jpg`, `${DOC}/hero/x.jpg`, "ph://library-asset", undefined, `${CACHE}/gone.jpg`]);
    expect([...fs.files.keys()]).toEqual([`${DOC}/hero/x.jpg`]);
  });
});

describe("delete wiring", () => {
  it("routes day photo, hero and picker removal through the helper", () => {
    fs.files.set(`${DOC}/day-photos/a.jpg`, OLD);
    fs.files.set(`${DOC}/hero/t-1.jpg`, OLD);
    fs.files.set(`${CACHE}/pick.jpg`, OLD);
    removeDayPhotoFiles(["a.jpg", "../hero/t-1.jpg"]);
    removeHeroPhoto("t-1.jpg");
    removeHeroPhoto(null);
    dropPickerCopies([`${CACHE}/pick.jpg`]);
    expect(fs.files.size).toBe(0);
  });

  it("clears whole photo folders on sign-out and leaves other app data", () => {
    fs.files.set(`${DOC}/day-photos/a.jpg`, OLD);
    fs.files.set(`${DOC}/hero/t-1.jpg`, OLD);
    fs.files.set(`${DOC}/other/keep.json`, OLD);
    clearDayPhotos();
    clearHeroPhotos();
    clearPhotoFolder("hero");
    expect([...fs.files.keys()]).toEqual([`${DOC}/other/keep.json`]);
  });
});

describe("sweepOrphanPhotos", () => {
  function seed() {
    settings.rows.set("hero:t1", H1);
    settings.rows.set("dayPhotos:t1", day(A));
    settings.rows.set("hero:gone", HG);
    settings.rows.set("dayPhotos:gone", day(G));
    settings.rows.set("taste:t1", "{}");
    for (const f of [`hero/${H1}`, `hero/${HG}`, `day-photos/${A}`, `day-photos/${G}`, `day-photos/${STRAY}`]) fs.files.set(`${DOC}/${f}`, OLD);
    fs.files.set(`${DOC}/day-photos/${FRESH}`, NOW - 1000);
  }

  it("removes photos of deleted notebooks and stray files, keeping live ones", async () => {
    seed();
    await sweepOrphanPhotos(["t1"], NOW);
    expect([...fs.files.keys()].sort()).toEqual([`${DOC}/day-photos/${A}`, `${DOC}/day-photos/${FRESH}`, `${DOC}/hero/${H1}`].sort());
    expect([...settings.rows.keys()].sort()).toEqual(["dayPhotos:t1", "hero:t1", "taste:t1"]);
  });

  it("does nothing when the notebook failed to load", async () => {
    seed();
    await sweepOrphanPhotos(null, NOW);
    expect(fs.files.size).toBe(6);
    expect(settings.rows.size).toBe(5);
  });

  it("does nothing when settings cannot be read", async () => {
    seed();
    settings.failList = true;
    await expect(sweepOrphanPhotos(["t1"], NOW)).resolves.toBeUndefined();
    expect(fs.files.size).toBe(6);
  });

  it("keeps files when removing a stale setting fails", async () => {
    seed();
    settings.failRemove = true;
    await sweepOrphanPhotos(["t1"], NOW);
    expect(fs.files.size).toBe(6);
  });

  it("skips a folder it cannot list", async () => {
    seed();
    fs.failList = true;
    await sweepOrphanPhotos(["t1"], NOW);
    expect(fs.files.size).toBe(6);
    expect(settings.rows.has("hero:gone")).toBe(false);
  });
});

describe("deleteTripFiles", () => {
  it("deletes a deleted notebook's photos, sticker files and device settings only", async () => {
    fs.files.set(`${DOC}/hero/${H1}`, NOW);
    fs.files.set(`${DOC}/hero/${HG}`, NOW);
    fs.files.set(`${DOC}/day-photos/${A}`, NOW);
    fs.files.set(`${DOC}/day-photos/${G}`, NOW);
    fs.files.set(`${DOC}/day-photos/sticker-s1.jpg`, NOW);
    fs.files.set(`${DOC}/day-photos/sticker-s2.jpg`, NOW);
    settings.rows.set("hero:t1", H1);
    settings.rows.set("dayPhotos:t1", day(A));
    settings.rows.set("taste:t1", "{}");
    settings.rows.set("dismissed:t1", "1");
    // 접두어가 겹치는 다른 수첩(t10)은 건드리지 않는다.
    settings.rows.set("hero:t10", HG);
    settings.rows.set("dayPhotos:t10", day(G));
    await deleteTripFiles("t1", ["sticker-s1.jpg", "../hero/x.jpg"]);
    expect([...fs.files.keys()].sort()).toEqual([`${DOC}/day-photos/${G}`, `${DOC}/day-photos/sticker-s2.jpg`, `${DOC}/hero/${HG}`]);
    expect([...settings.rows.keys()].sort()).toEqual(["dayPhotos:t10", "hero:t10"]);
  });

  it("removes dated arrivals and routes without touching another notebook", async () => {
    settings.rows.set("arrivals:t1:2026-11-12", "{}");
    settings.rows.set("dayRoute:t1:2026-11-12", "[]");
    settings.rows.set("arrivals:t10:2026-11-12", "{}");
    await deleteTripFiles("t1", []);
    expect([...settings.rows.keys()]).toEqual(["arrivals:t10:2026-11-12"]);
  });

  it("never throws when settings cannot be removed", async () => {
    settings.rows.set("hero:t1", H1);
    settings.failRemove = true;
    await expect(deleteTripFiles("t1", [])).resolves.toBeUndefined();
  });

  it("continues removing settings after one removal fails", async () => {
    settings.rows.set("hero:t1", H1);
    settings.rows.set("dayPhotos:t1", day(A));
    settings.rows.set("taste:t1", "{}");
    settings.rows.set("dismissed:t1", "1");
    settings.failRemoveKey = "dayPhotos:t1";
    await deleteTripFiles("t1", []);
    expect([...settings.rows.keys()]).toEqual(["dayPhotos:t1"]);
  });
});
