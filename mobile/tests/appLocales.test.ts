import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = JSON.parse(readFileSync(new URL("../app.json", import.meta.url), "utf8")).expo;

describe("iOS permission locales", () => {
  it("uses Korean as the default camera explanation and translates it for English and Japanese", () => {
    const koreanCameraText = "영수증을 찍어 지출을 적으려고 카메라를 써요. 사진은 기기 밖으로 보내지 않아요.";
    expect(app.ios.infoPlist.CFBundleAllowMixedLocalizations).toBe(true);
    expect(app.ios.infoPlist.NSCameraUsageDescription).toBe(koreanCameraText);
    const imagePicker = app.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-image-picker");
    expect(imagePicker[1].cameraPermission).toBe(app.ios.infoPlist.NSCameraUsageDescription);
    expect(imagePicker[1].photosPermission).toBe(false);
    for (const [lang, word] of [["ko", "영수증"], ["en", "receipts"], ["ja", "レシート"]] as const) {
      const path = app.locales?.[lang];
      expect(path, lang).toBeDefined();
      const locale = JSON.parse(readFileSync(new URL(path, new URL("../", import.meta.url)), "utf8"));
      expect(locale.ios.NSCameraUsageDescription, lang).toContain(word);
      if (lang === "ko") expect(locale.ios.NSCameraUsageDescription).toBe(koreanCameraText);
    }
  });
});
