import type { TripWorkspace } from "../../../src/domain/workspace/types";
import { zonedDate } from "../../../src/domain/time/zoned";
import countryData from "./passportCountries.json";
const destinations: Record<string, string> = {
  도쿄: "일본",
  오사카: "일본",
  교토: "일본",
  후쿠오카: "일본",
  삿포로: "일본",
  tokyo: "일본",
  osaka: "일본",
  kyoto: "일본",
  서울: "대한민국",
  부산: "대한민국",
  seoul: "대한민국",
  파리: "프랑스",
  paris: "프랑스",
  런던: "영국",
  london: "영국",
  뉴욕: "미국",
  "new york": "미국",
  타이베이: "대만",
  방콕: "태국",
};

const countryAliases = countryData
  .flatMap((c) =>
    c.aliases.map((alias) => ({ alias: alias.toLowerCase(), name: c.name })),
  )
  .sort((a, b) => b.alias.length - a.alias.length);
export function passportStats(trips: TripWorkspace[], now = new Date()) {
  const visited = trips.filter(
    (t) => t.settings.startDate <= zonedDate(now, t.settings.timeZone),
  );
  const cities = new Map<string, string>(),
    countries = new Set<string>();
  for (const trip of visited) {
    for (const part of (trip.settings.destination ?? "").split(/[,/·]/)) {
      let city = part.trim();
      if (!city) continue;
      const lower = city.toLowerCase();
      const country = countryAliases.find(
        (c) =>
          lower === c.alias ||
          lower.startsWith(c.alias + " ") ||
          lower.endsWith(" " + c.alias),
      );
      if (country) {
        countries.add(country.name);
        city = city
          .slice(
            lower.startsWith(country.alias) ? country.alias.length : 0,
            lower.endsWith(country.alias)
              ? city.length - country.alias.length
              : undefined,
          )
          .trim();
      }
      if (city) {
        cities.set(city.toLowerCase(), city);
        const countryName = destinations[city.toLowerCase()];
        if (countryName) countries.add(countryName);
      }
    }
  }
  const days = visited.reduce(
    (sum, t) =>
      sum +
      Math.max(
        0,
        Math.floor(
          (Math.min(
            Date.parse(t.settings.endDate),
            Date.parse(zonedDate(now, t.settings.timeZone)),
          ) -
            Date.parse(t.settings.startDate)) /
            86400000,
        ) + 1,
      ),
    0,
  );
  return {
    trips: visited.length,
    days,
    cities: [...cities.values()],
    countries: [...countries],
  };
}
