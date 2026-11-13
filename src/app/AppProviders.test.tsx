import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppProviders } from "./AppProviders";

describe("AppProviders", () => {
  it("renders children inside the light app theme", () => {
    render(
      <AppProviders>
        <p>내용</p>
      </AppProviders>,
    );

    const themeRoot = screen.getByText("내용").closest("[data-astryx-theme]");
    expect(themeRoot).toHaveAttribute("data-astryx-theme", "margin");
    expect(themeRoot).toHaveAttribute("data-theme", "light");
  });
});

describe("AppProviders 한국어 문구", () => {
  it("Astryx 부품의 기본 문구를 한국어 파일에서 찾는다", async () => {
    const { useTranslator } = await import("@astryxdesign/core/i18n");
    function Probe() {
      const t = useTranslator();
      return <p>{[t("@astryx.dialog.close"), t("@astryx.alertDialog.cancel")].join(",")}</p>;
    }
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );

    expect(screen.getByText("닫기,취소")).toBeInTheDocument();
  });
});
