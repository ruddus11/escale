import type { Reservation } from "../../../src/domain/reservations/types";

export type StayPhotoDraft = { title: string; startDate: string; endDate: string };
const IN = /check[ -]?in|체크\s*인|チェックイン/i;
const OUT = /check[ -]?out|체크\s*아웃|チェックアウト/i;
const NAME = /^(?:hotel(?: name)?|property(?: name)?|accommodation|숙소(?:명)?|호텔명|施設名|宿泊施設)\s*[:：]\s*(.+)$/i;
const PRIVATE = /예약\s*번호|확인\s*번호|booking\s*(?:id|number|reference)|confirmation|guest|투숙객|성명|passport|여권|password|비밀번호|https?:|@/i;

// 연도와 월 순서가 분명한 날짜만 모은다. 여러 후보가 있으면 호출부에서 선택하지 않는다.
export function bookingDates(text: string): string[] {
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const candidates: string[][] = [];
  for (const m of text.matchAll(/\b(20\d{2})\s*(?:[-/.]|년|年)\s*(\d{1,2})\s*(?:[-/.]|월|月)\s*(\d{1,2})(?:일|日)?(?!\d)/g)) candidates.push([m[1], m[2], m[3]]);
  const named = [
    ...Array.from(text.matchAll(/\b([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(20\d{2})\b/g), m => [m[1], m[2], m[3]]),
    ...Array.from(text.matchAll(/\b(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(20\d{2})\b/g), m => [m[2], m[1], m[3]]),
  ];
  for (const [name, day, year] of named) {
    const index = months.findIndex(month => name.toLowerCase() === month || name.toLowerCase() === month.slice(0, 3));
    if (index >= 0) candidates.push([year, String(index + 1), day]);
  }
  return candidates.map(([y, m, d]) => `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`).filter(value => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });
}

export function parseStayPhoto(raw: string[]): StayPhotoDraft {
  const lines = raw.slice(0, 200).map(line => line.normalize("NFKC").trim()).filter(Boolean);
  const names = lines.filter(line => !PRIVATE.test(line)).map(line => {
    const labeled = NAME.exec(line)?.[1];
    if (labeled) return labeled;
    // 제목 전체가 숙소명처럼 보일 때만 후보로 쓴다. 주소·설명 문장은 넘기지 않는다.
    return /^(?:Hotel [\p{L} .’'-]+|[\p{L} .’'-]+ Hotel|[가-힣 ]+호텔|ホテル[\p{L} ]+)$/u.test(line) ? line : undefined;
  }).filter((v): v is string => !!v && v.length <= 120);
  const readDate = (label: RegExp, opposite: RegExp) => {
    const values: string[] = [];
    lines.forEach((line, index) => {
      if (!label.test(line) || opposite.test(line)) return;
      const nearby = [line];
      for (const item of lines.slice(index + 1, index + 3)) {
        if (opposite.test(item) || PRIVATE.test(item) || label.test(item) || /[:：]/.test(item)) break;
        nearby.push(item);
      }
      values.push(...nearby.flatMap(bookingDates));
    });
    return new Set(values).size === 1 ? values[0] : "";
  };
  let startDate = readDate(IN, OUT);
  let endDate = readDate(OUT, IN);
  if (startDate && endDate && endDate <= startDate) { startDate = ""; endDate = ""; }
  return { title: new Set(names).size === 1 ? names[0] : "", startDate, endDate };
}

export function duplicateStay(draft: StayPhotoDraft, reservations: Reservation[]): boolean {
  const normalize = (name: string) => name.normalize("NFKC").replace(/\s/g, "").toLowerCase();
  return reservations.some(item => item.kind === "stay" && normalize(item.title) === normalize(draft.title) && item.startDate === draft.startDate.trim() && item.endDate === draft.endDate.trim());
}
