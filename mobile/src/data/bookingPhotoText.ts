import timeZones from "./timeZones.json";
import { isTimeZone } from "../../../src/domain/time/zoned";

const unique = (values: string[]) => new Set(values).size === 1 ? values[0] : "";
const MERIDIEM = /\b(?:AM|PM)\b|오전|오후|午前|午後/gi;

/** 명시된 오전·오후만 24시간제로 바꾼다. 모순되거나 여러 시각이 있으면 선택하지 않는다. */
export function bookingTime(text: string): string {
  const clockText = text.replace(/\b(?:UTC|GMT)\s*[+-]\s*\d{1,2}(?::\d{2})?/gi, "").replace(/[+-]\d{2}:\d{2}\b/g, "");
  const values: string[] = [];
  let usedMarkers = 0;
  for (const m of clockText.matchAll(/(?<![\d:])(?:(AM|PM|오전|오후|午前|午後)\s*)?(\d{1,2})\s*:\s*(\d{2})(?:\s*(AM|PM|오전|오후|午前|午後))?(?!\d)/gi)) {
    let hour = Number(m[2]);
    const minute = Number(m[3]);
    if (minute > 59 || (m[1] && m[4])) return "";
    const marker = (m[1] || m[4])?.toUpperCase();
    if (marker) {
      usedMarkers++;
      if (hour < 1 || hour > 12) return "";
      hour = hour % 12 + (/^(PM|오후|午後)$/.test(marker) ? 12 : 0);
    } else if (hour > 23) return "";
    values.push(`${String(hour).padStart(2,"0")}:${m[3]}`);
  }
  if (usedMarkers !== Array.from(clockText.matchAll(MERIDIEM)).length) return "";
  return unique(values);
}

// 도시 이름에서 추정하지 않는다. 문서에 명시된 IANA 식별자 안의 공백만 밑줄과 동등하게 취급한다.
const zonePatterns = [...timeZones, "UTC"].map(zone => {
  const source = zone.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/_/g,"[ _]+");
  const offset = zone === "UTC" ? "(?!\\s*[+-]\\s*\\d)" : "";
  return { zone, pattern: new RegExp(`\\b${source}(?![A-Za-z_/])${offset}\\b`) };
});
export function bookingTimeZone(text: string): string {
  const matches = zonePatterns.filter(({pattern}) => pattern.test(text)).map(({zone}) => zone).filter(isTimeZone);
  return unique(matches);
}
