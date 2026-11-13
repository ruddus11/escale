import { Fragment, useEffect, type ReactNode } from "react";
import {
  OPERATOR,
  PUBLIC_LEGAL_PATHS,
  accountDeletionPage,
  legalDate,
  legalDocument,
  operatorText,
  type LegalBlock,
  type LegalLang,
  type PublicLegalPage,
} from "../../domain/legal";
import "./legal.css";

// 스토어 심사와 앱 없이 삭제를 요청하는 사람이 여는 공개 문서 화면.
// 모바일 앱과 같은 원본(src/domain/legal)을 그려서 두 곳의 문구가 어긋나지 않게 한다.

const LANGS: { lang: LegalLang; label: string }[] = [
  { lang: "ko", label: "한국어" },
  { lang: "en", label: "English" },
  { lang: "ja", label: "日本語" },
];

const UI: Record<LegalLang, { nav: Record<PublicLegalPage, string>; effective: string; operator: string; contact: string; back: string; language: string }> = {
  ko: {
    nav: { privacy: "개인정보 처리방침", terms: "이용약관", accountDeletion: "계정·데이터 삭제" },
    effective: "시행일",
    operator: "운영자",
    contact: "문의",
    back: "웹 수첩 열기",
    language: "언어",
  },
  en: {
    nav: { privacy: "Privacy policy", terms: "Terms of service", accountDeletion: "Delete account and data" },
    effective: "Effective",
    operator: "Operator",
    contact: "Contact",
    back: "Open the web notebook",
    language: "Language",
  },
  ja: {
    nav: { privacy: "個人情報処理方針", terms: "利用規約", accountDeletion: "アカウントとデータの削除" },
    effective: "施行日",
    operator: "運営者",
    contact: "お問い合わせ",
    back: "ウェブ版のノートを開く",
    language: "言語",
  },
};

const PAGES = Object.keys(PUBLIC_LEGAL_PATHS) as PublicLegalPage[];

/** "/privacy", "/privacy/" 같은 주소를 공개 문서로 읽는다. 다른 주소면 null. */
export function legalPageFromPath(pathname: string): PublicLegalPage | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  return PAGES.find((page) => PUBLIC_LEGAL_PATHS[page] === path) ?? null;
}

/** ?lang=en을 먼저 보고, 없으면 브라우저 언어, 그것도 맞지 않으면 정본인 한국어. */
export function legalLangFrom(search: string, browserLanguage = ""): LegalLang {
  const picked = new URLSearchParams(search).get("lang");
  const known = (value: string | null | undefined) => LANGS.find((item) => value?.toLowerCase().startsWith(item.lang))?.lang;
  return known(picked) ?? known(browserLanguage) ?? "ko";
}

function pageContent(page: PublicLegalPage, lang: LegalLang) {
  if (page === "accountDeletion") return { ...accountDeletionPage(lang), version: undefined, effective: undefined };
  const doc = legalDocument(page, lang);
  return { ...doc, request: null };
}

export function LegalSite({ page, lang }: { page: PublicLegalPage; lang: LegalLang }) {
  const ui = UI[lang];
  const doc = pageContent(page, lang);
  const op = operatorText(lang);
  const href = (target: PublicLegalPage, targetLang: LegalLang = lang) => `${PUBLIC_LEGAL_PATHS[target]}?lang=${targetLang}`;

  useEffect(() => {
    document.title = `${ui.nav[page]} · Escale`;
    document.documentElement.lang = lang;
  }, [lang, page, ui]);

  return (
    <div className="legal-site">
      <header className="legal-site__header">
        <a className="legal-site__mark" href="/">Escale</a>
        <nav aria-label={ui.language} className="legal-site__langs">
          {LANGS.map((item) => (
            <a key={item.lang} href={href(page, item.lang)} hrefLang={item.lang} aria-current={item.lang === lang ? "true" : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      <nav aria-label="Escale" className="legal-site__pages">
        {PAGES.map((target) => (
          <a key={target} href={href(target)} aria-current={target === page ? "page" : undefined}>
            {ui.nav[target]}
          </a>
        ))}
      </nav>

      <main className="legal-site__paper">
        {doc.notice ? <p className="legal-site__notice">{doc.notice}</p> : null}
        <h1>{doc.title}</h1>
        {doc.effective ? (
          <p className="legal-site__meta">
            {ui.effective} {legalDate(lang, doc.effective)}
          </p>
        ) : null}
        {doc.lead ? <p className="legal-site__lead">{doc.lead}</p> : null}
        {doc.blocks.map((block, index) => (
          <Block key={index} block={block} />
        ))}
        {doc.request ? (
          <p className="legal-site__action">
            <a href={mailto(doc.request)}>{doc.request.label}</a>
          </p>
        ) : null}
      </main>

      <footer className="legal-site__footer">
        <p>
          {ui.operator} {op.name} · {ui.contact}{" "}
          {OPERATOR.email ? <a href={`mailto:${OPERATOR.email}`}>{op.email}</a> : op.email}
        </p>
        <p>
          <a href="/">{ui.back}</a>
        </p>
      </footer>
    </div>
  );
}

function mailto(request: { email: string; subject: string; body: string }): string {
  return `mailto:${request.email}?subject=${encodeURIComponent(request.subject)}&body=${encodeURIComponent(request.body)}`;
}

// 표의 값은 "\n"으로 항목을 나눠 쓴다. 화면에서도 줄을 나눈다.
function Lines({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {index > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </>
  );
}

function Block({ block }: { block: LegalBlock }): ReactNode {
  switch (block.kind) {
    case "heading":
      return <h2>{block.text}</h2>;
    case "text":
      return <p className={block.strong ? "legal-site__strong" : undefined}>{block.text}</p>;
    case "fine":
      return <p className="legal-site__fine">{block.text}</p>;
    case "list":
      return (
        <ul>
          {block.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <table>
          {block.caption ? <caption>{block.caption}</caption> : null}
          <tbody>
            {block.rows.map((row, index) => (
              <tr key={index} className={row.strong ? "legal-site__strong" : undefined}>
                <th scope="row">{row.label}</th>
                <td>
                  <Lines text={row.value} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "box":
      return (
        <div className="legal-site__box">
          {block.sections.map((section, index) => (
            <section key={index} className={section.strong ? "legal-site__strong" : undefined}>
              <h3>{section.label}</h3>
              {section.lines.map((line, lineIndex) => (
                <p key={lineIndex}>
                  {line.title ? <strong>{line.title} </strong> : null}
                  {line.contact ? <span className="legal-site__fine">{line.contact} </span> : null}
                  {line.text}
                  {line.note ? <span className="legal-site__fine"> {line.note}</span> : null}
                </p>
              ))}
            </section>
          ))}
        </div>
      );
  }
}
