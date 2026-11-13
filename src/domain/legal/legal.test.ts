import { describe, expect, it } from "vitest";
import {
  AI_CONSENT_VERSION,
  AI_FEATURES,
  aiDocId,
  LEGAL_DOC_IDS,
  LEGAL_VERSION,
  PROCESSORS,
  legalDate,
  legalDocument,
  operatorReady,
  operatorText,
  type LegalBlock,
  type LegalDocument,
  type LegalLang,
} from "./index";

const LANGS: LegalLang[] = ["ko", "en", "ja"];

function blockText(block: LegalBlock): string[] {
  switch (block.kind) {
    case "list":
      return block.items;
    case "table":
      return [block.caption ?? "", ...block.rows.flatMap((r) => [r.label, r.value])];
    case "box":
      return block.sections.flatMap((s) => [s.label, ...s.lines.flatMap((l) => [l.title ?? "", l.contact ?? "", l.text, l.note ?? ""])]);
    default:
      return [block.text];
  }
}

function allText(doc: LegalDocument): string {
  return [doc.kicker ?? "", doc.title, doc.lead ?? "", doc.notice ?? "", ...doc.blocks.flatMap(blockText)].join("\n");
}

/** 굵고 크게 보이는 글(표의 strong 줄, 상자의 strong 묶음). */
function strongText(doc: LegalDocument): string {
  return doc.blocks
    .flatMap((b) =>
      b.kind === "table"
        ? b.rows.filter((r) => r.strong).map((r) => r.value)
        : b.kind === "box"
          ? b.sections.filter((s) => s.strong).flatMap((s) => s.lines.flatMap((l) => [l.title ?? "", l.text]))
          : [],
    )
    .join("\n");
}

