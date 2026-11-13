import { describe, expect, it } from "vitest";
import { isAdminUser, parseUsageDecision } from "./placeUsage";

const ADMIN = "11111111-1111-4111-8111-111111111111";
describe("place search privileges", () => {
  it("only grants admin to exact verified UUIDs in server configuration", () => {
    expect(isAdminUser(ADMIN, ` ${ADMIN.toUpperCase()} , 22222222-2222-4222-8222-222222222222 `)).toBe(true);
    expect(isAdminUser("33333333-3333-4333-8333-333333333333", ADMIN)).toBe(false);
    expect(isAdminUser("admin@example.com", "admin@example.com")).toBe(false);
    expect(isAdminUser(ADMIN, undefined)).toBe(false);
    expect(isAdminUser(ADMIN.slice(0, -1), ADMIN)).toBe(false);
  });
  it("rejects malformed quota decisions instead of granting an unlimited search", () => {
    expect(() => parseUsageDecision({ allowed: true })).toThrow();
    expect(() => parseUsageDecision({ allowed: false, code: "anything" })).toThrow();
    expect(parseUsageDecision({ allowed: true, tier: "free", limit: 5, remaining: 4, resetsAt: "2026-11-01T00:00:00Z" })).toMatchObject({ allowed: true, remaining: 4 });
    expect(parseUsageDecision({ allowed: false, code: "SEARCH_RATE_LIMITED", retryAfter: 60 })).toEqual({ allowed: false, code: "SEARCH_RATE_LIMITED", retryAfter: 60 });
  });
});
