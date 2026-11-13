import { coverStyles, defaultDesign, fallbackCover, legacyCoverStyles, resolveCover } from "../src/data/notebookDesign";
import { describe, expect, it } from "vitest";
import { createTrip } from "../../src/domain/workspace/tripForm";
import { addTrip } from "../../src/domain/workspace/library";
import { emptyNotebook, parseNotebook } from "../src/data/model";
import { createNotebookRepository } from "../src/data/repository";
function fixture() {
  const data = emptyNotebook();
  const trip = createTrip(
    {
      title: "여행",
      startDate: "2026-10-08",
      endDate: "2026-10-12",
      baseCurrency: "KRW",
      members: [{ name: "나" }],
      coverColor: "ink",
      timeZone: "Asia/Seoul",
      reservations: [
        {
          id: "stay",
          kind: "stay",
          title: "숙소",
          startDate: "2026-10-08",
          endDate: "2026-10-12",
          timeZone: "Asia/Seoul",
          updatedAt: new Date().toISOString(),
        },
      ],
    },
    { id: "trip", now: new Date() },
  );
  data.library = addTrip(data.library, trip);
  data.pages.push({
    id: "note",
    tripId: trip.id,
    kind: "journal",
    title: "첫날",
    date: "2026-10-08",
    body: "산책",
    address: "",
    done: false,
  });
  return data;
}
describe("native notebook persistence", () => {
  it("restores reservations and native journal through repository and backup", async () => {
    let raw: string | null = null;
    const repo = createNotebookRepository({
      read: async () => raw,
      write: async (json) => {
        raw = json;
      },
    });
    expect((await repo.load()).library.trips).toHaveLength(0);
    await repo.save(fixture());
    const restored = await repo.load();
    expect(restored.library.trips[0].reservations?.[0].title).toBe("숙소");
    expect(restored.pages[0].body).toBe("산책");
    expect(parseNotebook(JSON.stringify(restored))).toEqual(restored);
  });
  it("rejects corrupted data without overwriting it", async () => {
    let writes = 0;
    const repo = createNotebookRepository({
      read: async () => "{broken",
      write: async () => {
        writes++;
      },
    });
    await expect(repo.load()).rejects.toThrow();
    expect(writes).toBe(0);
  });
  it("surfaces disk failure without success", async () => {
    const repo = createNotebookRepository({
      read: async () => null,
      write: async () => {
        throw new Error("disk full");
      },
    });
    await expect(repo.save(fixture())).rejects.toThrow("disk full");
  });
  it("imports web v3 and rejects secrets, dangling entries and duplicates", () => {
    const data = fixture();
    expect(parseNotebook(JSON.stringify(data.library)).pages).toEqual([]);
    expect(() =>
      parseNotebook(
        JSON.stringify({ ...data, pages: [...data.pages, ...data.pages] }),
      ),
    ).toThrow();
    expect(() =>
      parseNotebook(
        JSON.stringify({
          ...data,
          pages: [{ ...data.pages[0], tripId: "other" }],
        }),
      ),
    ).toThrow();
    Object.assign(data.library.trips[0].reservations![0], {
      bookingCode: "secret",
    });
    expect(() => parseNotebook(JSON.stringify(data))).toThrow();
  });
});

it("round-trips notebook design and accepts older backups", () => {
  const data = fixture();
  expect(parseNotebook(JSON.stringify(data)).designs).toBeUndefined();
  data.designs = {trip: {...defaultDesign("grid"), sections: ["place", "journal"], paper: "dots"}};
  expect(parseNotebook(JSON.stringify(data)).designs).toEqual(data.designs);
  for (const invalid of [ {...defaultDesign(), sections:["place","place"]}, {...defaultDesign(), paper:"unknown"}, {...defaultDesign(), cover:"unknown"} ]) {
    expect(()=>parseNotebook(JSON.stringify({...data,designs:{trip:invalid}}))).toThrow();
  }
  expect(()=>parseNotebook(JSON.stringify({...data,designs:{missing:defaultDesign()}}))).toThrow();
});

it.each(["blackSilver", "silverPress", "boneArchive"] as const)("preserves the %s cover through backup export and import", cover => {
  const data = fixture();
  data.designs = { trip: defaultDesign(cover) };
  const restored = parseNotebook(JSON.stringify(data));
  expect(restored.designs?.trip.cover).toBe(cover);
  expect(restored.library.trips[0].settings.coverColor).toBe("ink");
});

it.each(coverStyles)("round-trips the travel diary cover %s", cover => {
  const data = fixture();
  data.designs = { trip: defaultDesign(cover) };
  expect(parseNotebook(JSON.stringify(data)).designs?.trip.cover).toBe(cover);
});

it.each(legacyCoverStyles)("opens legacy %s backups using a current diary cover", cover => {
  const data = fixture();
  data.designs = { trip: defaultDesign(cover) };
  const restored = parseNotebook(JSON.stringify(data));
  expect(coverStyles).toContain(resolveCover(restored.designs!.trip.cover));
  expect(restored.library.trips[0].settings.title).toBe(data.library.trips[0].settings.title);
});

it("keeps earlier cover families usable without changing stored travel data", () => {
  expect(resolveCover("midnightPassport")).toBe("ogive");
  expect(resolveCover("silverRoute")).toBe("ironwork");
  expect(resolveCover("ivoryPostcard")).toBe("roseWindow");
  expect(defaultDesign().cover).toBe("ogive");
  expect(fallbackCover("silverBinding")).toBe("ink");
  expect(fallbackCover("vellumJournal")).toBe("sky");
});

it("preserves packing checks and rejects orphan or malformed packing items", () => {
  const data=fixture();
  const item={id:"charger",tripId:"trip",title:"충전기",done:true};
  data.packing=[item];
  expect(parseNotebook(JSON.stringify(data)).packing).toEqual(data.packing);
  expect(()=>parseNotebook(JSON.stringify({...data,packing:[{...item,tripId:"missing"}]}))).toThrow();
  expect(()=>parseNotebook(JSON.stringify({...data,packing:[item,item]}))).toThrow();
  expect(()=>parseNotebook(JSON.stringify({...data,packing:[{...item,done:"yes"}]}))).toThrow();
});

describe("diary backup metadata", () => {
  it("round-trips local voice references, route and steps alongside existing pages", () => {
    const data = {
      ...fixture(),
      diaryMemories: [
        {
          tripId: "trip",
          date: "2026-10-08",
          voices: [{ file: "voice-123.m4a", seconds: 3 }],
          route: [{ latitude: 35, longitude: 139, timestamp: 123 }],
          steps: 1200,
        },
      ],
    };
    expect(parseNotebook(JSON.stringify(data))).toEqual(data);
    expect(() =>
      parseNotebook(
        JSON.stringify({
          ...data,
          diaryMemories: [{ ...data.diaryMemories[0], tripId: "missing" }],
        }),
      ),
    ).toThrow();
    expect(() =>
      parseNotebook(
        JSON.stringify({
          ...data,
          diaryMemories: [
            {
              ...data.diaryMemories[0],
              voices: [{ file: "../secret", seconds: 3 }],
            },
          ],
        }),
      ),
    ).toThrow();
  });
});
