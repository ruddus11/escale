import { describe, expect, it } from "vitest";
import { STRINGS, STRING_PARTS, TITLES, bigTitle, formatDateRange, formatDay, formatDuration, formatUntil, resolveLang, translate } from "../src/i18n/strings";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("strings", () => {
  it("has all three languages for every line, with the same placeholders", () => {
    for (const [key, entry] of Object.entries(STRINGS)) {
      expect(entry, key).toHaveLength(3);
      for (const text of entry) expect(text.trim(), key).not.toBe("");
      expect(placeholders(entry[1]), key).toEqual(placeholders(entry[0]));
      expect(placeholders(entry[2]), key).toEqual(placeholders(entry[0]));
    }
  });

  it("does not define the same line in two parts", () => {
    const total = STRING_PARTS.reduce((n, part) => n + Object.keys(part).length, 0);
    expect(Object.keys(STRINGS)).toHaveLength(total);
  });

  it("fills placeholders", () => {
    expect(translate("ko", "library.newCount", { n: 3 })).toBe("3개");
    expect(translate("ja", "library.newCount", { n: 3 })).toBe("3件");
  });

  it("discloses Frankfurter requests in the privacy notice for each language", () => {
    for (const lang of ["ko", "en-US", "ja"] as const) {
      const notice = translate(lang, "settings.privacyNote");
      expect(notice).toContain("Frankfurter");
      expect(notice).toMatch(lang === "ko" ? /통화 코드.*IP 주소/ : lang === "ja" ? /通貨コード.*IPアドレス/ : /currency codes.*IP address/);
    }
  });

  it("reads the JEV button with its visible name so voice control can call it", () => {
    for (const lang of ["ko", "en-US", "ja"] as const) expect(translate(lang, "jev.open")).toContain(translate(lang, "jev.name"));
  });

  it("names the packing item in its row action labels", () => {
    expect(translate("ko", "autoPack.rename", { item: "여권" })).toBe("여권 이름 바꾸기");
    expect(translate("en-US", "autoPack.remove", { item: "Passport" })).toBe("Remove Passport");
    expect(translate("ja", "autoPack.remove", { item: "パスポート" })).toBe("パスポートを削除");
  });

  it("keeps big headings in English when asked", () => {
    expect(bigTitle("ko", true, "today")).toBe("TODAY");
    expect(bigTitle("ko", false, "today")).toBe("오늘");
    expect(bigTitle("ja", false, "stories")).toBe("記録");
    expect(bigTitle("en-US", false, "plan")).toBe("PLAN");
    for (const entry of Object.values(TITLES)) expect(entry[1]).toBe(entry[1].toUpperCase());
  });
});

describe("resolveLang", () => {
  it("prefers the saved choice", () => {
    expect(resolveLang("ja", ["ko-KR"])).toBe("ja");
  });

  it("follows the first supported device language", () => {
    expect(resolveLang(null, ["fr-FR", "en-US", "ko-KR"])).toBe("en-US");
    expect(resolveLang(undefined, ["ja_JP"])).toBe("ja");
  });

  it("falls back to Korean", () => {
    expect(resolveLang("xx", ["fr", null])).toBe("ko");
    expect(resolveLang(null, [])).toBe("ko");
  });
});

describe("formatDay", () => {
  it("writes the date the way each language does", () => {
    expect(formatDay("ko", "2026-10-14")).toBe("10월 14일 수요일");
    expect(formatDay("en-US", "2026-10-14")).toBe("WED · OCT 14");
    expect(formatDay("ja", "2026-10-14")).toBe("10月14日(水)");
  });
});

describe("formatUntil", () => {
  it("shortens the time left before departure", () => {
    expect(formatUntil("en-US", { kind: "soon", hours: 3, minutes: 10 })).toBe("In 3h 10m");
    expect(formatUntil("ko", { kind: "soon", hours: 0, minutes: 40 })).toBe("40분 뒤");
    expect(formatUntil("ja", { kind: "days", days: 1 })).toBe("明日出発");
    expect(formatUntil("ko", { kind: "days", days: 3 })).toBe("3일 뒤 출발");
    expect(formatUntil("en-US", { kind: "soon", hours: 0, minutes: 0 })).toBe("Now");
  });
});

describe("formatDuration", () => {
  it("writes hours and minutes", () => {
    expect(formatDuration("ko", 150)).toBe("2시간 30분");
    expect(formatDuration("en-US", 180)).toBe("3h");
    expect(formatDuration("ja", 45)).toBe("45分");
  });
});


describe("English regional settings", () => {
  it("keeps saved region and migrates legacy English", () => {
    expect(resolveLang("en-GB", ["en-US"])).toBe("en-GB");
    expect(resolveLang("en", ["en-GB"])).toBe("en-US");
    expect(resolveLang(null, ["en_GB"])).toBe("en-GB");
    expect(resolveLang(null, ["en-Latn-GB"])).toBe("en-GB");
  });
  it("uses day-month ordering for British English", () => {
    expect(formatDay("en-GB", "2026-10-14")).toBe("WED · 14 OCT");
    expect(formatDay("en-US", "2026-10-14")).toBe("WED · OCT 14");
    expect(bigTitle("en-GB", false, "today")).toBe("TODAY");
    expect(translate("en-GB", "common.close")).toBe("Close");
  });
});

describe("formatDateRange", () => {
  it("writes a trip's dates the way each language does", () => {
    expect(formatDateRange("ko", "2026-10-14", "2026-10-16")).toBe("10월 14일 – 16일");
    expect(formatDateRange("en-US", "2026-10-30", "2026-11-02")).toBe("Oct 30 – Nov 2");
    expect(formatDateRange("en-GB", "2026-10-14", "2026-10-16")).toBe("14 – 16 Oct");
    expect(formatDateRange("ja", "2026-10-14", "2026-10-14")).toBe("10月14日");
  });
});