describe("legal documents", () => {
  it("build every document in every language without empty lines", () => {
    for (const id of LEGAL_DOC_IDS)
      for (const lang of LANGS) {
        const doc = legalDocument(id, lang);
        expect(doc.id).toBe(id);
        expect(doc.title.trim(), `${id} ${lang}`).not.toBe("");
        expect(doc.blocks.length, `${id} ${lang}`).toBeGreaterThan(0);
        for (const block of doc.blocks) {
          if (block.kind === "list") for (const item of block.items) expect(item.trim(), `${id} ${lang}`).not.toBe("");
          else if (block.kind === "table") for (const row of block.rows) expect(row.value.trim(), `${id} ${lang} ${row.label}`).not.toBe("");
          else if (block.kind === "box")
            for (const section of block.sections) {
              expect(section.label.trim(), `${id} ${lang}`).not.toBe("");
              expect(section.lines.length, `${id} ${lang} ${section.label}`).toBeGreaterThan(0);
              for (const line of section.lines) expect(line.text.trim(), `${id} ${lang} ${section.label}`).not.toBe("");
            }
          else expect(block.text.trim(), `${id} ${lang}`).not.toBe("");
        }
      }
  });

  it("carry the version that consent records store", () => {
    for (const lang of LANGS) {
      for (const id of ["terms", "privacy", "collection", "overseas"] as const) expect(legalDocument(id, lang).version).toBe(LEGAL_VERSION);
      for (const feature of AI_FEATURES) expect(legalDocument(aiDocId(feature), lang).version).toBe(AI_CONSENT_VERSION);
    }
  });

  it("name every recipient the privacy policy lists in the matching consent", () => {
    for (const lang of LANGS) {
      const overseas = allText(legalDocument("overseas", lang));
      const privacy = allText(legalDocument("privacy", lang));
      for (const p of [PROCESSORS.supabase, PROCESSORS.vercel]) expect(overseas).toContain(p.company);
      for (const p of Object.values(PROCESSORS)) expect(privacy).toContain(p.company);
      // 기능별 AI 동의서는 그 기능이 실제로 보내는 곳만 적는다. Google 장소 검색은 장소 추천만 쓴다.
      for (const feature of AI_FEATURES) {
        const ai = allText(legalDocument(aiDocId(feature), lang));
        for (const p of [PROCESSORS.typesafe, PROCESSORS.vercel]) expect(ai, `${feature} ${lang}`).toContain(p.company);
        if (feature === "recommend") expect(ai, lang).toContain(PROCESSORS.google.company);
        else expect(ai, `${feature} ${lang}`).not.toContain(PROCESSORS.google.company);
      }
    }
  });

  it("highlight the important parts of each consent", () => {
    for (const id of ["collection", "overseas"] as const)
      for (const lang of LANGS) {
        const rows = legalDocument(id, lang).blocks.flatMap((b) => (b.kind === "table" ? b.rows : []));
        expect(rows.filter((r) => r.strong).length, `${id} ${lang}`).toBeGreaterThanOrEqual(3);
      }
    // AI 동의는 받는 자와 목적, 보유 기간을 강조한다(개인정보 보호법 시행령 제17조제3항).
    for (const lang of LANGS)
      for (const feature of AI_FEATURES) {
        const doc = legalDocument(aiDocId(feature), lang);
        const strong = strongText(doc);
        for (const p of [PROCESSORS.typesafe, PROCESSORS.vercel]) expect(strong, `${feature} ${lang}`).toContain(p.company);
        if (feature === "recommend") expect(strong, lang).toContain(PROCESSORS.google.company);
        const sections = doc.blocks.flatMap((b) => (b.kind === "box" ? b.sections : []));
        expect(sections.filter((s) => s.strong).length, `${feature} ${lang}`).toBeGreaterThanOrEqual(2);
      }
  });

  it("tell what the overseas transfer rule asks before the AI features send anything", () => {
    const words: Record<LegalLang, string[]> = {
      ko: ["미국", "누를 때만", "HTTPS", "동의하지 않아도", "철회", "AI라서 틀릴 수", "지워", "이 기능에만"],
      en: ["United States", "when you tap", "HTTPS", "Without agreeing", "withdraw", "can get things wrong", "deletes", "this feature only"],
      ja: ["アメリカ", "押したときだけ", "HTTPS", "同意しなくても", "取り消せます", "間違うことがあります", "消し", "この機能だけ"],
    };
    for (const lang of LANGS)
      for (const feature of AI_FEATURES) {
        const text = allText(legalDocument(aiDocId(feature), lang));
        for (const word of words[lang]) expect(text, `${feature} ${lang} ${word}`).toContain(word);
        const recipients = feature === "recommend" ? [PROCESSORS.typesafe, PROCESSORS.google, PROCESSORS.vercel] : [PROCESSORS.typesafe, PROCESSORS.vercel];
        for (const p of recipients) expect(text, `${feature} ${lang}`).toContain(p.contact.replace(/^https:\/\//, ""));
      }
  });

  it("discloses the recommendation cache in each language's feature consent", () => {
    const periods: Record<LegalLang, string> = { ko: "최대 30분", en: "up to 30 minutes", ja: "最大30分" };
    for (const lang of LANGS) {
      const recommend = allText(legalDocument(aiDocId("recommend"), lang));
      expect(recommend).toContain("SHA-256");
      expect(recommend).toContain(periods[lang]);
      expect(allText(legalDocument(aiDocId("booking"), lang))).not.toContain("SHA-256");
    }
  });

  it("covers what the Personal Information Protection Act asks a privacy policy to state", () => {
    const text = allText(legalDocument("privacy", "ko"));
    for (const topic of ["목적", "보유 기간", "파기", "제3자", "위탁", "국외", "만 14세", "권리", "안전성", "보호책임자", "구제", "변경", "동의 없이 처리"])
      expect(text, topic).toContain(topic);
  });

  it("discloses the exchange-rate service, currency codes, and IP address in each language", () => {
    for (const lang of LANGS) {
      const blocks = legalDocument("privacy", lang).blocks;
      const section = blocks.findIndex((block) => block.kind === "heading" && block.text.startsWith("7."));
      expect(section, lang).toBeGreaterThanOrEqual(0);
      const services = blocks[section + 1];
      expect(services.kind, lang).toBe("list");
      if (services.kind !== "list") continue;
      const rate = services.items.find((item) => item.includes("Frankfurter"));
      expect(rate, lang).toBeDefined();
      expect(rate, lang).toContain("api.frankfurter.dev");
      expect(rate, lang).toMatch(lang === "ko" ? /통화 코드.*IP 주소/ : lang === "ja" ? /通貨コード.*IPアドレス/ : /currency codes.*IP address/);
    }
  });

  it("describes the server memory cache, sign-in providers and web browser storage as the code does", () => {
    const ko = allText(legalDocument("privacy", "ko"));
    const en = allText(legalDocument("privacy", "en"));
    // api/place.ts·api/recommend-places.ts의 캐시(최대 30분, 해시 열쇠, 계정·IP 없음)와 맞춘다.
    expect(ko).toContain("최대 30분");
    expect(ko).toContain("다음 캐시 조회 때 삭제");
    expect(ko).toContain("계정·IP 주소와 연결하지 않습니다");
    expect(en).toContain("up to 30 minutes");
    expect(en).toContain("when the cache is next accessed");
    expect(ko).not.toContain("처리한 즉시 파기하며 저장하지 않음. 요청 기록");
    // mobile/src/data/auth.ts의 로그인 제공자.
    for (const provider of ["Apple", "Google", "카카오"]) expect(ko).toContain(`${provider}`);
    expect(en).toContain("Kakao");
    for (const storage of ["IndexedDB", "localStorage", "쿠키 동의 창"]) expect(ko).toContain(storage);
    expect(en).toContain("cookie consent banner");
  });

  it("tells Japanese readers that the Korean text is official", () => {
    expect(legalDocument("privacy", "ja").notice).toContain("為替レートの項目を除き、英語の参考訳");
    expect(legalDocument("privacy", "ja").notice).toContain("韓国語");
    expect(legalDocument("terms", "ja").notice).toContain("韓国語");
    expect(legalDocument("privacy", "ko").notice).toBeUndefined();
  });
});

describe("operator details", () => {
  it("show placeholders until they are filled", () => {
    const empty = { name: "", email: "", officer: "" };
    expect(operatorReady(empty)).toBe(false);
    expect(operatorText("ko", empty)).toEqual({ name: "〔운영자 이름〕", email: "〔문의 이메일〕", officer: "〔운영자 이름〕" });
    const filled = { name: "홍길동", email: "help@example.com", officer: "" };
    expect(operatorReady(filled)).toBe(true);
    expect(operatorText("en", filled)).toEqual({ name: "홍길동", email: "help@example.com", officer: "홍길동" });
  });
});

describe("legalDate", () => {
  it("writes the effective date in each language", () => {
    expect(legalDate("ko", "2026-10-15")).toBe("2026년 10월 15일");
    expect(legalDate("ja", "2026-10-15")).toBe("2026年10月15日");
    expect(legalDate("en", "2026-10-05")).toBe("5 October 2026");
  });

  it("reads only the date of a same-day revision like 2026-10-17.2", () => {
    expect(legalDate("ko", "2026-10-17.2")).toBe("2026년 10월 17일");
    expect(legalDate("ja", "2026-10-17.2")).toBe("2026年10月17日");
    expect(legalDate("en", "2026-10-17.2")).toBe("17 October 2026");
  });
});
