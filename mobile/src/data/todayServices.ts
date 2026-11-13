import { todayStore } from "./sqlite";
import { fetchWithTimeout } from "./fetchWithTimeout";
import {
cachedRequest,type CityWeather
} from "./travelToday";

async function json(url: string) {
  const response = await fetchWithTimeout(url, {}, { timeoutMs: 8000 });
  if (!response.ok) throw Error("Network response");
  return response.json();
}
async function read<T>(
  key: string,
  validate: (v: unknown) => v is T,
): Promise<T | null> {
  try {
    const v: unknown = JSON.parse((await todayStore.get(key)) ?? "null");
    return validate(v) ? v : null;
  } catch {
    return null;
  }
}
const cityNames: [RegExp, string][] = [
  [/오사카|大阪|osaka/i, "Osaka"],
  [/교토|京都|kyoto/i, "Kyoto"],
  [/도쿄|東京|tokyo/i, "Tokyo"],
  [/후쿠오카|福岡|fukuoka/i, "Fukuoka"],
  [/삿포로|札幌|sapporo/i, "Sapporo"],
  [/나고야|名古屋|nagoya/i, "Nagoya"],
  [/고베|神戸|kobe/i, "Kobe"],
  [/나라|奈良|nara/i, "Nara"],
  [/오키나와|沖縄|okinawa|나하|那覇/i, "Naha"],
  [/요코하마|横浜|yokohama/i, "Yokohama"],
  [/히로시마|広島|hiroshima/i, "Hiroshima"],
  [/센다이|仙台|sendai/i, "Sendai"],
  [/니가타|新潟|niigata/i, "Niigata"],
];
export async function loadWeather(destination: string) {
  const city =
    cityNames.find(([match]) => match.test(destination))?.[1] ??
    destination.trim();
  if (!city) return { value: null, cached: true };
  const key = `weather:${city.toLowerCase()}`;
  const last = await read<CityWeather>(key, (v): v is CityWeather => {
    const w = v as CityWeather | null;
    return (
      !!w &&
      typeof w.temperature === "number" &&
      Number.isFinite(w.temperature) &&
      typeof w.code === "number" &&
      Number.isInteger(w.code) &&
      w.code >= 0 &&
      w.code <= 99 &&
      typeof w.at === "string" &&
      Number.isFinite(Date.parse(w.at))
    );
  });
  return cachedRequest(
    last,
    async () => {
      const geo = await json(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ko`,
      );
      const point = geo.results?.[0];
      if (
        !point ||
        !Number.isFinite(point.latitude) ||
        !Number.isFinite(point.longitude)
      )
        throw Error("City not found");
      const data = await json(
        `https://api.open-meteo.com/v1/forecast?latitude=${point.latitude}&longitude=${point.longitude}&current=temperature_2m,weather_code&timeformat=unixtime`,
      );
      const temperature = data.current?.temperature_2m,
        code = data.current?.weather_code;
      if (
        !Number.isFinite(temperature) ||
        !Number.isInteger(code) ||
        !Number.isFinite(data.current?.time)
      )
        throw Error("Weather missing");
      return {
        temperature,
        code,
        at: new Date(data.current.time * 1000).toISOString(),
      } as CityWeather;
    },
    (value) => todayStore.set(key, JSON.stringify(value)),
  );
}
