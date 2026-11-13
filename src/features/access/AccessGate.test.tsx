import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAccessToken,
  readAccessToken,
  saveAccessToken,
} from "../../services/accessToken";
import { AccessGate } from "./AccessGate";

const ACCESS_TOKEN = "private-test-access-token";
const ACCESS_TOKEN_KEY = "osaka-pocket.transit-access-token";

describe("access token persistent storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("접근 코드를 localStorage에만 저장하고 지운다", () => {
    saveAccessToken(ACCESS_TOKEN);

    expect(readAccessToken()).toBe(ACCESS_TOKEN);
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe(ACCESS_TOKEN);
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();

    clearAccessToken();

    expect(readAccessToken()).toBeNull();
  });
});

describe("AccessGate", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("코드가 없으면 입력 폼만 보이고 자식을 열지 않는다", () => {
    render(
      <AccessGate>
        {() => <p>보호된 교통 API 화면</p>}
      </AccessGate>,
    );

    expect(screen.getByLabelText("개인 접근 코드")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByLabelText("개인 접근 코드")).toHaveAttribute(
      "autocomplete",
      "off",
    );
    expect(screen.getByLabelText("개인 접근 코드")).not.toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.queryByText("보호된 교통 API 화면")).not.toBeInTheDocument();
  });

  it("입력 후 기기에 저장하고 자식에 코드를 전달한다", async () => {
    const user = userEvent.setup();
    render(
      <AccessGate>
        {({ accessToken }) => <p>잠금 해제됨 {accessToken.length}</p>}
      </AccessGate>,
    );

    await user.type(screen.getByLabelText("개인 접근 코드"), ACCESS_TOKEN);
    await user.click(screen.getByRole("button", { name: "교통편 잠금 해제" }));

    expect(screen.getByText(`잠금 해제됨 ${ACCESS_TOKEN.length}`)).toBeVisible();
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe(ACCESS_TOKEN);
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(document.body.textContent).not.toContain(ACCESS_TOKEN);
  });

  it("앱을 다시 시작해도 저장한 코드로 바로 잠금을 해제한다", async () => {
    const user = userEvent.setup();
    const firstMount = render(
      <AccessGate>
        {({ accessToken }) => <p>첫 실행 {accessToken.length}</p>}
      </AccessGate>,
    );

    await user.type(screen.getByLabelText("개인 접근 코드"), ACCESS_TOKEN);
    await user.click(screen.getByRole("button", { name: "교통편 잠금 해제" }));
    expect(screen.getByText(`첫 실행 ${ACCESS_TOKEN.length}`)).toBeVisible();

    firstMount.unmount();
    render(
      <AccessGate>
        {({ accessToken }) => <p>재시작 {accessToken.length}</p>}
      </AccessGate>,
    );

    expect(screen.getByText(`재시작 ${ACCESS_TOKEN.length}`)).toBeVisible();
    expect(screen.queryByLabelText("개인 접근 코드")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe(ACCESS_TOKEN);
  });

  it("잠금 해제 상태에서도 저장한 코드를 다시 입력하지 않고 변경할 수 있다", async () => {
    saveAccessToken(ACCESS_TOKEN);
    const user = userEvent.setup();
    render(
      <AccessGate>
        {() => <p>보호된 교통 API 화면</p>}
      </AccessGate>,
    );

    await user.click(screen.getByRole("button", { name: "접근 코드 변경" }));

    expect(screen.getByLabelText("개인 접근 코드")).toHaveValue(ACCESS_TOKEN);
    expect(screen.queryByText("보호된 교통 API 화면")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe(ACCESS_TOKEN);
  });

  it("401 신호를 받으면 저장한 코드를 유지하고 수정할 수 있게 다시 잠근다", async () => {
    saveAccessToken(ACCESS_TOKEN);
    const user = userEvent.setup();
    render(
      <AccessGate>
        {({ onUnauthorized }) => (
          <button type="button" onClick={onUnauthorized}>
            401 신호
          </button>
        )}
      </AccessGate>,
    );

    await user.click(screen.getByRole("button", { name: "401 신호" }));

    expect(screen.getByLabelText("개인 접근 코드")).toHaveValue(ACCESS_TOKEN);
    expect(
      screen.getByText(
        "저장된 접근 코드가 서버 코드와 일치하지 않습니다. 확인하거나 수정한 뒤 다시 시도하세요.",
      ),
    ).toBeVisible();
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe(ACCESS_TOKEN);

    await user.click(screen.getByRole("button", { name: "교통편 잠금 해제" }));
    expect(screen.getByRole("button", { name: "401 신호" })).toBeVisible();
  });
});
