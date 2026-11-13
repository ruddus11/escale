import { describe, expect, it } from "vitest";
import { GRACE_MS, dayPhotoFileNames, isPhotoFileName, planPhotoSweep, type StoredPhotoFile } from "../src/data/photoSweep";

const NOW = 1_800_000_000_000;
const old = (name: string): StoredPhotoFile => ({ name, modifiedAt: NOW - GRACE_MS - 1 });
const uuid = (c: string) => `${c.repeat(8)}-${c.repeat(4)}-4${c.repeat(3)}-8${c.repeat(3)}-${c.repeat(12)}.jpg`;
const [A, B, G] = [uuid("a"), uuid("b"), uuid("c")];
const hero = (trip: string, n: number) => `${trip}-${1_700_000_000_000 + n}.jpg`;
const [H0, H1, HG, HH, HX, HN, HU] = [hero("t1", 0), hero("t1", 1), hero("gone", 1), hero("h", 1), hero("x", 1), hero("new", 1), hero("unknown", 1)];
const day = (...files: string[]) => JSON.stringify({ version: 1, photos: files.map((file, i) => ({ id: `p${i}`, file })), drafts: [] });

describe("planPhotoSweep", () => {
  it("keeps referenced files and picks unreferenced ones", () => {
    const plan = planPhotoSweep({
      tripIds: ["t1"],
      settings: [
        { key: "hero:t1", value: H1 },
        { key: "dayPhotos:t1", value: day(A) },
      ],
      files: { hero: [old(H1), old(H0)], "day-photos": [old(A), old(B)] },
      now: NOW,
    });
    expect(plan).toEqual({ settingKeys: [], files: { hero: [H0], "day-photos": [B] } });
  });

  it("drops settings and files of a notebook that is gone", () => {
    const plan = planPhotoSweep({
      tripIds: ["t1"],
      settings: [
        { key: "hero:gone", value: HG },
        { key: "dayPhotos:gone", value: day(G) },
        { key: "dayPhotos:t1", value: day(A) },
      ],
      files: { hero: [old(HG)], "day-photos": [old(A), old(G)] },
      now: NOW,
    });
    expect(plan.settingKeys).toEqual(["hero:gone", "dayPhotos:gone"]);
    expect(plan.files).toEqual({ hero: [HG], "day-photos": [G] });
  });

  it("does nothing when there is no notebook", () => {
    const plan = planPhotoSweep({ tripIds: [], settings: [{ key: "hero:x", value: HX }], files: { hero: [old(HX)], "day-photos": [old(A)] }, now: NOW });
    expect(plan).toEqual({ settingKeys: [], files: { hero: [], "day-photos": [] } });
  });

  it("skips the day folder when a live notebook's photo setting cannot be read", () => {
    const plan = planPhotoSweep({
      tripIds: ["t1"],
      settings: [{ key: "dayPhotos:t1", value: "{broken" }],
      files: { hero: [old(HH)], "day-photos": [old(A)] },
      now: NOW,
    });
    expect(plan.files).toEqual({ hero: [HH], "day-photos": [] });
  });

  it("skips a folder that could not be listed", () => {
    const plan = planPhotoSweep({ tripIds: ["t1"], settings: [], files: { hero: null, "day-photos": [old(A)] }, now: NOW });
    expect(plan.files).toEqual({ hero: [], "day-photos": [A] });
  });

  it("keeps fresh files, files with unknown time and names the app does not make", () => {
    const plan = planPhotoSweep({
      tripIds: ["t1"],
      settings: [],
      files: {
        hero: [{ name: HN, modifiedAt: NOW - 1000 }, { name: HU, modifiedAt: null }, old("cover.jpg")],
        "day-photos": [old("notes.txt"), old(".hidden.jpg"), old("stray.jpg"), old(A.toUpperCase().replace(".JPG", ".jpg"))],
      },
      now: NOW,
    });
    expect(plan.files).toEqual({ hero: [], "day-photos": [A.toUpperCase().replace(".JPG", ".jpg")] });
  });

  it("keeps photo sticker files that share the day photo folder", () => {
    const plan = planPhotoSweep({
      tripIds: ["t1"],
      settings: [{ key: "dayPhotos:t1", value: day(A) }],
      files: { hero: [], "day-photos": [old(A), old("sticker-0f8c.jpg"), old(`sticker-${B}`), old(B)] },
      now: NOW,
    });
    expect(plan.files["day-photos"]).toEqual([B]);
  });
});

describe("dayPhotoFileNames", () => {
  it("reads every file name, even entries parseDayPhotos would drop", () => {
    expect(dayPhotoFileNames(JSON.stringify({ version: 1, photos: [{ file: A }, { id: "x", file: B }, null], drafts: [] }))).toEqual([A, B]);
  });
  it("returns null for unknown shapes", () => {
    expect(dayPhotoFileNames("nope")).toBeNull();
    expect(dayPhotoFileNames(JSON.stringify({ version: 2 }))).toBeNull();
  });
});

describe("isPhotoFileName", () => {
  it("accepts app names and rejects path tricks", () => {
    expect(isPhotoFileName("0f8c-uuid.jpg")).toBe(true);
    expect(isPhotoFileName("trip-1-1700000000000.jpg")).toBe(true);
    for (const bad of ["", "../a.jpg", "a/b.jpg", "a..jpg", ".jpg", "a\\b.jpg", "%2e%2e.jpg"]) expect(isPhotoFileName(bad)).toBe(false);
  });
});
