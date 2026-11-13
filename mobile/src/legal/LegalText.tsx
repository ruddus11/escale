import { Text, View } from "react-native";
import { legalDate, operatorReady, type LegalBlock, type LegalDocument } from "../../../src/domain/legal";
import { legalLang } from "../data/consent";
import { useI18n } from "../i18n/I18n";
import { mono, textRole } from "../theme/tokens";

// 동의서의 중요한 내용은 다른 글자보다 20% 이상 크고 굵게 보인다(개인정보 처리 방법에 관한 고시).
// 본문 body 17pt(400) → 강조 sectionTitle 21pt(600). 21 / 17 ≈ 1.24배.
// 법률 글은 본문 크기(body)보다 작게 쓰지 않는다. 보조 문장은 크기 대신 회색으로 구분한다.

/**
 * 약관·처리방침·동의서 본문. 약관의 항목은 번호를 붙여 "제3조 제2항"처럼 가리킬 수 있게 한다.
 * sheet는 기능을 쓰기 직전에 뜨는 동의 시트용이다. 제목을 크게 두고 시행일은 맨 아래로 내린다.
 */
export function LegalText({ doc, sheet }: { doc: LegalDocument; sheet?: boolean }) {
  const { t, lang } = useI18n();
  const numbered = doc.id === "terms";
  const effective = <Text style={aside}>{t("legal.effective", { date: legalDate(legalLang(lang), doc.effective) })}</Text>;
  return (
    <View style={{ gap: sheet ? 18 : 14 }}>
      {__DEV__ && !operatorReady() && (
        <Text style={[textRole.itemTitle, { color: mono.warn }]}>{t("legal.draft")}</Text>
      )}
      {!!doc.notice && <Text style={aside}>{doc.notice}</Text>}
      {!!doc.kicker && <Text style={lineTitle}>{doc.kicker}</Text>}
      <Text
        accessibilityRole="header"
        style={[textRole.pageTitle, { color: mono.ink }]}
      >
        {doc.title}
      </Text>
      {!sheet && effective}
      {!!doc.lead && <Text style={aside}>{doc.lead}</Text>}
      {doc.blocks.map((block, i) => (
        <Block key={i} block={block} numbered={numbered} />
      ))}
      {sheet && effective}
    </View>
  );
}

function Block({ block, numbered }: { block: LegalBlock; numbered: boolean }) {
  switch (block.kind) {
    case "heading":
      return (
        <Text accessibilityRole="header" style={[textRole.sectionTitle, { marginTop: 10, color: mono.ink }]}>
          {block.text}
        </Text>
      );
    case "text":
      return <Text style={block.strong ? strong : body}>{block.text}</Text>;
    case "list":
      return (
        <View style={{ gap: 8 }}>
          {block.items.map((item, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 8 }}>
              <Text style={[body, { minWidth: numbered ? 18 : 10 }]}>{numbered ? `${i + 1}.` : "·"}</Text>
              <Text style={[body, { flex: 1 }]}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case "table":
      return (
        <View style={{ borderTopWidth: 1.5, borderColor: mono.ink }}>
          {!!block.caption && (
            <Text style={[textRole.itemTitle, { paddingTop: 10, paddingBottom: 6, color: mono.ink }]}>{block.caption}</Text>
          )}
          {block.rows.map((row, i) => (
            <View key={i} style={{ paddingVertical: 10, gap: 4, borderBottomWidth: 1, borderColor: mono.hair }}>
              <Text style={[textRole.itemTitle, { color: mono.gray }]}>{row.label}</Text>
              <Text selectable style={row.strong ? strong : body}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      );
    case "box":
      return (
        <View style={{ borderWidth: 1.5, borderColor: mono.ink }}>
          {block.sections.map((section, i) => (
            <View key={i} style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderTopWidth: i ? 1 : 0, borderColor: mono.hair }}>
              <Text style={[textRole.itemTitle, { color: mono.gray }]}>{section.label}</Text>
              {section.lines.map((line, j) => (
                <View key={j} style={{ gap: 2 }}>
                  {!!line.title && (
                    <Text style={section.strong ? strongTitle : lineTitle}>
                      {line.title}
                      {!!line.contact && <Text selectable style={aside}>{`  ${line.contact}`}</Text>}
                    </Text>
                  )}
                  <Text selectable style={section.strong ? boxStrong : body}>
                    {line.text}
                  </Text>
                  {!!line.note && <Text style={aside}>{line.note}</Text>}
                </View>
              ))}
            </View>
          ))}
        </View>
      );
    case "fine":
      return <Text style={aside}>{block.text}</Text>;
  }
}

const body = { ...textRole.body, color: mono.ink };
const aside = { ...textRole.body, color: mono.gray };
const strong = { ...textRole.sectionTitle, color: mono.ink };
// 상자 안 줄의 이름. 강조 묶음에서는 받는 자 이름과 본문도 강조 크기로 보인다.
const lineTitle = { ...textRole.itemTitle, color: mono.ink };
const strongTitle = strong;
const boxStrong = strong;
