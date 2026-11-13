import { describe, expect, it } from "vitest";
import { createTrip } from "../../src/domain/workspace/tripForm";
import type { Reservation } from "../../src/domain/reservations/types";
import { assembleReservation, findCandidates } from "../../src/domain/reservations/confirmation";
import { parseNotebook, type PageEntry } from "../src/data/model";
import { dayPlan, mapTargets, nextUp, stayEvents, todayPlan, tripDays, timeZoneLabel } from "../src/data/dayPlan";

const base = createTrip({title:"리스본",startDate:"2026-10-13",endDate:"2026-10-16",timeZone:"Europe/Lisbon",baseCurrency:"KRW",members:[{name:"나"}],coverColor:"ink"},{id:"trip",now:new Date("2026-10-01T00:00:00Z")});
const plan = (id: string, time?: string, minutes?: number, date = "2026-10-14"): PageEntry => ({ id, tripId:"trip", kind:"plan", title:id, date, body:"", address:"", done:false, ...(time ? {time} : {}), ...(minutes ? {minutes} : {}) });
const res = (r: Partial<Reservation> & Pick<Reservation,"id"|"kind">): Reservation => ({ title:r.id, startDate:"2026-10-14", timeZone:"Europe/Lisbon", updatedAt:"2026-10-01T00:00:00Z", ...r });

describe("trip days", () => {
  it("lists every day with weekday and marks today in trip time", () => {
    const days = tripDays(base.settings, new Date("2026-10-14T10:00:00Z"));
    expect(days.map(d=>[d.index,d.date])).toEqual([[1,"2026-10-13"],[2,"2026-10-14"],[3,"2026-10-15"],[4,"2026-10-16"]]);
    expect(days.find(d=>d.isToday)?.index).toBe(2);
  });
});

describe("next up", () => {
  const day = dayPlan(base, [plan("a","09:00",60),plan("b","11:30"),{...plan("c","13:00"),done:true},plan("d","15:00")], "2026-10-14");
  it("keeps an item in progress until its end time", () => {
    expect(nextUp(day, new Date("2026-10-14T08:30:00Z"))?.title).toBe("a");
  });
  it("moves to the next unfinished item and skips finished ones", () => {
    expect(nextUp(day, new Date("2026-10-14T09:01:00Z"))?.title).toBe("b");
    expect(nextUp(day, new Date("2026-10-14T11:00:00Z"))?.title).toBe("d"); // b는 끝 시각을 모르니 시작이 지나면 넘긴다. c는 끝냄.
  });
  it("returns nothing after the last item", () => {
    expect(nextUp(day, new Date("2026-10-14T15:00:00Z"))).toBeUndefined();
  });
  it("skips a Seoul departure that already passed in Lisbon time", () => {
    const trip = {...base, reservations:[res({id:"seoul",kind:"flight",timeZone:"Asia/Seoul",startTime:"09:00"}),res({id:"lisbon",kind:"activity",startTime:"10:00"})]};
    const day = dayPlan(trip, [], "2026-10-14");
    expect(day.timed.map(item => item.id)).toEqual(["res-seoul", "res-lisbon"]);
    expect(nextUp(day, new Date("2026-10-14T08:00:00Z"))?.id).toBe("res-lisbon");
    expect(nextUp(day, new Date("2026-10-13T23:00:00Z"))?.id).toBe("res-seoul");
  });
  it("keeps untimed bookings out of next-up selection", () => {
    const day = dayPlan({...base, reservations:[res({id:"unknown",kind:"flight"})]}, [], "2026-10-14");
    expect(day.untimed.map(item => item.id)).toEqual(["res-unknown"]);
    expect(nextUp(day, new Date("2026-10-14T00:00:00Z"))).toBeUndefined();
  });
  it("uses each booking's current local date across the trip's midnight boundary", () => {
    const trip = {...base, reservations:[res({id:"seoul-next-day",kind:"flight",startDate:"2026-10-15",startTime:"03:00",timeZone:"Asia/Seoul"})]};
    const now = new Date("2026-10-14T16:00:00Z"); // 리스본 17:00, 서울 다음 날 01:00
    const today = todayPlan(trip, [], now);
    expect(today.timed.map(item => item.id)).toEqual(["res-seoul-next-day"]);
    expect(nextUp(today, now)?.id).toBe("res-seoul-next-day");
  });
  it("keeps an overnight flight visible after midnight in its departure zone", () => {
    const trip = {...base, reservations:[res({id:"overnight",kind:"flight",startDate:"2026-10-14",startTime:"23:00",timeZone:"Asia/Seoul",endDate:"2026-10-15",endTime:"05:00",endTimeZone:"Europe/Lisbon"})]};
    const now = new Date("2026-10-14T16:00:00Z"); // 서울 15일 01:00, 비행 중
    expect(nextUp(todayPlan(trip, [], now), now)?.id).toBe("res-overnight");
  });
});

