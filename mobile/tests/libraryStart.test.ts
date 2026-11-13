import { expect, it } from "vitest";
import { createTrip } from "../../src/domain/workspace/tripForm";
import { selectFeaturedTrip } from "../src/data/libraryStart";
const make=(id:string,startDate:string,endDate:string)=>createTrip({title:id,startDate,endDate,timeZone:"Asia/Seoul",members:[{name:"나"}],baseCurrency:"KRW",coverColor:"ink"},{id,now:new Date("2026-10-11T00:00:00Z")});
const now=new Date("2026-10-11T00:00:00Z");
it("selects current travel before upcoming and past trips",()=>{
 const current=make("current","2026-10-09","2026-10-12"),future=make("future","2026-11-01","2026-11-02"),past=make("past","2026-09-01","2026-09-02");
 expect(selectFeaturedTrip([past,future,current],now)?.id).toBe("current");
 expect(selectFeaturedTrip([past,future],now)?.id).toBe("future");
 expect(selectFeaturedTrip([],now)).toBeUndefined();
});
