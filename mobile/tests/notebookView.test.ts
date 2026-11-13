import { describe, expect, it } from "vitest";
import { createTrip } from "../../src/domain/workspace/tripForm";
import type { PageEntry } from "../src/data/model";
import { notebookDay, plansForDate, latestJournal, reservationSummary, expenseGroups, todaySpending, nextJourney, titleRepeatsRoute } from "../src/data/notebookView";

const trip = createTrip({title:"바다 수첩",startDate:"2026-10-08",endDate:"2026-10-12",timeZone:"Asia/Seoul",baseCurrency:"KRW",members:[{name:"나"},{name:"동행"}],coverColor:"ink"},{id:"trip",now:new Date("2026-10-01T00:00:00Z")});
const page = (id: string, date: string, kind: PageEntry["kind"] = "plan"): PageEntry => ({ id, date, kind, tripId:trip.id,title:id,body:"",address:"",done:false });

describe("notebook opening context", () => {
  it("uses the trip's local day and clamps new plans before and after travel", () => {
    expect(notebookDay(trip.settings,new Date("2026-10-07T15:01:00Z"))).toMatchObject({phase:"during",date:"2026-10-08",day:1});
    expect(notebookDay(trip.settings,new Date("2026-10-06T00:00:00Z"))).toMatchObject({phase:"before",date:"2026-10-08"});
    expect(notebookDay(trip.settings,new Date("2026-10-13T00:00:00Z"))).toMatchObject({phase:"after",date:"2026-10-12"});
  });
  it("counts the whole trip length for the \"Day n / total\" label", () => {
    // 10-08 ~ 10-12 → 5일, 10-10 현지 시각은 3일째
    expect(notebookDay(trip.settings,new Date("2026-10-10T03:00:00Z"))).toMatchObject({day:3,total:5});
  });
  it("includes imported plans on the local day and excludes other trips and dates", () => {
    const imported = {...trip,schedule:{...trip.schedule,activities:[{id:"web",title:"항구",targetAt:"2026-10-08T16:00:00Z",placeName:"항구",kind:"note" as const,priority:"flexible" as const,timeKind:"target" as const,durationMinutes:0,routeTimingStale:false}]}};
    const pages = [page("tomorrow","2026-10-10"),page("today","2026-10-09"),{...page("other","2026-10-09"),tripId:"other"}];
    expect(plansForDate(imported,pages,"2026-10-09").map(p=>p.title)).toEqual(["today","항구"]);
    expect(plansForDate(imported,[],"2026-10-09")).toHaveLength(1);
  });
  it("chooses the latest dated journal instead of a backfilled older entry", () => {
    expect(latestJournal([page("new","2026-10-11","journal"),page("old","2026-10-08","journal")])?.id).toBe("new");
  });
});
describe("reservation and expense summaries", () => {
  it("counts nights over year boundaries without inventing a missing checkout", () => {
    const stay = {id:"stay",kind:"stay" as const,title:"숙소",startDate:"2026-12-30",endDate:"2027-01-02",timeZone:"Asia/Seoul",updatedAt:trip.updatedAt};
    expect(reservationSummary(stay)).toContain("3박");
    expect(reservationSummary(stay)).toContain("2027");
    expect(reservationSummary({...stay,endDate:undefined})).toContain("체크아웃 미정");
    expect(reservationSummary(stay,"en-US")).toContain("3 nights");
    expect(reservationSummary({...stay,endDate:undefined},"ja")).toContain("チェックアウト未定");
  });
  it("labels both local time zones for cross-zone transport", () => {
    const flight = {id:"flight",kind:"flight" as const,title:"항공",startDate:"2026-10-08",endDate:"2026-10-08",startTime:"10:00",endTime:"08:00",timeZone:"Asia/Seoul",endTimeZone:"America/Los_Angeles",departure:"서울",arrival:"로스앤젤레스",updatedAt:trip.updatedAt};
    expect(reservationSummary(flight)).toContain("서울 → 로스앤젤레스");
    // IANA 이름 대신 도시 이름으로 적는다.
    expect(reservationSummary(flight)).toContain("10.8 10:00 (서울 시각) → 10.8 08:00 (로스앤젤레스 시각)");
    expect(reservationSummary(flight,"en-US")).toContain("(Seoul time)");
    expect(reservationSummary(flight,"ja")).toContain("(ロサンゼルス時間)");
    expect(reservationSummary(flight)).not.toContain("America/");
    expect(reservationSummary({...flight,endTimeZone:"Asia/Seoul"})).not.toContain("시각");
    expect(reservationSummary({...flight,timeZone:""})).not.toContain("( 시각)");
  });
  it("skips the route line when the title already names both ends", () => {
    const flight = {id:"f",kind:"flight" as const,title:"ZZ202 · BBB → AAA",serviceNumber:"ZZ202",startDate:"2026-10-12",endDate:"2026-10-12",startTime:"20:20",endTime:"22:15",timeZone:"Asia/Tokyo",endTimeZone:"Asia/Seoul",departure:"BBB",arrival:"AAA",updatedAt:trip.updatedAt};
    expect(reservationSummary(flight)).toBe("10.12 20:20 (도쿄 시각) → 10.12 22:15 (서울 시각)");
    expect(reservationSummary({...flight,title:"귀국편"})).toBe("BBB → AAA\n10.12 20:20 (도쿄 시각) → 10.12 22:15 (서울 시각)");
    expect(reservationSummary({...flight,title:"AAA → BBB"})).toContain("BBB → AAA\n");
  });
  it("tells generated flight titles from ones the user named", () => {
    const r = {title:"",serviceNumber:"ZZ1",departure:"AAA",arrival:"BBB"};
    expect(titleRepeatsRoute({...r,title:"ZZ1 · AAA → BBB"})).toBe(true);
    expect(titleRepeatsRoute({...r,title:"ZZ1 AAA→BBB"})).toBe(true);
    expect(titleRepeatsRoute({...r,title:"가족 여행 AAA → BBB"})).toBe(false);
  });
});
describe("today tab summaries", () => {
  const expense = {id:"e",title:"라멘",amount:12000,currency:"KRW" as const,rateToBase:"1",category:"food" as const,method:"card" as const,occurredAt:"2026-10-09T03:00:00Z",paidBy:{kind:"member" as const,memberId:"me"},split:{kind:"even" as const,memberIds:["me"]}};
  it("totals only today's local spending and splits the budget over trip days", () => {
    const spending = {...trip,budget:{...trip.budget,totalBudgetMinor:500000},ledger:{...trip.ledger,expenses:[expense,{...expense,id:"y",occurredAt:"2026-10-08T03:00:00Z"}]}};
    expect(todaySpending(spending,"2026-10-09")).toEqual({spent:12000,dailyBudget:100000});
    expect(todaySpending(trip,"2026-10-09")).toEqual({spent:0,dailyBudget:undefined});
  });
});
describe("next journey", () => {
  const train = {id:"train",kind:"transport" as const,title:"신칸센",startDate:"2026-10-09",startTime:"14:30",endDate:"2026-10-09",endTime:"17:00",timeZone:"Asia/Tokyo",departure:"도쿄",arrival:"교토",updatedAt:trip.updatedAt};
  const flight = {...train,id:"flight",kind:"flight" as const,title:"귀국",startDate:"2026-10-12",startTime:"10:00",endDate:"2026-10-12",endTime:"12:00"};
  const stay = {id:"stay",kind:"stay" as const,title:"호텔",startDate:"2026-10-08",timeZone:"Asia/Tokyo",updatedAt:trip.updatedAt};
  it("counts down to today's departure, keeps showing while moving, then moves on", () => {
    expect(nextJourney([flight,stay,train],new Date("2026-10-09T03:00:00Z"))).toMatchObject({reservation:{id:"train"},until:{kind:"soon",hours:2,minutes:30}});
    expect(nextJourney([flight,train],new Date("2026-10-09T06:00:00Z"))).toMatchObject({reservation:{id:"train"},until:{kind:"moving"}});
    expect(nextJourney([flight,train],new Date("2026-10-09T09:00:00Z"))).toMatchObject({reservation:{id:"flight"},until:{kind:"days",days:3}});
    expect(nextJourney([flight],new Date("2026-10-12T04:00:00Z"))).toBeUndefined();
    expect(nextJourney([stay],new Date("2026-10-09T03:00:00Z"))).toBeUndefined();
  });
});
