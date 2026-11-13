import { expect, it } from "vitest";
import { isPickedLine } from "../src/data/pickedLine";

it("recognizes saved recommendation markers in all supported languages", () => {
  expect(isPickedLine("카페 · 맞춤 추천")).toBe(true);
  expect(isPickedLine("Cafe · Picked for you")).toBe(true);
  expect(isPickedLine("カフェ · おすすめ")).toBe(true);
  expect(isPickedLine("ordinary place")).toBe(false);
});
