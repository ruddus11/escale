import { describe, expect, it } from "vitest";
import { tripInfo } from "./tripInfo";

describe("tripInfo", () => {
  it("현장에서 필요한 호텔·항공·긴급 정보를 오프라인 데이터로 제공한다", () => {
    expect(tripInfo.hotel.nameKo).toBe("아트 호텔 오사카 베이 타워");
    expect(tripInfo.hotel.nameJa).toBe("アートホテル大阪ベイタワー");
    expect(tripInfo.hotel.checkIn).toBe("15:00");
    expect(tripInfo.hotel.checkOut).toBe("11:00");
    expect(tripInfo.flights.map((flight) => flight.flightNumber)).toEqual([
      "TW327",
      "TW328",
    ]);
    expect(tripInfo.emergencyContacts.map((contact) => contact.phone)).toEqual(
      expect.arrayContaining(["110", "119", "+81-50-3816-2787"]),
    );
    expect(tripInfo.officialLinks.map((link) => link.id)).toEqual(
      expect.arrayContaining([
        "tway-online-checkin",
        "tway-airport-checkin-deadline",
        "hankyu-status",
        "gion-ato-official-map",
      ]),
    );
  });

  it("예약 식별정보 없이 공식 HTTPS 링크만 보관한다", () => {
    const serialized = JSON.stringify(tripInfo);
    expect(serialized).not.toMatch(/booking|reservation|confirmation/i);

    const officialUrls = [
      tripInfo.hotel.officialUrl,
      tripInfo.hotel.mapsUrl,
      ...tripInfo.officialLinks.map((link) => link.url),
      ...tripInfo.emergencyContacts.flatMap((contact) =>
        contact.officialUrl === undefined ? [] : [contact.officialUrl],
      ),
    ];
    expect(officialUrls.every((url) => url.startsWith("https://"))).toBe(true);
  });
});