describe("day plan", () => {
  it("merges plans and reservations in time order and leaves untimed plans aside", () => {
    const trip = {...base, reservations:[
      res({id:"train",kind:"transport",title:"포르투행 기차",startTime:"14:20",endDate:"2026-10-14",endTime:"17:10",departure:"리스본",arrival:"포르투",serviceNumber:"AP 523"}),
      res({id:"bnb",kind:"stay",title:"포르투 B&B",startDate:"2026-10-14",endDate:"2026-10-16"}),
      res({id:"museum",kind:"activity",title:"수도원 입장권",startTime:"10:30"}),
    ]};
    const day = dayPlan(trip, [plan("tower","09:00",60),plan("dinner","19:00"),plan("someday")], "2026-10-14");
    expect(day.timed.map(i=>[i.kind,i.title])).toEqual([["plan","tower"],["booking","수도원 입장권"],["move","리스본 → 포르투"],["plan","dinner"]]);
    expect(day.untimed.map(i=>i.title)).toEqual(["someday"]);
    expect(day.sleep?.title).toBe("포르투 B&B");
    expect(day.timed[2]).toMatchObject({detail:"AP 523 · 포르투행 기차",endLabel:"17:10",end:17*60+10});
  });

  it("measures free time, time left before a departure, and overlaps only from known end times", () => {
    const trip = {...base, reservations:[res({id:"train",kind:"transport",startTime:"14:20",endDate:"2026-10-14",endTime:"17:10"})]};
    const day = dayPlan(trip, [plan("a","09:00",60),plan("b","11:30",90),plan("c","13:30"),plan("d","19:00",30),plan("e","19:20")], "2026-10-14");
    expect(day.links).toEqual([
      {kind:"gap",minutes:90},              // a 10:00 끝 → b 11:30
      null,                                 // b 13:00 끝 → c 13:30, 한 시간이 안 됨
      null,                                 // c는 머무는 시간을 몰라 기차까지 여유를 계산하지 않음
      {kind:"gap",minutes:110},             // 기차 17:10 도착 → d 19:00
      {kind:"overlap",minutes:10},          // d 19:30 끝 → e 19:20
    ]);
    const tight = dayPlan(trip, [plan("lunch","13:00",50)], "2026-10-14");
    expect(tight.links).toEqual([{kind:"until",minutes:30,tight:true}]);
  });

  it("shows an overnight arrival on the next day and does not chain across time zones", () => {
    const trip = {...base, reservations:[res({id:"night",kind:"flight",startDate:"2026-10-13",startTime:"23:00",endDate:"2026-10-14",endTime:"05:00",arrival:"리스본",endTimeZone:"Europe/Lisbon",timeZone:"Asia/Seoul"})]};
    expect(dayPlan(trip, [], "2026-10-13").timed[0]).toMatchObject({kind:"move",endLabel:"+1 05:00",end:undefined});
    expect(dayPlan(trip, [], "2026-10-14").timed[0]).toMatchObject({kind:"arrive",title:"리스본 도착",start:300});
    expect(dayPlan(trip, [], "2026-10-14", "en-US").timed[0]).toMatchObject({title:"Arrive 리스본"});
  });
  it("groups a crossing-midnight booking by its own local date and sorts by instant", () => {
    const trip = {...base, reservations:[
      res({id:"seoul",kind:"flight",startDate:"2026-10-15",startTime:"00:30",timeZone:"Asia/Seoul"}),
      res({id:"lisbon",kind:"activity",startDate:"2026-10-15",startTime:"00:10"}),
    ]};
    expect(dayPlan(trip, [], "2026-10-14").timed).toEqual([]);
    const day = dayPlan(trip, [], "2026-10-15");
    expect(day.timed.map(item => item.id)).toEqual(["res-seoul", "res-lisbon"]);
    expect(nextUp(day, new Date("2026-10-14T15:00:00Z"))?.id).toBe("res-seoul");
  });
  it("uses the trip zone when a saved booking has no timezone", () => {
    const trip = {...base, reservations:[res({id:"fallback",kind:"activity",startTime:"10:00",timeZone:""})]};
    const day = dayPlan(trip, [], "2026-10-14");
    expect(nextUp(day, new Date("2026-10-14T08:30:00Z"))?.id).toBe("res-fallback");
    expect(nextUp(day, new Date("2026-10-14T09:01:00Z"))).toBeUndefined();
  });
  it("uses each date's DST offset without treating a nonexistent local time as upcoming", () => {
    const trip = {...base, reservations:[
      res({id:"before",kind:"activity",startDate:"2026-03-29",startTime:"00:30"}),
      res({id:"missing",kind:"activity",startDate:"2026-03-29",startTime:"01:30"}),
      res({id:"after",kind:"activity",startDate:"2026-03-29",startTime:"02:30"}),
    ]};
    const day = dayPlan(trip, [], "2026-03-29");
    expect(day.timed.map(item => item.id)).toEqual(["res-before", "res-after"]);
    expect(day.untimed.map(item => item.id)).toEqual(["res-missing"]);
    expect(nextUp(day, new Date("2026-03-29T01:00:00Z"))?.id).toBe("res-after");
  });
  it("keeps a cross-zone flight in progress until its real arrival", () => {
    const trip = {...base, reservations:[res({id:"night",kind:"flight",startDate:"2026-10-14",startTime:"23:00",timeZone:"Asia/Seoul",endDate:"2026-10-15",endTime:"05:00",endTimeZone:"Europe/Lisbon"})]};
    const departure = dayPlan(trip, [], "2026-10-14");
    expect(nextUp(departure, new Date("2026-10-14T15:00:00Z"))?.id).toBe("res-night");
    expect(nextUp(departure, new Date("2026-10-15T05:01:00Z"))).toBeUndefined();
  });
  it("uses the post-DST offset for an autumn booking", () => {
    const trip = {...base, reservations:[res({id:"winter",kind:"activity",startDate:"2026-10-25",startTime:"02:30"})]};
    const day = dayPlan(trip, [], "2026-10-25");
    expect(nextUp(day, new Date("2026-10-25T02:00:00Z"))?.id).toBe("res-winter");
    expect(nextUp(day, new Date("2026-10-25T02:31:00Z"))).toBeUndefined();
  });
  it("shows a short local timezone label in all supported languages only when zones differ", () => {
    const trip = {...base, reservations:[res({id:"seoul",kind:"flight",startTime:"09:00",timeZone:"Asia/Seoul"})]};
    const item = dayPlan(trip, [], "2026-10-14").timed[0];
    expect(timeZoneLabel(item, base.settings.timeZone, "ko")).toBe("서울");
    expect(timeZoneLabel(item, base.settings.timeZone, "en-GB")).toBe("Seoul");
    expect(timeZoneLabel(item, base.settings.timeZone, "ja")).toBe("ソウル");
    expect(timeZoneLabel(item, "Asia/Seoul", "ko")).toBe("");
  });

  // 예약 확인 메일 읽기로 채운 비행편. 제목은 "RF392 청주 → 도쿄 나리타"로 만들어진다.
  const flight = res({...assembleReservation(findCandidates("RF392 청주 CJJ 10월 14일 08:05 → 도쿄 나리타 NRT 10:30", 2026), {kind:"flight",startDate:"d1",startTime:"t1",endTime:"t2",departure:"p1",arrival:"p2",service:"s1"}), id:"rf392", kind:"flight"});

  it("does not repeat the title the booking reader made from the flight number and route", () => {
    expect(dayPlan({...base, reservations:[flight]}, [], "2026-10-14").timed[0]).toMatchObject({kind:"move",title:"청주 CJJ → 도쿄 나리타 NRT",detail:"RF392"});
  });

  it("still shows a flight title the user typed", () => {
    expect(dayPlan({...base, reservations:[{...flight,title:"가족 여행 출발편"}]}, [], "2026-10-14").timed[0]).toMatchObject({detail:"RF392 · 가족 여행 출발편"});
  });

  it("does not repeat the title generated from a flight photo", () => {
    const photoFlight = {...flight, title:"RF392 · 청주 CJJ → 도쿄 나리타 NRT"};
    expect(dayPlan({...base, reservations:[photoFlight]}, [], "2026-10-14").timed[0]).toMatchObject({detail:"RF392"});
  });

  it("does not repeat a flight number and route typed with other separators", () => {
    const codes = {...flight, serviceNumber:"ZZ101", departure:"AAA", arrival:"BBB"};
    for (const title of ["ZZ101 · AAA → BBB", "ZZ101 AAA→BBB", "ZZ101 - AAA > BBB", "ZZ101"])
      expect(dayPlan({...base, reservations:[{...codes,title}]}, [], "2026-10-14").timed[0]).toMatchObject({title:"AAA → BBB",detail:"ZZ101"});
    expect(dayPlan({...base, reservations:[{...codes,title:"ZZ101 · AAA → BBB 출장"}]}, [], "2026-10-14").timed[0]).toMatchObject({detail:"ZZ101 · AAA → BBB 출장"});
  });

  it("formats durations in Korean", () => {
  });
});

