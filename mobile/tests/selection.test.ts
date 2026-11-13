import { describe, expect, it } from "vitest";
import { buttonA11y, selectionState, tabTitle } from "../src/theme/selection";

describe("selectionState", () => {
  it("uses checked for radio and checkbox, selected for buttons", () => {
    expect(selectionState("radio", true)).toEqual({ checked: true });
    expect(selectionState("checkbox", false)).toEqual({ checked: false });
    expect(selectionState("button", true)).toEqual({ selected: true });
  });
});

describe("buttonA11y", () => {
  it("stays a plain button without a choice", () => {
    expect(buttonA11y(undefined, true)).toEqual({ accessibilityRole: "button", accessibilityState: { disabled: true } });
  });

  it("reads as a radio when it is one of a choice", () => {
    expect(buttonA11y(true)).toEqual({ accessibilityRole: "radio", accessibilityState: { disabled: false, checked: true } });
    expect(buttonA11y(false)).toEqual({ accessibilityRole: "radio", accessibilityState: { disabled: false, checked: false } });
  });
});

describe("tabTitle", () => {
  it("includes the count, even zero", () => {
    expect(tabTitle("전체", 3)).toBe("전체 3");
    expect(tabTitle("챙김", 0)).toBe("챙김 0");
  });

  it("leaves tabs without a count alone", () => {
    expect(tabTitle("지난 여행")).toBe("지난 여행");
  });
});
