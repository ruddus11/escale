import { isDateOnly } from "../../../src/repositories/schemaGuards";
export interface ExchangeRate {
  date: string;
  rate: number;
}
export interface CityWeather {
  temperature: number;
  code: number;
  at: string;
}
export function parseRate(value: unknown): ExchangeRate | null {
  const v = value as { date?: unknown; rates?: { KRW?: unknown } } | null;
  return typeof v?.date === "string" &&
    isDateOnly(v.date) &&
    typeof v.rates?.KRW === "number" &&
    Number.isFinite(v.rates.KRW) &&
    v.rates.KRW > 0
    ? { date: v.date, rate: v.rates.KRW }
    : null;
}
export async function cachedRequest<T>(
  last: T | null,
  load: () => Promise<T>,
  save: (value: T) => Promise<void>,
): Promise<{ value: T | null; cached: boolean }> {
  try {
    const value = await load();
    await save(value).catch(() => undefined);
    return { value, cached: false };
  } catch {
    return { value: last, cached: true };
  }
}
/** Open-Meteo 날씨 코드를 여섯 가지 하늘로 묶는다. 화면 글자는 i18n의 weather.<kind>에서 고른다. */
export type WeatherKind = "clear" | "cloud" | "fog" | "storm" | "snow" | "rain";
export function weatherKind(code: number): WeatherKind {
  if (code === 0) return "clear";
  if (code <= 3) return "cloud";
  if (code <= 48) return "fog";
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  return "rain";
}