describe("map targets", () => {
  it("puts located plans and bookings in time order, then the night's stay", () => {
    const trip = {...base, reservations:[
      res({id:"museum",kind:"activity",title:"수도원 입장권",startTime:"10:30",address:"Praça do Império, Lisboa"}),
      res({id:"train",kind:"transport",startTime:"14:20",endDate:"2026-10-14",endTime:"17:10",departure:"리스본",arrival:"포르투"}),
      res({id:"bnb",kind:"stay",title:"포르투 B&B",startDate:"2026-10-14",endDate:"2026-10-16",address:"Rua das Flores 1, Porto"}),
    ]};
    const tower = {...plan("tower","09:00",60), placeId:"ChIJ0000000000"};
    const cafe = {...plan("cafe"), address:"Rua Augusta 10, Lisboa"};
    const nowhere = plan("nowhere","19:00");
    const targets = mapTargets(dayPlan(trip, [tower, cafe, nowhere], "2026-10-14"));
    expect(targets.map(t=>[t.title, t.placeId ?? t.address])).toEqual([
      ["tower","ChIJ0000000000"],
      ["수도원 입장권","Praça do Império, Lisboa"],
      ["cafe","Rua Augusta 10, Lisboa"],
      ["포르투 B&B","Rua das Flores 1, Porto"],
    ]);
    expect(targets[3].open).toMatchObject({kind:"reservation"});
  });
});

