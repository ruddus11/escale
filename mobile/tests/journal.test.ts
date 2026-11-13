import { describe, expect, it } from "vitest";
import { journalHeading, prepareJournal } from "../src/data/journal";
import { emptyNotebook, parseNotebook, type PageEntry } from "../src/data/model";
import { createTrip } from "../../src/domain/workspace/tripForm";
import { addTrip } from "../../src/domain/workspace/library";

const page: PageEntry = { id:"entry", tripId:"trip", kind:"journal", date:"2026-10-17", title:"", body:"", address:"", done:false };

describe("journal writing", () => {
  it("saves a body-only entry with a useful list title and no duplicate reading heading", () => {
    const saved = prepareJournal({...page, body:"\n  바닷가를 걸었다.\n바람이 차가웠다.  "});
    expect(saved).toMatchObject({title:"바닷가를 걸었다.", body:"바닷가를 걸었다.\n바람이 차가웠다.", date:page.date});
    expect(journalHeading(saved!)).toBe("");
  });
  it("rejects an empty page but preserves an existing title-only entry", () => {
    expect(prepareJournal({...page,title:" \n",body:"\t "})).toBeUndefined();
    const saved=prepareJournal({...page,title:"  첫날  "});
    expect(saved?.title).toBe("첫날");
    expect(journalHeading(saved!)).toBe("첫날");
  });
  it("keeps a personal heading and all existing metadata", () => {
    const original={...page,title:"나의 첫 여행",body:"역 앞에서 만났다.",done:true};
    expect(prepareJournal(original)).toEqual(original);
    expect(journalHeading(original)).toBe(original.title);
  });
  it("bounds a long generated title without splitting an emoji or losing the body", () => {
    const body="a".repeat(119)+"🌙"+"b".repeat(150);
    const saved=prepareJournal({...page,body})!;
    expect(saved.title.length).toBeLessThanOrEqual(120);
    expect(saved.title).not.toMatch(/[\uD800-\uDBFF]$/);
    expect(saved.body).toBe(body);
    expect(journalHeading(saved)).toBe("");
  });
  it("does not duplicate an automatic heading when the title boundary ends in whitespace", () => {
    const saved=prepareJournal({...page,body:"a".repeat(119)+" rest of the line"})!;
    expect(saved.title).toBe("a".repeat(119));
    expect(journalHeading(saved)).toBe("");
  });
  it("preserves an existing matching title when the body is edited", () => {
    const initial={...page,title:"첫날",body:"첫날\n이른 기차를 탔다."};
    expect(journalHeading(initial)).toBe("");
    expect(prepareJournal({...initial,body:"둘째 날\n이른 기차를 탔다."})?.title).toBe("첫날");
  });
  it("round-trips a body-only journal through the unchanged backup schema", () => {
    const trip=createTrip({title:"Test",startDate:page.date,endDate:page.date,timeZone:"Asia/Seoul",baseCurrency:"KRW",members:[{name:"나"}],coverColor:"ink"},{id:"trip",now:new Date("2026-10-17T00:00:00Z")});
    const saved=prepareJournal({...page,body:"A quiet morning."})!;
    const data=emptyNotebook();
    data.library=addTrip(data.library,trip);
    data.pages.push(saved);
    expect(parseNotebook(JSON.stringify(data)).pages).toEqual([saved]);
  });
});
