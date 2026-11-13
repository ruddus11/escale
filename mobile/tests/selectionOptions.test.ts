import { expect, it } from "vitest";
import { currencyOptions, timeZoneOptions, searchOptions } from "../src/data/selectionOptions";
it("finds currencies by Korean name or code",()=>{
 expect(searchOptions(currencyOptions(),"달러").some(o=>o.value==="USD")).toBe(true);
 expect(searchOptions(currencyOptions()," krw ")[0].value).toBe("KRW");
});
it("keeps stored zones and searches Korean city aliases",()=>{
 const zones=timeZoneOptions("Pacific/Chatham");
 expect(zones.some(o=>o.value==="Pacific/Chatham")).toBe(true);
 expect(searchOptions(zones,"파리")[0].value).toBe("Europe/Paris");
 expect(searchOptions(zones,"no-such-city")).toEqual([]);
});
it("labels options in the chosen language and still finds other names",()=>{
 expect(currencyOptions("en-US").find(o=>o.value==="EUR")?.label).toBe("Euro · EUR");
 expect(searchOptions(currencyOptions("ja"),"달러").some(o=>o.value==="USD")).toBe(true);
 expect(searchOptions(timeZoneOptions("Asia/Seoul","en-GB"),"lisbon")[0].value).toBe("Europe/Lisbon");
});
