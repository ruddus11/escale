import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { osakaWorkspaceSeed } from "../../data/scheduleSeed";
import type { TripWorkspace } from "../../domain/workspace/types";
import { BudgetScreen } from "./BudgetScreen";

function BudgetHarness() {
  const [workspace, setWorkspace] = useState<TripWorkspace>(() =>
    structuredClone(osakaWorkspaceSeed),
  );
  return (
    <BudgetScreen
      workspace={workspace}
      now={new Date("2026-07-20T15:00:00+09:00")}
      onChange={setWorkspace}
      idFactory={() => "expense-test"}
    />
  );
}

describe("BudgetScreen", () => {
  it("이전 엔화 예산은 원금으로 표시하고 새 통화 합계에서 제외한다", () => {
    const workspace = structuredClone(osakaWorkspaceSeed);
    workspace.settings.baseCurrency = "USD";
    workspace.legacyYenBudget = workspace.budget;
    workspace.budget = { emergencyReserveMinor: 0 };
    render(<BudgetScreen workspace={workspace} now={new Date("2026-07-20T00:00:00Z")} onChange={() => undefined} />);
    const archive = screen.getByRole("region", { name: "이전 엔화 예산" });
    expect(within(archive).getByText("¥35,000")).toBeVisible();
    expect(screen.getByLabelText("총예산 (USD)")).toHaveValue("");
    expect(screen.getByRole("heading", { name: "총예산을 설정해주세요" })).toBeVisible();
  });
  it("총예산과 비상금을 설정해 사용 가능액을 계산한다", async () => {
    const user = userEvent.setup();
    render(<BudgetHarness />);

    expect(screen.getByText("¥30,000")).toBeVisible();
    await user.clear(screen.getByLabelText("총예산 (엔)"));
    await user.type(screen.getByLabelText("총예산 (엔)"), "30000");
    await user.clear(screen.getByLabelText("비상금 (엔)"));
    await user.type(screen.getByLabelText("비상금 (엔)"), "5000");
    await user.clear(screen.getByLabelText("한 끼 예산 (1인·엔)"));
    await user.type(screen.getByLabelText("한 끼 예산 (1인·엔)"), "1500");
    await user.click(screen.getByRole("button", { name: "예산 저장" }));

    expect(screen.getByText("¥25,000")).toBeVisible();
    expect(screen.getByText("비상금 제외 사용 가능")).toBeVisible();
  });

  it("빠른 금액으로 지출을 추가하고 명시적으로 삭제한다", async () => {
    const user = userEvent.setup();
    render(<BudgetHarness />);

    await user.click(screen.getByRole("button", { name: "¥500 입력" }));
    await user.selectOptions(screen.getByLabelText("지출 분류"), "drink");
    await user.type(screen.getByLabelText("지출 메모"), "물");
    await user.click(screen.getByRole("button", { name: "지출 추가" }));

    expect(screen.getByText("물")).toBeVisible();
    expect(
      within(screen.getByRole("heading", { name: "최근 지출" }).parentElement!
        .parentElement!).getByText("¥500"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "물 지출 삭제" }));
    expect(screen.getByText("이 지출을 삭제할까요?")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "지출 삭제 확인" }));
    expect(screen.queryByText("물")).not.toBeInTheDocument();
  });

  it("0원 지출은 저장하지 않고 오류를 표시한다", async () => {
    const user = userEvent.setup();
    render(<BudgetHarness />);

    await user.type(screen.getByLabelText("지출 금액 (엔)"), "0");
    await user.click(screen.getByRole("button", { name: "지출 추가" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "지출 금액을 0보다 크게, 해당 통화의 소수 자릿수에 맞게 입력해주세요.",
    );
  });

  it("여행 전에는 첫날을 기본 지출 날짜로 사용한다", () => {
    render(<BudgetHarness />);

    expect(screen.getByLabelText("지출 날짜")).toHaveValue("2026-07-20");
  });
});
