import type { AirportArrival } from "./airportTime";
import { airportCode } from "./airportTime";
import { zoneCity } from "./selectionOptions";
import { translate, type Lang } from "../i18n/strings";

function dateLabel(date: string, lang: Lang): string {
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  if (lang === "ja") return `${month}月${day}日`;
  if (lang === "en-GB") return `${day} ${new Date(`${date}T12:00:00Z`).toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`;
  if (lang === "en-US") return `${new Date(`${date}T12:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${day}`;
  return `${month}월 ${day}일`;
}

/** 항공편 답 문구. 공용 공항 도착 계산 결과만 받아 화면 없이 검사할 수 있다. */
export function airportAnswer(arrival: AirportArrival | undefined, lang: Lang): string {
  if (!arrival) return translate(lang, "pouch.noFlight", { section: translate(lang, "overview.bookings") });
  const { flight } = arrival;
  const name = flight.serviceNumber?.trim() || flight.title;
  const date = dateLabel(flight.startDate, lang);
  if (!flight.startTime || !arrival.arriveTime) return translate(lang, "pouch.flightNoTime", { date, flight: name });

  const zone = zoneCity(arrival.timeZone, lang);
  const code = airportCode(flight.departure);
  const airport = lang === "ko" ? arrival.airport || flight.departure || translate(lang, "pouch.departureAirport")
    : code ? (lang === "ja" ? `${code}空港` : `${code} airport`) : flight.departure || translate(lang, "pouch.departureAirport");
  // 전날 도착 권장 시각은 날짜를 함께 적어 출발일과 혼동하지 않게 한다.
  const arrive = `${arrival.arriveDate && arrival.arriveDate !== flight.startDate ? `${dateLabel(arrival.arriveDate, lang)} ` : ""}${arrival.arriveTime}`;
  const departure = translate(lang, "pouch.flightDepart", { date, flight: name, time: flight.startTime, zone });
  const advice = translate(lang, arrival.international ? "pouch.flightInternational" : "pouch.flightDomestic", { arrive, airport });
  return `${departure} ${advice}`;
}
