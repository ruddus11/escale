import { describe, expect, it } from "vitest";
import { parseFlightPhoto } from "../src/data/flightPhoto";
import { parseStayPhoto } from "../src/data/stayPhoto";

// 공급자 문서를 복제한 데이터가 아니라 입력 경계 검증용 합성 OCR 줄이다.
describe("booking photo format coverage", () => {
  it.each([
    ["12:05 AM", "00:05"], ["12:05 PM", "12:05"], ["5:20 PM", "17:20"],
    ["오전 9:10", "09:10"], ["오후 9:10", "21:10"], ["午後 3:40", "15:40"],
    ["7 : 25", "07:25"],
  ])("reads an explicitly qualified time %s", (input, expected) => {
    expect(parseFlightPhoto([`Departure: ICN 2028-05-12 ${input}`, "Arrival: LHR"]).startTime).toBe(expected);
  });
  it.each(["18:00 PM", "0:20 AM", "13:20 PM", "25:10", "오전 17:20", "05:10 AM PM"])("does not repair invalid time %s", input => {
    expect(parseFlightPhoto([`Departure: ICN 2028-05-12 ${input}`, "Arrival: LHR"]).startTime).toBe("");
  });
  it("keeps conflicting times empty", () => {
    expect(parseFlightPhoto(["Departure: ICN 2028-05-12 5:20 PM 6:20 PM", "Arrival: LHR"]).startTime).toBe("");
  });
  it("reads the flight number immediately below an explicit flight label", () => {
    expect(parseFlightPhoto(["Flight number", "XY 901", "Departure: CDG", "Arrival: JFK"]).serviceNumber).toBe("XY901");
  });
  it("accepts OCR spaces only inside an explicitly written IANA zone", () => {
    const d = parseFlightPhoto(["Flight: XY901", "Departure: CDG 2028-05-12 11:20 Europe/Paris", "Arrival: JFK 2028-05-12 13:35 America/New York"]);
    expect([d.timeZone,d.endTimeZone]).toEqual(["Europe/Paris","America/New_York"]);
    expect(parseFlightPhoto(["Departure: XYZ Springfield", "Arrival: QQQ Paris"]).timeZone).toBe("");
  });
  it("leaves invalid or multiple time zones empty", () => {
    expect(parseFlightPhoto(["Departure: ABC Europe/Imaginary", "Arrival: DEF"]).timeZone).toBe("");
    expect(parseFlightPhoto(["Departure: ABC Europe/Paris Europe/London", "Arrival: DEF"]).timeZone).toBe("");
  });
  it("does not read UTC offsets as local clocks or as the UTC zone", () => {
    const d = parseFlightPhoto(["Departure: ICN 2028-05-12 UTC+09:00", "Arrival: LHR 2028-05-12 11:20 GMT+01:00"]);
    expect([d.startTime,d.endTime]).toEqual(["","11:20"]);
    expect([d.timeZone,d.endTimeZone]).toEqual(["Asia/Seoul","Europe/London"]);
  });
  it("does not accept the prefix of an invalid IANA identifier", () => {
    expect(parseFlightPhoto(["Departure: XYZ Europe/Paris/Unknown", "Arrival: JFK"]).timeZone).toBe("");
  });
  it("does not use boarding or duration fields as departure or arrival facts", () => {
    const d = parseFlightPhoto(["Flight: XY901", "Departure: CDG", "Boarding: 2028-05-12 10:30", "Arrival: JFK 2028-05-12", "Duration: 08:15"]);
    expect([d.startDate,d.startTime,d.endTime]).toEqual(["","",""]);
    expect(d.endDate).toBe("2028-05-12");
  });
  it("reads fullwidth screenshot text without inferring absent facts", () => {
    const d = parseFlightPhoto(["Ｆｌｉｇｈｔ： ＸＹ９０１", "出発： ＣＤＧ ２０２８年５月１２日 １１：２０", "到着： ＪＦＫ ２０２８年５月１２日 １３：３５"]);
    expect([d.serviceNumber,d.departure,d.startDate,d.startTime]).toEqual(["XY901","CDG","2028-05-12","11:20"]);
    expect([d.endDate,d.timeZone,d.endTimeZone]).toEqual(["2028-05-12","Europe/Paris","America/New_York"]);
  });
  it("normalizes fullwidth stay labels and dates", () => {
    expect(parseStayPhoto(["Ｈｏｔｅｌ： Ｓｅａ Ｈｏｕｓｅ", "Ｃｈｅｃｋ－ｉｎ： ２０２８－０５－１２", "Ｃｈｅｃｋ－ｏｕｔ： ２０２８－０５－１４"])).toEqual({title:"Sea House",startDate:"2028-05-12",endDate:"2028-05-14"});
  });
});
