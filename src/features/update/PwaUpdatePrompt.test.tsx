import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  createPwaUpdateController,
  PwaUpdatePrompt,
  type PwaUpdateController,
} from "./PwaUpdatePrompt";

describe("PWA update", () => {
  it("StrictMode에서도 한 번 등록하고 준비된 워커는 사용자 동의 뒤 적용한다", async () => {
    const user = userEvent.setup();
    const applyRegisteredUpdate = vi.fn().mockResolvedValue(undefined);
    let notifyUpdateAvailable: (() => void) | undefined;
    const register = vi.fn((onNeedRefresh: () => void) => {
      notifyUpdateAvailable = onNeedRefresh;
      return applyRegisteredUpdate;
    });
    const controller = createPwaUpdateController(register);

    render(
      <StrictMode>
        <PwaUpdatePrompt controller={controller} />
      </StrictMode>,
    );
    expect(register).toHaveBeenCalledOnce();
    expect(screen.queryByText("새 버전 준비됨")).not.toBeInTheDocument();

    act(() => notifyUpdateAvailable?.());
    await user.click(screen.getByRole("button", { name: "지금 적용" }));

    expect(applyRegisteredUpdate).toHaveBeenCalledOnce();
    expect(applyRegisteredUpdate).toHaveBeenCalledWith(true);
  });

  it("적용 실패를 알리고 사용자가 안전하게 다시 시도할 수 있게 한다", async () => {
    const user = userEvent.setup();
    const applyUpdate = vi.fn().mockRejectedValue(new Error("offline"));
    const controller: PwaUpdateController = {
      subscribe: () => () => undefined,
      getSnapshot: () => true,
      applyUpdate,
    };

    render(<PwaUpdatePrompt controller={controller} />);
    await user.click(screen.getByRole("button", { name: "지금 적용" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "업데이트를 적용하지 못했습니다",
    );
    expect(screen.getByRole("button", { name: "지금 적용" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("새 버전 준비됨");
  });
});
