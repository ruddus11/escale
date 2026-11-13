// 앱과 웹이 함께 쓰는 법률 문서의 형식과 운영자 정보.
// 문서 내용이 바뀌면 LEGAL_VERSION을 올린다. 앱은 이전 판에 동의한 사람에게 다시 동의를 받는다.

export type LegalLang = "ko" | "en" | "ja";

/** AI·장소 기능. 보내는 내용과 받는 곳이 달라서 기능마다 따로 동의를 받는다. */
export type AiFeature = "recommend" | "booking" | "pouch";
export const AI_FEATURES: AiFeature[] = ["recommend", "booking", "pouch"];
export type AiDocId = `ai-${AiFeature}`;
export function aiDocId(feature: AiFeature): AiDocId {
  return `ai-${feature}`;
}

export type LegalDocId = "terms" | "privacy" | "collection" | "overseas" | AiDocId;

/**
 * 문서 한 덩어리. strong은 동의서의 중요한 내용(목적·항목·보유 기간·받는 자)을 굵고 20% 이상 크게 보인다.
 * 개인정보 보호법 제22조제2항과 개인정보 처리 방법에 관한 고시의 표시 방법을 따른다.
 */
export type LegalBlock =
  | { kind: "heading"; text: string }
  | { kind: "text"; text: string; strong?: boolean }
  | { kind: "list"; items: string[] }
  | { kind: "table"; caption?: string; rows: LegalRow[] }
  /** 테두리 상자 하나에 묶어 보이는 항목들. 동의 시트에서 표 대신 쓴다. */
  | { kind: "box"; sections: LegalSection[] }
  /** 작은 회색 글씨로 보이는 덧붙임(거부 방법, 전송 방식, 연락처 등). */
  | { kind: "fine"; text: string };

export interface LegalRow {
  label: string;
  value: string;
  strong?: boolean;
}

export interface LegalSection {
  label: string;
  /** 중요한 내용(받는 자와 목적, 보유 기간)이면 굵고 20% 이상 크게 보인다. */
  strong?: boolean;
  lines: LegalLine[];
}

export interface LegalLine {
  title?: string;
  /** 이름 옆에 작게 보이는 연락처(국외 이전 고지의 받는 자 연락처). */
  contact?: string;
  text: string;
  /** 줄 아래 작은 설명. */
  note?: string;
}

export interface LegalDocument {
  id: LegalDocId;
  title: string;
  /** 문서 판. 동의 기록에 남기는 값과 같다. */
  version: string;
  /** 시행일(YYYY-MM-DD). */
  effective: string;
  /** 문서 언어가 화면 언어와 다를 때 맨 위에 보이는 안내. */
  notice?: string;
  /** 제목 위의 작은 대문자 줄. */
  kicker?: string;
  /** 제목 아래 한두 문장 안내. */
  lead?: string;
  blocks: LegalBlock[];
}

// 계정 동의(약관·개인정보 수집·국외 이전)와 처리방침의 판. 날짜 형식으로 올린다.
// 앞 10자는 시행일이고, 같은 날 다시 바꾸면 ".2"처럼 붙인다.
export const LEGAL_VERSION = "2026-11-01";
// AI·장소 기능 동의서(기능별 3종)의 판. 동의서 문구, 보내는 내용, 받는 곳이 바뀌면 올린다.
// 앞 10자는 시행일이고, 같은 날 다시 바꾸면 ".2"처럼 붙인다.
export const AI_CONSENT_VERSION = "2026-11-01";

/**
 * 운영자 정보. 출시 전에 반드시 채운다. 비어 있으면 문서에 〔…〕 자리표시가 보인다.
 * 개인정보 보호책임자를 따로 두지 않으면 운영자 본인이 책임자가 된다(개인정보 보호법 제31조제2항).
 */
export const OPERATOR = {
  /** 개인이면 실명, 사업자면 상호와 대표자. 예: "홍길동" 또는 "주머니랩(대표 홍길동)" */
  name: "추경연",
  /** 문의와 개인정보 요청을 받는 이메일. */
  email: "gchu81632@gmail.com",
  /** 개인정보 보호책임자 이름. 비우면 name을 쓴다. */
  officer: "",
};

export function operatorReady(operator = OPERATOR): boolean {
  return !!operator.name.trim() && !!operator.email.trim();
}

const PLACEHOLDER: Record<LegalLang, { name: string; email: string }> = {
  ko: { name: "〔운영자 이름〕", email: "〔문의 이메일〕" },
  en: { name: "[Operator name]", email: "[Contact email]" },
  ja: { name: "〔運営者名〕", email: "〔お問い合わせメール〕" },
};

export interface OperatorText {
  name: string;
  email: string;
  officer: string;
}

export function operatorText(lang: LegalLang, operator = OPERATOR): OperatorText {
  const name = operator.name.trim() || PLACEHOLDER[lang].name;
  return {
    name,
    email: operator.email.trim() || PLACEHOLDER[lang].email,
    officer: operator.officer.trim() || name,
  };
}

// 스토어 심사와 앱 없이 삭제를 요청하는 사람이 여는 공개 주소. 웹 앱(Vercel)이 같은 문서 원본으로 그린다.
// 주소를 바꾸면 App Store Connect·Play Console에 등록한 URL도 함께 바꿔야 하므로 경로는 고정한다.
export const PUBLIC_WEB_HOST = "osaka-pocket.vercel.app";
const PUBLIC_WEB_ORIGIN = `https://${PUBLIC_WEB_HOST}`;
export const PUBLIC_LEGAL_PATHS = { privacy: "/privacy", terms: "/terms", accountDeletion: "/account-deletion" } as const;
export type PublicLegalPage = keyof typeof PUBLIC_LEGAL_PATHS;
export const PUBLIC_LEGAL_URLS: Record<PublicLegalPage, string> = {
  privacy: PUBLIC_WEB_ORIGIN + PUBLIC_LEGAL_PATHS.privacy,
  terms: PUBLIC_WEB_ORIGIN + PUBLIC_LEGAL_PATHS.terms,
  accountDeletion: PUBLIC_WEB_ORIGIN + PUBLIC_LEGAL_PATHS.accountDeletion,
};

/** 개인정보를 맡기는 곳. 국외 이전 고지(개인정보 보호법 제28조의8제2항)의 받는 자·연락처로 쓴다. */
export const PROCESSORS = {
  supabase: { company: "Supabase, Inc.", contact: "privacy@supabase.com" },
  vercel: { company: "Vercel Inc.", contact: "privacy@vercel.com" },
  typesafe: { company: "TypeSafe AI, Inc.", contact: "privacy@typesafe.ai" },
  google: { company: "Google LLC", contact: "https://support.google.com/policies" },
} as const;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10-15" → 언어별 날짜. 같은 날 고친 판("2026-10-17.2")은 앞 10자만 읽는다. 기기마다 달라지지 않게 Intl을 쓰지 않는다. */
export function legalDate(lang: LegalLang, iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (lang === "ko") return `${y}년 ${m}월 ${d}일`;
  if (lang === "ja") return `${y}年${m}月${d}日`;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
