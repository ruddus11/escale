import type { VercelRequest, VercelResponse } from "@vercel/node";
import { describe, expect, it } from "vitest";
import { createDeleteAccountHandler, type AccountAdmin } from "../../api/delete-account";

async function call(admin: AccountAdmin | null, authorization?: string, method = "POST") {
  const capture: { status?: number; body?: unknown } = {};
  const response = {
    setHeader: () => response,
    status: (code: number) => ((capture.status = code), response),
    json: (body: unknown) => ((capture.body = body), response),
  } as unknown as VercelResponse;
  await createDeleteAccountHandler(admin)({ method, headers: { authorization } } as unknown as VercelRequest, response);
  return capture;
}

describe("delete-account handler", () => {
  it("deletes only the account the token belongs to", async () => {
    const deleted: string[] = [];
    const admin: AccountAdmin = {
      userIdFor: async (t) => (t === "good" ? "u1" : null),
      deleteUser: async (id) => void deleted.push(id),
    };
    expect(await call(admin, "Bearer good")).toEqual({ status: 200, body: { deleted: true } });
    expect(deleted).toEqual(["u1"]);
    expect((await call(admin, "Bearer bad")).status).toBe(401);
    expect((await call(admin)).status).toBe(401);
    expect((await call(admin, "Bearer good", "GET")).status).toBe(405);
    expect(deleted).toEqual(["u1"]);
  });

  it("refuses when the server has no Supabase admin key", async () => {
    expect((await call(null, "Bearer good")).status).toBe(503);
  });
});
