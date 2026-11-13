import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { hasPremium, paidBuild, paidBuildFor, premiumCredential, type PaidBuild } from "../src/data/premium";

const { assertReleaseIsFree } = createRequire(import.meta.url)("../app.config.js") as { assertReleaseIsFree: (env: Record<string, string | undefined>) => void };

const release: PaidBuild = { paid: false, testTools: false };
const testing: PaidBuild = { paid: true, testTools: true };
const store: PaidBuild = { paid: true, testTools: false };

const member = { token: "login-token", premium: true };

describe("paid features by build", () => {
  it("are closed in release builds even for paid accounts", () => {
    expect(hasPremium({ preview: true, accessCode: "code", member }, release)).toBe(false);
    expect(premiumCredential({ preview: false, accessCode: "" }, "typed code", release)).toBe("");
  });

  it("open with the preview switch and a typed access code in test builds", () => {
    expect(hasPremium({ preview: true, accessCode: "" }, testing)).toBe(true);
    expect(premiumCredential({ preview: true, accessCode: "" }, " typed code ", testing)).toBe("typed code");
  });

  it("follow only the account once payments exist", () => {
    expect(hasPremium({ preview: true, accessCode: "code" }, store)).toBe(false);
    expect(hasPremium({ preview: false, accessCode: "", member }, store)).toBe(true);
    expect(premiumCredential({ preview: false, accessCode: "" }, "typed code", store)).toBe("");
    expect(premiumCredential({ preview: false, accessCode: "", member }, "typed code", store)).toBe("login-token");
  });

  it("treat the test runner as a release build", () => {
    expect(paidBuild).toEqual(release);
  });

  it("stay closed in release builds unless the preview flag is exactly 1", () => {
    for (const flag of [undefined, "", "0", "true", "yes"]) expect(paidBuildFor(false, flag), String(flag)).toEqual(release);
    expect(paidBuildFor(false, " 1 ")).toEqual(testing);
    expect(paidBuildFor(true, undefined)).toEqual(testing);
  });

  it("refuse to configure a production store build with the paid preview on", () => {
    expect(() => assertReleaseIsFree({ EAS_BUILD_PROFILE: "production", EXPO_PUBLIC_PAID_PREVIEW: "1" })).toThrow(/internal test builds only/);
    expect(() => assertReleaseIsFree({ EAS_BUILD_PROFILE: "production", EXPO_PUBLIC_PAID_PREVIEW: "" })).not.toThrow();
    expect(() => assertReleaseIsFree({ EAS_BUILD_PROFILE: "preview", EXPO_PUBLIC_PAID_PREVIEW: "1" })).not.toThrow();
  });
});
