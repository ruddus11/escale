import { describe, expect, it } from "vitest";
import {
  createGoogleMapsCurrentLocationDirectionsUrl,
  createGoogleMapsDirectionsUrl,
  createGoogleMapsSearchUrl,
  createGoogleMapsTransitUrl,
} from "./maps";

describe("createGoogleMapsCurrentLocationDirectionsUrl", () => {
  it("현재 위치에서 공식 주소까지 가는 대중교통 URL을 만든다", () => {
    const url = new URL(
      createGoogleMapsCurrentLocationDirectionsUrl(
        "アートホテル大阪ベイタワー, 大阪府大阪市港区弁天1-2-1",
        "transit",
      ),
    );

    expect(url.searchParams.has("origin")).toBe(false);
    expect(url.searchParams.get("destination")).toContain("アートホテル");
    expect(url.searchParams.get("travelmode")).toBe("transit");
  });
});

describe("createGoogleMapsDirectionsUrl", () => {
  it("공식 주소 두 개와 도보 모드를 보존한다", () => {
    const url = new URL(
      createGoogleMapsDirectionsUrl({
        origin: "JR大阪駅, 大阪府大阪市北区梅田3-1-1",
        destination: "梅田スカイビル, 大阪府大阪市北区大淀中1-1-88",
        travelMode: "walking",
      }),
    );

    expect(url.searchParams.get("origin")).toContain("JR大阪駅");
    expect(url.searchParams.get("destination")).toContain("梅田スカイビル");
    expect(url.searchParams.get("travelmode")).toBe("walking");
  });

  it("빈 출발지와 유한하지 않은 좌표를 거부한다", () => {
    expect(() =>
      createGoogleMapsDirectionsUrl({
        origin: "   ",
        destination: "오사카",
        travelMode: "transit",
      }),
    ).toThrow("Google Maps origin cannot be empty");
    expect(() =>
      createGoogleMapsDirectionsUrl({
        origin: { latitude: Number.NaN, longitude: 135 },
        destination: "오사카",
        travelMode: "transit",
      }),
    ).toThrow("Google Maps origin must contain finite coordinates");
  });
});

describe("createGoogleMapsTransitUrl", () => {
  it("현재 위치를 사용하도록 origin 없이 대중교통 URL을 만든다", () => {
    expect(
      createGoogleMapsTransitUrl({
        latitude: 34.7053,
        longitude: 135.4901,
      }),
    ).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=34.7053%2C135.4901&travelmode=transit",
    );
  });

  it.each([
    { latitude: Number.NaN, longitude: 135.4901 },
    { latitude: 34.7053, longitude: Number.POSITIVE_INFINITY },
  ])("유한하지 않은 목적지를 거부한다", (destination) => {
    expect(() => createGoogleMapsTransitUrl(destination)).toThrow(
      "Google Maps destination must contain finite coordinates",
    );
  });
});

describe("createGoogleMapsSearchUrl", () => {
  it("직접 입력한 장소를 Google Maps 검색 URL로 만든다", () => {
    const url = new URL(createGoogleMapsSearchUrl("호텔 근처 편의점"));

    expect(`${url.origin}${url.pathname}`).toBe(
      "https://www.google.com/maps/search/",
    );
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("호텔 근처 편의점");
  });
});
