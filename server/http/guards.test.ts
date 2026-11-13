import { expect, it } from "vitest";
import { isValidCoordinates, readCoordinates, hasOnlyKeys } from "./guards";
it("유효한 전 세계 좌표를 받는다", () => {
 for (const point of [{latitude: 48.85, longitude: 2.35}, {latitude: -33.87, longitude: 151.2}, {latitude: 90, longitude: -180}]) expect(isValidCoordinates(point)).toBe(true);
 for (const point of [{latitude: 91, longitude: 0}, {latitude: 0, longitude: 181}, {latitude: NaN, longitude: 0}]) expect(isValidCoordinates(point)).toBe(false);
});
it("잘못된 요청 모양을 거부한다", () => {
 expect(readCoordinates({latitude: "0", longitude: 0})).toBeNull();
 expect(readCoordinates({latitude: Infinity, longitude: 0})).toBeNull();
 expect(hasOnlyKeys({ unexpected: 1 }, ["latitude"], ["latitude"])).toBe(false);
});
