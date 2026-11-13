import { describe, expect, it } from "vitest";
import { confirmedFlight, duplicateFlight, parseFlightLegs, parseFlightPhoto } from "../src/data/flightPhoto";

const lines = ["Flight: AB123", "Departure: CJJ 2027-01-04 07:25 Asia/Seoul", "Arrival: NRT 2027-01-04 09:35 Asia/Tokyo", "Booking reference: PRIVATE123", "Passenger: Example Person"];
describe("flight photo drafts", () => {
  it("reads explicit segment facts without storing private lines", () => {
    expect(parseFlightPhoto(lines)).toEqual({ title: "AB123 · CJJ → NRT", serviceNumber: "AB123", departure: "CJJ", arrival: "NRT", startDate: "2027-01-04", endDate: "2027-01-04", startTime: "07:25", endTime: "09:35", timeZone: "Asia/Seoul", endTimeZone: "Asia/Tokyo" });
  });
  it("reads Korean labels on neighboring lines", () => {
    const d = parseFlightPhoto(["편명 CD456", "출발", "ICN", "2027년 1월 4일 18:20", "도착", "LHR", "2027-01-04 22:10"]);
    expect([d.serviceNumber,d.departure,d.arrival,d.startDate,d.startTime,d.endTime]).toEqual(["CD456","ICN","LHR","2027-01-04","18:20","22:10"]);
    expect([d.timeZone,d.endTimeZone]).toEqual(["Asia/Seoul", "Europe/London"]);
  });
  it("does not invent a year, ambiguous date or arrival day", () => {
    const d = parseFlightPhoto(["Flight: AB123", "Departure: ICN 04/05/2027 18:20", "Arrival: LHR 22:10"]);
    expect([d.startDate,d.endDate]).toEqual(["",""]);
  });
  it("splits a labeled round trip into two legs instead of combining them", () => {
    const trip = [...lines, "Flight: AB124", "Departure: NRT 2027-01-10 12:55 Asia/Tokyo", "Arrival: CJJ 2027-01-10 15:25 Asia/Seoul"];
    expect(parseFlightLegs(trip).map(d => [d.serviceNumber,d.departure,d.arrival,d.startDate,d.startTime])).toEqual([["AB123","CJJ","NRT","2027-01-04","07:25"],["AB124","NRT","CJJ","2027-01-10","12:55"]]);
    expect(parseFlightPhoto(trip).serviceNumber).toBe("");
  });
  it("ignores private lines even if they contain route-like values", () => {
    const d = parseFlightPhoto(["Passenger: AB123", "Booking reference: ICN", "Departure: 2027-02-30 25:90", "Arrival: NRT"]);
    expect([d.serviceNumber,d.departure,d.startDate,d.startTime]).toEqual(["","","",""]);
    expect(JSON.stringify(d)).not.toContain("Passenger");
  });
  it("ignores ambiguous airport or time candidates", () => {
    const d = parseFlightPhoto(["Departure: ICN GMP 2027-01-04 12:00 13:00", "Arrival: NRT"]);
    expect([d.departure,d.startTime]).toEqual(["",""]);
  });
  it("converts explicitly qualified 12-hour times instead of reading them as 24-hour time", () => {
    expect(parseFlightPhoto(["Departure: ICN 2027-01-04 05:20 PM", "Arrival: LHR"]).startTime).toBe("17:20");
  });
  it("does not mistake uppercase month names for airports", () => {
    const d = parseFlightPhoto(["Departure: ICN JAN 4, 2027 12:00", "Arrival: LHR JAN 4, 2027 18:00"]);
    expect([d.departure,d.arrival,d.startDate]).toEqual(["ICN","LHR","2027-01-04"]);
  });
  it("requires explicit local zones before confirming and rejects impossible chronology", () => {
    const d = parseFlightPhoto(lines);
    expect(confirmedFlight({...d,timeZone:""}, "x", "now")).toBeUndefined();
    expect(confirmedFlight({...d,endTime:"06:00"}, "x", "now")).toBeUndefined();
    const r = confirmedFlight({...d,startTime:"",endTime:""}, "x", "now");
    expect(r).toMatchObject({kind:"flight",id:"x",startDate:"2027-01-04",timeZone:"Asia/Seoul"});
    expect(r?.startTime).toBeUndefined();
    expect(r?.endTime).toBeUndefined();
  });
  it("matches airport codes inside manually entered place labels", () => {
    expect(duplicateFlight(parseFlightPhoto(lines), [{id:"manual",kind:"flight",title:"flight",serviceNumber:"AB123",departure:"청주 CJJ",arrival:"도쿄 나리타 NRT",startDate:"2027-01-04",timeZone:"Asia/Seoul",updatedAt:""}])).toBe(true);
  });
  it("detects duplicate flights after whitespace normalization", () => {
    const d = parseFlightPhoto(lines);
    expect(duplicateFlight(d, [{ id:"x",kind:"flight",title:"another title",serviceNumber:"AB 123",departure:"CJJ",arrival:"NRT",startDate:"2027-01-04",timeZone:"Asia/Seoul",updatedAt:"" }])).toBe(true);
    expect(duplicateFlight({...d,startDate:"2027-01-05"}, [{ id:"x",kind:"flight",title:"AB123",serviceNumber:"AB123",departure:"CJJ",arrival:"NRT",startDate:"2027-01-04",timeZone:"Asia/Seoul",updatedAt:"" }])).toBe(false);
    expect(duplicateFlight({...d,serviceNumber:""}, [{ id:"x",kind:"flight",title:"",startDate:d.startDate,timeZone:"Asia/Seoul",updatedAt:"" }])).toBe(false);
  });
});
