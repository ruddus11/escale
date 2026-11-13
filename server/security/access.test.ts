import { describe, expect, it } from "vitest";
import { checkTransitAccess } from "./access";

const STRONG_TOKEN = "s".repeat(24);

describe("checkTransitAccess", () => {
  it("서버 token이 없으면 요청 token보다 먼저 설정 오류로 닫힌다", () => {
    expect(checkTransitAccess(undefined, `Bearer ${STRONG_TOKEN}`)).toEqual({
      ok: false,
      reason: "SERVER_TOKEN_MISCONFIGURED",
    });
  });

  it("서버 token이 UTF-8 24 bytes 미만이면 설정 오류로 닫힌다", () => {
    expect(
      checkTransitAccess("s".repeat(23), `Bearer ${"s".repeat(23)}`),
    ).toEqual({
      ok: false,
      reason: "SERVER_TOKEN_MISCONFIGURED",
    });
  });

  it("문자 수가 아니라 UTF-8 byteLength로 강도를 판정한다", () => {
    const multibyteToken = "가".repeat(8);

    expect(
      checkTransitAccess(multibyteToken, `Bearer ${multibyteToken}`),
    ).toEqual({ ok: true });
  });

  it.each([
    undefined,
    "",
    STRONG_TOKEN,
    `bearer ${STRONG_TOKEN}`,
    `Bearer  ${STRONG_TOKEN}`,
    `Bearer ${STRONG_TOKEN} `,
    ` Bearer ${STRONG_TOKEN}`,
    ["Bearer duplicate", `Bearer ${STRONG_TOKEN}`],
  ])("엄격한 단일 Bearer 형식이 아니면 인증을 거부한다: %j", (header) => {
    expect(checkTransitAccess(STRONG_TOKEN, header)).toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });
  });

  it("길이가 다른 token은 예외 없이 비교 전에 거부한다", () => {
    expect(checkTransitAccess(STRONG_TOKEN, "Bearer short")).toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });
  });

  it("길이가 같아도 값이 다른 token은 거부한다", () => {
    expect(
      checkTransitAccess(STRONG_TOKEN, `Bearer ${"x".repeat(24)}`),
    ).toEqual({
      ok: false,
      reason: "UNAUTHORIZED",
    });
  });

  it("정확히 일치하는 강한 token만 허용한다", () => {
    expect(checkTransitAccess(STRONG_TOKEN, `Bearer ${STRONG_TOKEN}`)).toEqual({
      ok: true,
    });
  });

  it("판정 결과에 서버 token이나 요청 token을 직렬화하지 않는다", () => {
    const requestToken = "request-token-that-must-not-leak";
    const result = checkTransitAccess(
      STRONG_TOKEN,
      `Bearer ${requestToken}`,
    );
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(STRONG_TOKEN);
    expect(serialized).not.toContain(requestToken);
  });
});