describe("plan page backup format", () => {
  const notebook = (p: object) => JSON.stringify({version:1,library:{schemaVersion:3,activeTripId:"trip",trips:[base],updatedAt:base.updatedAt},pages:[p]});
  it("keeps old pages valid and accepts only well-formed time and duration", () => {
    expect(() => parseNotebook(notebook(plan("old")))).not.toThrow();
    expect(parseNotebook(notebook(plan("new","09:30",45))).pages[0]).toMatchObject({time:"09:30",minutes:45});
    expect(() => parseNotebook(notebook({...plan("x"),time:"24:00"}))).toThrow();
    expect(() => parseNotebook(notebook({...plan("x"),minutes:0}))).toThrow();
    expect(() => parseNotebook(notebook({...plan("x"),extra:true}))).toThrow();
  });
});

describe("stay events", () => {
  it("lists the day's check-outs before check-ins, each with its own time", () => {
    const reservations = [
      res({id:"bnb",kind:"stay",title:"포르투 B&B",startDate:"2026-10-14",endDate:"2026-10-16"}),
      res({id:"hotel",kind:"stay",title:"리스본 호텔",startDate:"2026-10-13",endDate:"2026-10-14",startTime:"15:00",endTime:"11:00"}),
      res({id:"train",kind:"transport",startDate:"2026-10-14"}),
    ];
    expect(stayEvents(reservations, "2026-10-14").map(e=>[e.kind,e.reservation.id,e.time])).toEqual([["checkOut","hotel","11:00"],["checkIn","bnb",undefined]]);
    expect(stayEvents(reservations, "2026-10-15")).toEqual([]);
  });
});
