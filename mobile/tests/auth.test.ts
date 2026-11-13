import { describe, expect, it, vi } from "vitest";

// auth.ts는 네이티브 모듈을 불러오므로 순수 함수만 시험할 수 있게 가짜로 바꾼다.
vi.mock("react-native", () => ({ Platform: { OS: "ios" }, AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock("expo-apple-authentication", () => ({}));
vi.mock("expo-crypto", () => ({}));
vi.mock("expo-web-browser", () => ({}));
const authClient = vi.hoisted(() => ({ signOut: vi.fn(), exchangeCodeForSession: vi.fn() }));
vi.mock("../src/data/supabase", () => ({ supabase: { auth: authClient } }));

const { authCodeFrom, completeSignInFromUrl, deleteAccount, normalizeEmail, parseLoginMethods, signOut } = await import("../src/data/auth");

describe("login helpers", () => {
  it("shows only configured login methods in a fixed order", () => {
    expect(parseLoginMethods(undefined)).toEqual(["apple", "email"]);
    expect(parseLoginMethods("email, google ,nope,apple")).toEqual(["apple", "google", "email"]);
  });

  it("normalizes emails and rejects malformed ones", () => {
    expect(normalizeEmail("  Me@Example.COM ")).toBe("me@example.com");
    expect(normalizeEmail("me@example")).toBeNull();
    expect(normalizeEmail("a b@example.com")).toBeNull();
  });

  it("reads the login code from the return address and ignores errors", () => {
    expect(authCodeFrom("travelpouch://auth-callback?code=abc123")).toBe("abc123");
    expect(authCodeFrom("travelpouch://auth-callback?error=access_denied&code=x")).toBeNull();
    expect(authCodeFrom("travelpouch://auth-callback#access_token=t")).toBeNull();
  });

  it("accepts both registered callback schemes and rejects another host", async () => {
    authClient.exchangeCodeForSession.mockResolvedValue({ error: null });
    await expect(completeSignInFromUrl("travelpouch://auth-callback?code=old")).resolves.toBe(true);
    await expect(completeSignInFromUrl("margin://auth-callback?code=new")).resolves.toBe(true);
    await expect(completeSignInFromUrl("travelpouch://auth-callback.evil?code=bad")).resolves.toBe(false);
    expect(authClient.exchangeCodeForSession.mock.calls.map(([code]) => code)).toEqual(["old", "new"]);
  });
});


describe("sign out errors", () => {
  it("reports a returned provider error so the local fallback can run", async () => {
    authClient.signOut.mockResolvedValueOnce({ error: new Error("offline") });
    await expect(signOut()).rejects.toThrow("offline");
  });
});

describe("account deletion", () => {
  it("ends the spinner with the connection message when the server never answers, and keeps the local sign-in", async () => {
    vi.useFakeTimers();
    authClient.signOut.mockClear();
    const hanging = ((_url: string, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as unknown as typeof fetch;
    const pending = deleteAccount("https://pouch.example", "token", hanging);
    const check = expect(pending).rejects.toMatchObject({ key: "auth.offline" });
    await vi.advanceTimersByTimeAsync(30_000);
    await check;
    expect(authClient.signOut).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
