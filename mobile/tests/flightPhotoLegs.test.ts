import { describe, expect, it } from "vitest";
import { confirmedFlight, parseFlightLegs, parseFlightPhoto } from "../src/data/flightPhoto";

// 한국어 왕복 E-티켓 여정확인증의 두 단 배치를 본뜬 합성 OCR 결과다. 이름·예약번호·항공권번호·편명·날짜는 가짜다.
// 실제 Apple Vision이 굵은 공항 코드를 깨뜨린 모양("(KDX)", "(KIDX)", "(CJ))")과 행 단위 읽기 순서를 그대로 따랐다.
// [글자, x, y] — x·y는 0~1 비율, 왼쪽 위 원점.
const ticket: [string, number, number][] = [
  ["Sample Air E-티켓 여정확인증", 0.07, 0.08],
  ["예약번호: ZZ9X9X", 0.40, 0.115],
  ["E-티켓은 입출국 시 필요하므로 반드시 전 여행 기간 동안 소지해 주세요.", 0.074, 0.132],
  ["승객", 0.087, 0.166],
  ["HONG GILDONG/MR", 0.087, 0.187], ["전자항공권번호:", 0.512, 0.188],
  ["0000000000000", 0.514, 0.197],
  ["비행정보", 0.087, 0.22],
  ["구간 1", 0.087, 0.238], ["구간 2", 0.506, 0.238],
  ["2027/03/08, 월요일", 0.085, 0.253], ["2027/03/11, 목요일", 0.506, 0.254],
  ["09:10 청주 (CJJ)", 0.085, 0.268], ["19:05 오사카 (KDX)", 0.506, 0.268],
  ["11:00 오사카 (KIDX)", 0.085, 0.284], ["21:00 청주 (CJ))", 0.506, 0.284],
  ["비행편명ZZ 101", 0.087, 0.299], ["비행편명ZZ 102", 0.508, 0.299],
  ["출국터미널: T1", 0.087, 0.315], ["출국터미널: 11", 0.508, 0.315],
  ["도착터미널: T1", 0.087, 0.331], ["도착터미널: T1", 0.506, 0.331],
  ["Flying Time: 01:50", 0.085, 0.347], ["Flying Time: 01:55", 0.506, 0.346],
  ["좌석: 1A", 0.085, 0.361], ["좌석: 2A", 0.506, 0.361],
  ["수하물 허용: OKG", 0.087, 0.376], ["수하물 허용: OKG", 0.506, 0.376],
  ["청구서 세부 정보", 0.087, 0.397],
  ["구간 1", 0.087, 0.415], ["구간 2", 0.506, 0.414],
  ["2027/03/08, 월요일", 0.085, 0.43], ["2027/03/11, 목요일", 0.506, 0.431],
  ["요금", 0.087, 0.446], ["₩ 10,000 요금", 0.447, 0.445], ["₩ 10,000", 0.868, 0.445],
  ["공항세 (BP)", 0.087, 0.476], ["₩ 1,000 공항세 (TK)", 0.447, 0.477], ["₩ 1,000", 0.868, 0.476],
  ["일반 B좌석", 0.087, 0.508], ["# 1,000 공항세 (Ol)", 0.454, 0.508], ["₩ 1,000", 0.875, 0.507],
  ["총액", 0.085, 0.537], ["₩ 24,000", 0.857, 0.537],
  ["지급 내역", 0.087, 0.559],
  ["MR. GILDONG HONG", 0.087, 0.576], ["날짜 : 2027/01/15", 0.676, 0.576], ["₩ 24,000", 0.861, 0.576],
  ["국내선 탑승 수속은 출발 20분 전, 탑승은 출발 10분 전에 마감됩니다.", 0.112, 0.632],
  ["문의 사항은 고객센터(+82-0000-0000)로 문의해 주세요.", 0.094, 0.847],
];
const positioned = ticket.map(([text, x, y]) => ({ text, x, y, height: 0.012 }));
// 위치를 못 주는 빌드처럼 글자만 행 순서대로 넘긴다.
const textOnly = ticket.map(([text]) => text);

const outbound = { title: "ZZ101 · CJJ → KIX", serviceNumber: "ZZ101", departure: "CJJ", arrival: "KIX", startDate: "2027-03-08", endDate: "2027-03-08", startTime: "09:10", endTime: "11:00", timeZone: "Asia/Seoul", endTimeZone: "Asia/Tokyo" };
const inbound = { title: "ZZ102 · KIX → CJJ", serviceNumber: "ZZ102", departure: "KIX", arrival: "CJJ", startDate: "2027-03-11", endDate: "2027-03-11", startTime: "19:05", endTime: "21:00", timeZone: "Asia/Tokyo", endTimeZone: "Asia/Seoul" };

