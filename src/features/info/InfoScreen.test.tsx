import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  InfoScreen,
  type InfoScreenDependencies,
} from "./InfoScreen";

function createProps() {
  const dependencies: InfoScreenDependencies = {
    now: () => new Date("2026-07-17T09:30:00+09:00"),
    downloadJson: vi.fn(),
    readFile: vi.fn(async () => '{"schemaVersion":1}'),
  };
  return {
    exportWorkspace: vi.fn(() => '{"schemaVersion":1}'),
    importWorkspace: vi.fn(),
    resetWorkspace: vi.fn(async () => undefined),
    dependencies,
  };
}

describe("InfoScreen", () => {
  it("일반 수첩에는 일본 예약과 긴급 전화번호를 노출하지 않는다", () => {
    render(<InfoScreen {...createProps()} showTripDetails={false} />);
    expect(screen.queryByRole("link", { name: /110 전화/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Japan Visitor Hotline")).not.toBeInTheDocument();
    expect(screen.queryByText("TW327")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "백업 내보내기" })).toBeEnabled();
  });
  it("공개 개인정보 처리방침·약관·삭제 안내로 가는 고정 주소를 보인다", () => {
    render(<InfoScreen {...createProps()} showTripDetails={false} />);
    const nav = screen.getByRole("navigation", { name: "개인정보와 약관" });
    expect(nav).toHaveTextContent("쿠키를 쓰지 않고");
    expect(screen.getByRole("link", { name: "개인정보 처리방침" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "이용약관" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "계정·데이터 삭제" })).toHaveAttribute("href", "/account-deletion");
  });

  it("호텔·항공·공식 운행정보·긴급 연락처를 바로 실행 가능하게 표시한다", () => {
    render(<InfoScreen {...createProps()} />);

    expect(
      screen.getByRole("heading", { name: "여행 정보" }),
    ).toBeVisible();
    expect(screen.getByText("アートホテル大阪ベイタワー")).toBeVisible();
    expect(screen.getByText("〒552-0007 大阪府大阪市港区弁天1-2-1")).toBeVisible();
    expect(screen.getByText("TW327")).toBeVisible();
    expect(screen.getByText("TW328")).toBeVisible();
    expect(screen.getByRole("link", { name: /경찰 110/ })).toHaveAttribute(
      "href",
      "tel:110",
    );
    expect(
      screen.getByRole("link", { name: /구급·소방 119/ }),
    ).toHaveAttribute("href", "tel:119");
    expect(screen.getByText("Japan Visitor Hotline")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "현장 필수" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /기온마츠리 아토마츠리 공식 GPS 지도/ }),
    ).toHaveAttribute("href", "https://gionmatsuri.stroly.com/ato/en");
    expect(
      screen.getByRole("link", { name: /티웨이 온라인 체크인/ }),
    ).toHaveAttribute(
      "href",
      "https://www.twayair.com/app/serviceInfo/contents/1121",
    );

    const externalLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("https://"));
    expect(externalLinks.length).toBeGreaterThan(0);
    for (const link of externalLinks) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("현재 워크스페이스를 날짜가 포함된 JSON으로 내보낸다", async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<InfoScreen {...props} />);

    await user.click(screen.getByRole("button", { name: "백업 내보내기" }));

    expect(props.exportWorkspace).toHaveBeenCalledOnce();
    expect(props.dependencies.downloadJson).toHaveBeenCalledWith(
      '{"schemaVersion":1}',
      "margin-2026-07-17.json",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "백업 파일을 만들었습니다.",
    );
  });

  it("파일 선택 직후에는 덮어쓰지 않고 확인 후에만 가져온다", async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<InfoScreen {...props} />);
    const file = new File(['{"schemaVersion":1}'], "trip.json", {
      type: "application/json",
    });

    await user.upload(screen.getByLabelText("백업 파일 선택"), file);

    expect(await screen.findByText("trip.json을 가져올까요?")).toBeVisible();
    expect(props.importWorkspace).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "가져오기 확인" }));

    expect(props.importWorkspace).toHaveBeenCalledWith('{"schemaVersion":1}');
    expect(screen.getByRole("status")).toHaveTextContent(
      "여행 데이터를 가져왔습니다.",
    );
  });

  it("잘못된 백업은 교체하지 않고 이해할 수 있는 오류를 표시한다", async () => {
    const user = userEvent.setup();
    const props = createProps();
    props.importWorkspace.mockImplementation(() => {
      throw new Error("invalid");
    });
    render(<InfoScreen {...props} />);

    await user.upload(
      screen.getByLabelText("백업 파일 선택"),
      new File(["invalid"], "broken.json", { type: "application/json" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "가져오기 확인" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "백업 파일 형식을 확인해주세요.",
    );
    expect(props.resetWorkspace).not.toHaveBeenCalled();
  });

  it("초기화는 두 번째 확인 뒤에만 실행한다", async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<InfoScreen {...props} />);

    await user.click(screen.getByRole("button", { name: "여행 데이터 초기화" }));

    expect(props.resetWorkspace).not.toHaveBeenCalled();
    expect(screen.getByText("이 기기의 모든 여행 수첩을 비울까요?")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "초기화 확인" }));

    await waitFor(() => expect(props.resetWorkspace).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent(
      "여행 수첩을 모두 비웠습니다.",
    );
  });
});
