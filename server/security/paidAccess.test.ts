import { describe, expect, it } from "vitest";
import { checkPaidAccess, isActiveEntitlement, type MemberLookup } from "./paidAccess";

const TOKEN = "s".repeat(24);
const members: Record<string, { userId: string; premium: boolean }> = {
  paid: { userId: "u1", premium: true },
  free: { userId: "u2", premium: false },
};
const lookup: MemberLookup = async (token) => members[token] ?? null;

describe("checkPaidAccess", () => {
  it("accepts the personal access code without a member lookup", async () => {
    expect(await checkPaidAccess({ TRANSIT_ACCESS_TOKEN: TOKEN }, `Bearer ${TOKEN}`, null)).toEqual({ ok: true, userId: null });
  });

  it("opens paid features for signed-in members with a valid entitlement", async () => {
    expect(await checkPaidAccess({}, "Bearer paid", lookup)).toEqual({ ok: true, userId: "u1" });
    expect(await checkPaidAccess({}, "Bearer free", lookup)).toMatchObject({ ok: false, status: 402, code: "PAYMENT_REQUIRED" });
    expect(await checkPaidAccess({}, "Bearer stolen", lookup)).toMatchObject({ ok: false, status: 401 });
    expect(await checkPaidAccess({}, undefined, lookup)).toMatchObject({ ok: false, status: 401 });
  });

  it("separates a broken entitlement lookup from a wrong token", async () => {
    const broken: MemberLookup = async () => {
      throw new Error("db down");
    };
    expect(await checkPaidAccess({}, "Bearer paid", broken)).toMatchObject({ ok: false, status: 502 });
  });

  it("reports a misconfigured server when neither access path is set up", async () => {
    expect(await checkPaidAccess({}, "Bearer anything", null)).toMatchObject({ ok: false, status: 503 });
  });
});

describe("isActiveEntitlement", () => {
  const now = new Date("2026-10-13T00:00:00Z");
  it("treats a missing expiry as lifetime and an old expiry as lapsed", () => {
    expect(isActiveEntitlement({ premium: true, expires_at: null }, now)).toBe(true);
    expect(isActiveEntitlement({ premium: true, expires_at: "2026-11-01T00:00:00Z" }, now)).toBe(true);
    expect(isActiveEntitlement({ premium: true, expires_at: "2026-10-01T00:00:00Z" }, now)).toBe(false);
    expect(isActiveEntitlement({ premium: false, expires_at: null }, now)).toBe(false);
    expect(isActiveEntitlement(null, now)).toBe(false);
  });
});
