import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OPERATOR, PUBLIC_LEGAL_URLS, accountDeletionPage, legalDocument } from "../../domain/legal";
import { LegalSite, legalLangFrom, legalPageFromPath } from "./LegalSite";

describe("public legal pages", () => {
  it("map only the fixed public paths", () => {
    expect(legalPageFromPath("/privacy")).toBe("privacy");
    expect(legalPageFromPath("/terms/")).toBe("terms");
    expect(legalPageFromPath("/account-deletion")).toBe("accountDeletion");
    expect(legalPageFromPath("/")).toBeNull();
    expect(legalPageFromPath("/privacy/extra")).toBeNull();
    expect(PUBLIC_LEGAL_URLS.accountDeletion).toBe("https://osaka-pocket.vercel.app/account-deletion");
  });

  it("pick the language from ?lang, then the browser, then Korean", () => {
    expect(legalLangFrom("?lang=ja", "en-US")).toBe("ja");
    expect(legalLangFrom("", "en-GB")).toBe("en");
    expect(legalLangFrom("?lang=fr", "de-DE")).toBe("ko");
  });

  it("render the same privacy text the mobile app shows", () => {
    render(<LegalSite page="privacy" lang="ko" />);
    const doc = legalDocument("privacy", "ko");
    expect(screen.getByRole("heading", { level: 1, name: doc.title })).toBeInTheDocument();
    for (const block of doc.blocks) if (block.kind === "heading") expect(screen.getByRole("heading", { level: 2, name: block.text })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("href", "/privacy?lang=en");
  });

  it("offer an email deletion request to the operator contact the policy already uses", () => {
    render(<LegalSite page="accountDeletion" lang="en" />);
    const link = screen.getByRole("link", { name: "Write a deletion request" });
    expect(link.getAttribute("href")).toMatch(new RegExp(`^mailto:${OPERATOR.email.replace(".", "\\.")}\\?subject=`));
    expect(screen.getByRole("heading", { level: 2, name: "What stays, and for how long" })).toBeInTheDocument();
  });

  it("keep the deletion page's retention periods in line with the privacy policy", () => {
    for (const lang of ["ko", "en", "ja"] as const) {
      const page = accountDeletionPage(lang);
      expect(page.blocks.length).toBeGreaterThan(5);
      expect(page.request?.email).toBe(OPERATOR.email);
    }
    const policy = JSON.stringify(legalDocument("privacy", "ko").blocks);
    const deletion = JSON.stringify(accountDeletionPage("ko").blocks);
    for (const period of ["3개월", "7일", "최대 3일", "최대 30분", "1시간"]) {
      expect(policy).toContain(period);
      expect(deletion).toContain(period);
    }
    expect(deletion).toContain("다음 캐시 조회 때 삭제");
    expect(policy).toContain(PUBLIC_LEGAL_URLS.accountDeletion);
  });

  it("leave out the request link when no operator email is set", () => {
    expect(accountDeletionPage("ko", { name: "운영자", email: " ", officer: "" }).request).toBeNull();
  });
});