describe("multi-leg flight tickets", () => {
  it("reads both legs of a two-column e-ticket and repairs garbled airport codes from city names", () => {
    expect(parseFlightLegs(positioned)).toEqual([outbound, inbound]);
  });
  it("reads the same legs from row-ordered text when positions are unavailable", () => {
    expect(parseFlightLegs(textOnly)).toEqual([outbound, inbound]);
  });
  it("produces legs that can be saved after review without leaking private lines", () => {
    const legs = parseFlightLegs(positioned);
    expect(legs.map((leg, i) => confirmedFlight(leg, `id${i}`, "now")?.kind)).toEqual(["flight", "flight"]);
    expect(JSON.stringify(legs)).not.toMatch(/HONG|ZZ9X9X|0000000000000|24,000/);
    expect(parseFlightPhoto(positioned).serviceNumber).toBe("");
  });
  it("reads English segment headers with an arrow route line", () => {
    const legs = parseFlightLegs(["E-Ticket Itinerary Receipt", "Passenger: SAMPLE/TEST MS", "Segment 1", "Mon, 08 Mar 2027", "Seoul Incheon (ICN) 10:05 → London Heathrow (LHR) 14:30", "Flight: XY 901", "Segment 2", "Sun, 21 Mar 2027", "London Heathrow (LHR) 21:00 → Seoul Incheon (ICN) 17:55 +1", "Flight: XY 902"]);
    expect(legs.map(d => [d.serviceNumber, d.departure, d.arrival, d.startDate, d.endDate, d.timeZone, d.endTimeZone])).toEqual([
      ["XY901", "ICN", "LHR", "2027-03-08", "2027-03-08", "Asia/Seoul", "Europe/London"],
      ["XY902", "LHR", "ICN", "2027-03-21", "2027-03-22", "Europe/London", "Asia/Seoul"],
    ]);
  });
  it("reads Japanese outbound and return labels", () => {
    const legs = parseFlightLegs(["往路", "便名 AB 123", "出発 2027年3月8日 10:00 東京 (HND)", "到着 12:30 台北 (TSA)", "復路", "便名 AB 124", "出発 2027年3月12日 13:30 台北 (TSA)", "到着 17:40 東京 (HND)"]);
    expect(legs.map(d => [d.title, d.startDate, d.endDate, d.timeZone, d.endTimeZone])).toEqual([
      ["AB123 · HND → TSA", "2027-03-08", "2027-03-08", "Asia/Tokyo", "Asia/Taipei"],
      ["AB124 · TSA → HND", "2027-03-12", "2027-03-12", "Asia/Taipei", "Asia/Tokyo"],
    ]);
  });
  it("finds the arrival day across the date line from both airport zones", () => {
    const d = parseFlightPhoto(["Flight: XY 12", "Departure: LAX 2027-05-01 23:30", "Arrival: ICN 05:15"]);
    expect([d.timeZone, d.endTimeZone, d.endDate]).toEqual(["America/Los_Angeles", "Asia/Seoul", "2027-05-03"]);
  });
  it("leaves the arrival day blank when the printed flying time disagrees", () => {
    const d = parseFlightPhoto(["구간 1", "2027/03/08", "09:10 청주 (CJJ)", "11:00 오사카 (KIX)", "비행편명ZZ 101", "Flying Time: 05:00"]);
    expect([d.startDate, d.endDate, d.serviceNumber]).toEqual(["2027-03-08", "", "ZZ101"]);
  });
  it("keeps unknown but intact airport codes without guessing a zone", () => {
    const d = parseFlightPhoto(["Flight: QQ 77", "Departure: ABQ 2027-06-01 08:00", "Arrival: XYZ 2027-06-01 09:00"]);
    expect([d.departure, d.arrival, d.timeZone, d.endTimeZone]).toEqual(["ABQ", "XYZ", "", ""]);
  });
  it("leaves a code blank when the city has several airports and the code is unreadable", () => {
    expect(parseFlightLegs(["구간 1", "2027/03/08", "09:10 도쿄 (?)", "11:00 오사카 (ABQX)"])[0]).toMatchObject({ departure: "", arrival: "" });
  });
  it("does not read terminal rows or numbered headers as route facts", () => {
    const d = parseFlightPhoto(["Flight 12", "Departure: ICN 2027-01-04 07:25", "Departure Terminal: 2", "Arrival: NRT 2027-01-04 09:35", "도착터미널: T1"]);
    expect([d.serviceNumber, d.departure, d.arrival, d.startTime, d.endTime]).toEqual(["", "ICN", "NRT", "07:25", "09:35"]);
  });
});
