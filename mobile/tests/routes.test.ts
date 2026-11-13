import { describe, expect, it } from "vitest";
import { routeLegs, transitMapsUrl } from "../src/data/routes";

const url = (href: string) => new URL(href);

describe("transitMapsUrl", () => {
  it("좌표 두 개로 대중교통 길찾기 주소를 만든다", () => {
    const u = url(transitMapsUrl({ latitude: 34.6937, longitude: 135.5023 }, { latitude: 34.7025, longitude: 135.4959 }));
    expect(`${u.origin}${u.pathname}`).toBe("https://www.google.com/maps/dir/");
    expect(u.searchParams.get("api")).toBe("1");
    expect(u.searchParams.get("origin")).toBe("34.6937,135.5023");
    expect(u.searchParams.get("destination")).toBe("34.7025,135.4959");
    expect(u.searchParams.get("travelmode")).toBe("transit");
  });

  it("좌표가 없으면 이름을 그대로 검색어로 넣는다", () => {
    const u = url(transitMapsUrl("Louvre Museum", { latitude: 48.8584, longitude: 2.2945 }));
    expect(u.searchParams.get("origin")).toBe("Louvre Museum");
    expect(u.searchParams.get("destination")).toBe("48.8584,2.2945");
  });
});

describe("routeLegs", () => {
  const item = (id: string, title: string, kind = "plan") => ({ id, title, kind });

  it("좌표 → 주소 → 이름 순으로 끝점을 고른다", () => {
    const legs = routeLegs(
      [item("a", "Hotel"), item("b", "Sagrada Família"), item("c", "Park Güell")],
      { a: { latitude: 41.38, longitude: 2.17 } },
      { b: "C/ de Mallorca, 401, Barcelona" },
    );
    expect(legs[0]).toMatchObject({ origin: { latitude: 41.38, longitude: 2.17 }, destination: "C/ de Mallorca, 401, Barcelona" });
    expect(legs[1]).toMatchObject({ origin: "C/ de Mallorca, 401, Barcelona", destination: "Park Güell" });
  });

  it("위치 검색이 모두 실패해도 이름으로 버튼을 낸다", () => {
    const legs = routeLegs([item("a", "Shibuya Sky"), item("b", "Meiji Jingu")], {});
    expect(legs).toEqual([expect.objectContaining({ origin: "Shibuya Sky", destination: "Meiji Jingu" })]);
  });

  it("같은 장소 사이와 편명 줄에는 두지 않는다", () => {
    const here = { latitude: 35.0, longitude: 135.0 };
    const legs = routeLegs([item("a", "Cafe"), item("b", "Cafe 2"), item("c", "KE723", "move"), item("d", "Kyoto")], { a: here, b: { latitude: 35.0001, longitude: 135.0001 } });
    expect(legs).toEqual([null, null, null]);
  });
});
