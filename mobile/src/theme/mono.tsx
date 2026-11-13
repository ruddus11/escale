import type { ReactNode } from "react";
import {

Pressable,
StyleSheet,
Text,
View,
type StyleProp,
type TextStyle,
type ViewStyle,
} from "react-native";
import Svg,{ Circle,Path } from "react-native-svg";
import type { ExpenseCategory } from "../../../src/domain/workspace/types";
import brand from "./brand.json";
import { buttonA11y,selectionState,tabTitle,type SelectRole } from "./selection";
import { actionText,categoryTone,diary,mono,radius,space,textRole } from "./tokens";


/** 앱 안의 작은 인장은 앱 아이콘과 같은 돛 세 개(brand.glyph, 2026-11-12 새 로고)를 한 색으로 그린다. */
export const SEAL_MIN_SIZE = 24;

// 돛 사이 틈이 24pt 아래에서는 뭉개져 그보다 작게 그리지 않는다. 판이 가로로 길어(200×145) 정사각 칸 안에 가로를 맞춰 넣는다.
export function sealSize(size: number): number {
  return Math.max(size, SEAL_MIN_SIZE);
}

export function Seal({ size = 40, color = mono.ink }: { size?: number; color?: string; bg?: string }) {
  const side = sealSize(size);
  return <Svg accessible={false} width={side} height={side} viewBox={brand.glyph.viewBox}>
    <Path d={brand.glyph.d} fill={color} fillRule={brand.glyph.fillRule as "nonzero" | "evenodd"} />
  </Svg>;
}

export function Wordmark({ size = 32, color = mono.ink, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return (
    // 워드마크는 제목용 세리프로 쓴다. 블랙레터는 깨끗한 돛 마크와 어긋난다.
    <Text accessibilityLabel={brand.wordmark} allowFontScaling={false} style={[{ fontWeight: "600", fontSize: size, lineHeight: size * 1.3, color }, style]}>
      {brand.wordmark}
    </Text>
  );
}

/** 한국어 화면에서만 워드마크 아래에 붙는 문구. 블랙레터를 쓰지 않는다. */
export function brandSubtitle(lang: string): string | undefined {
  return lang === "ko" ? brand.subtitle.ko : undefined;
}

/** 짧은 이름표 한 줄(칸 이름, 개수, 날짜 묶음). 구분은 " · " 글자 그대로 쓴다. */
export function Caps({ children, color = mono.gray, style }: { children: string; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text style={[textRole.label, { color, letterSpacing: isLatinCaps(children) ? 0.4 : 0 }]}>{children}</Text>
    </View>
  );
}

// 영어 대문자로만 된 이름표만 살짝 띄운다. 한글에는 자간을 넣지 않는다.
const isLatinCaps = (text: string) => /[A-Z]/.test(text) && !/[a-z가-힣ぁ-ヿ一-龯]/.test(text);

/** 화면 이름. 내용보다 크게 외치지 않도록 pageTitle 크기로 둔다. */
export function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text accessibilityRole="header" style={[textRole.pageTitle, { color: mono.ink }]}>
        {title}
      </Text>
      {!!sub && <Text style={[textRole.meta, { color: mono.gray }]}>{sub}</Text>}
    </View>
  );
}

/** 묶음 제목. 얇은 선 하나로 아래 목록과 나눈다. */
export function SectionHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44, borderBottomWidth: 1, borderColor: mono.hair }}>
      <Text accessibilityRole="header" style={[textRole.sectionTitle, { flexShrink: 1, color: mono.ink }]}>
        {title}
      </Text>
      {right}
    </View>
  );
}

/**
 * 글자로 된 행동 하나. 화면 어디서든 이 모양만 쓴다(actionText).
 * 글자는 작아도 누르는 자리는 44pt를 지킨다.
 * URL·mailto를 여는 곳은 role="link"를 넘겨 화면 읽기 프로그램이 링크로 읽게 한다.
 * body는 법률 화면처럼 본문(17pt)보다 작게 쓰면 안 되는 곳에서 글자 크기만 본문으로 올린다. 색은 tone을 따른다.
 */
export function TextLink({ title, onPress, tone = "inline", label, disabled, style, role = "button", body, icon }: { title: string; onPress: () => void; tone?: keyof typeof actionText; label?: string; disabled?: boolean; style?: StyleProp<ViewStyle>; role?: "button" | "link"; body?: boolean; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label ?? title}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [{ minHeight: space.touch, flexDirection: "row", alignItems: "center", gap: 6, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }, style]}
    >
      {/* 더하기 같은 표시는 글자 기호(＋) 대신 선 아이콘으로 그린다. */}
      {icon && <Icon name={icon} size={16} color={actionText[tone].color} weight={1.8} />}
      <Text style={[actionText[tone], body && { fontSize: textRole.body.fontSize, lineHeight: textRole.body.lineHeight }]}>{title}</Text>
    </Pressable>
  );
}

export type IconName = "back" | "close" | "plus" | "search" | "gear" | "menu" | "clock" | "sliders" | "pen" | "up" | "pin" | "chevron" | "down" | "camera" | "pouch" | "minus" | "mic" | "stop" | "play" | "pause" | "share" | "route" | "steps" | "trash" | "check" | "book" | "swap" | "calendar" | "wallet" | "passport" | "sun" | "ticket" | "list" | "users" | "plane" | "bed";

const GEAR =
  "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z";

export function Icon({ name, size = 18, color = mono.ink, weight = 1.8 }: { name: IconName; size?: number; color?: string; weight?: number }) {
  const line = { stroke: color, strokeWidth: weight, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  let body: ReactNode;
  switch (name) {
    case "back":
      body = <Path d="M15 18l-6-6 6-6" {...line} />;
      break;
    case "close":
      body = <Path d="M6 6l12 12M18 6L6 18" {...line} />;
      break;
    case "plus":
      body = <Path d="M12 5v14M5 12h14" {...line} />;
      break;
    case "minus":
      body = <Path d="M5 12h14" {...line} />;
      break;
    case "search":
      body = (
        <>
          <Circle cx={11} cy={11} r={6} {...line} />
          <Path d="M20 20l-4.5-4.5" {...line} />
        </>
      );
      break;
    case "gear":
      body = (
        <>
          <Circle cx={12} cy={12} r={3} {...line} />
          <Path d={GEAR} {...line} />
        </>
      );
      break;
    case "menu":
      body = (
        <>
          {[5, 12, 19].map((cx) => (
            <Circle key={cx} cx={cx} cy={12} r={1.6} fill={color} />
          ))}
        </>
      );
      break;
    case "clock":
      body = (
        <>
          <Circle cx={12} cy={12} r={8.5} {...line} />
          <Path d="M12 7.5V12l3 2" {...line} />
        </>
      );
      break;
    case "sliders":
      body = (
        <>
          <Path d="M4 7h10M18 7h2M4 17h4M12 17h8" {...line} />
          <Circle cx={16} cy={7} r={2} {...line} />
          <Circle cx={10} cy={17} r={2} {...line} />
        </>
      );
      break;
    case "pen":
      body = <Path d="M4 20h4L19 9l-4-4L4 16v4z" {...line} />;
      break;
    case "up":
      body = <Path d="M12 19V5M6 11l6-6 6 6" {...line} />;
      break;
    case "pin":
      body = (
        <>
          <Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" {...line} />
          <Circle cx={12} cy={10} r={2.3} {...line} />
        </>
      );
      break;
    case "chevron":
      body = <Path d="M9 6l6 6-6 6" {...line} />;
      break;
    case "camera":
      body = (
        <>
          <Path d="M4 8h3l1.6-2.4h6.8L17 8h3v11H4z" {...line} />
          <Circle cx={12} cy={13.2} r={3.4} {...line} />
        </>
      );
      break;
    case "down":
      body = <Path d="M6 9l6 6 6-6" {...line} />;
      break;
    case "pouch":
      body = (
        <>
          <Path d="M9.3 8.8C6.6 10.6 5 13 5 15.6 5 18.6 7.6 20.4 12 20.4s7-1.8 7-4.8c0-2.6-1.6-5-4.3-6.8" {...line} />
          <Path d="M9.3 8.6 8.5 4.9c1.1.6 2.3.9 3.5.9s2.4-.3 3.5-.9l-.8 3.7" {...line} />
          <Path d="M8.2 8.7h7.6" {...line} />
        </>
      );
      break;
    case "mic":
      body = (
        <>
          <Path d="M12 3.5a2.8 2.8 0 0 0-2.8 2.8v5.2a2.8 2.8 0 0 0 5.6 0V6.3A2.8 2.8 0 0 0 12 3.5z" {...line} />
          <Path d="M6.2 11.2a5.8 5.8 0 0 0 11.6 0M12 17v3.5" {...line} />
        </>
      );
      break;
    case "stop":
      body = <Path d="M7.5 7.5h9v9h-9z" {...line} fill={color} />;
      break;
    case "play":
      body = <Path d="M8.5 5.8v12.4L18.2 12z" {...line} />;
      break;
    case "pause":
      body = <Path d="M9 6v12M15 6v12" {...line} />;
      break;
    case "share":
      body = <Path d="M12 15V4M7.8 8.2 12 4l4.2 4.2M5 13.5V20h14v-6.5" {...line} />;
      break;
    case "route":
      body = (
        <>
          <Circle cx={6} cy={18} r={2} {...line} />
          <Circle cx={18} cy={6} r={2} {...line} />
          <Path d="M8 18h6.5a3 3 0 0 0 0-6h-5a3 3 0 0 1 0-6H16" {...line} strokeDasharray="0.1 3.4" />
        </>
      );
      break;
    case "steps":
      body = (
        <>
          <Path d="M7.6 4.5c1.7 0 2.7 1.9 2.7 4.3 0 1.6-.5 2.6-.7 3.7H6.2c-.4-1.3-1.1-2.3-1.1-4 0-2.3.9-4 2.5-4zM6.4 15h3.1v1.2a1.55 1.55 0 0 1-3.1 0z" {...line} />
          <Path d="M16.4 8.5c-1.7 0-2.7 1.9-2.7 4.3 0 1.6.5 2.6.7 3.7h3.4c.4-1.3 1.1-2.3 1.1-4 0-2.3-.9-4-2.5-4zM17.6 19h-3.1v1.2a1.55 1.55 0 0 0 3.1 0z" {...line} />
        </>
      );
      break;
    case "trash":
      body = <Path d="M5 7h14M9.5 7V4.8h5V7M7 7l.8 12.5h8.4L17 7M10.3 10.5v5.5M13.7 10.5v5.5" {...line} />;
      break;
    case "check":
      body = <Path d="M5 12.5l4.5 4.5L19 7.5" {...line} />;
      break;
    case "swap":
      body = <Path d="M5 8.5h13l-3.5-3.5M19 15.5H6l3.5 3.5" {...line} />;
      break;
    case "calendar":
      body = (
        <>
          <Path d="M5 6.5h14v13H5zM5 10.5h14M9 4v4M15 4v4" {...line} />
        </>
      );
      break;
    case "wallet":
      body = (
        <>
          <Path d="M4.5 7.5h13.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4.5 18V7.5zM4.5 7.5 15 4.5v3" {...line} />
          <Circle cx={15.8} cy={13.5} r={1.1} fill={color} />
        </>
      );
      break;
    case "passport":
      body = (
        <>
          <Path d="M6.5 3.5h11v17h-11z" {...line} />
          <Circle cx={12} cy={10.5} r={3} {...line} />
          <Path d="M9.5 16.5h5" {...line} />
        </>
      );
      break;
    case "sun":
      body = (
        <>
          <Circle cx={12} cy={12} r={3.6} {...line} />
          <Path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6" {...line} />
        </>
      );
      break;
    case "ticket":
      body = <Path d="M4 7.5h16v3a1.5 1.5 0 0 0 0 3v3H4v-3a1.5 1.5 0 0 0 0-3zM14 7.5v9" {...line} />;
      break;
    case "plane":
      body = <Path d="M10.5 13.5 4 11.5l1.2-1.2 6.3.6 4.3-4.6a1.6 1.6 0 0 1 2.3 2.3l-4.6 4.3.6 6.3-1.2 1.2-2-6.5-3.1 2.9.2 2-1 1-1.2-2.6L3.2 18.4l1-1 2 .2z" {...line} />;
      break;
    case "bed":
      body = <Path d="M3.5 18.5v-11M3.5 14h17v4.5M20.5 14v-2.5a2.5 2.5 0 0 0-2.5-2.5h-7v5M7.2 12a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4z" {...line} />;
      break;
    case "list":
      body = <Path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" {...line} />;
      break;
    case "users":
      body = (
        <>
          <Circle cx={9} cy={9} r={3} {...line} />
          <Path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6M15.5 6.2a3 3 0 0 1 0 5.6M17.5 14.6c1.6.6 2.6 2 3 4.4" {...line} />
        </>
      );
      break;
    case "book":
      body = <Path d="M12 6.5C10.2 5.2 7.8 4.8 4.5 5v13c3.3-.2 5.7.2 7.5 1.5 1.8-1.3 4.2-1.7 7.5-1.5V5c-3.3-.2-5.7.2-7.5 1.5zM12 6.5v13" {...line} />;
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}

/**
 * 행 끝을 나타내는 작은 쉐브론. 그림이 칸 오른쪽에서 약 6pt 안쪽에 있어 글자 오른쪽 끝에 맞게 밀어 준다.
 * 방향 표시일 뿐 행동이 아니라 언제나 회색으로 둔다.
 */
export function Chevron() {
  return (
    <View style={{ marginRight: -6 }}>
      <Icon name="chevron" size={16} color={mono.gray} />
    </View>
  );
}

/**
 * 아이콘 버튼(누르는 자리 44pt). 틀은 내용보다 먼저 읽히면 안 되므로 테두리 원 없이 선 아이콘만 둔다.
 * solid면 잉크 원으로 채운다(한 화면에 하나까지). quiet는 목록 행마다 반복되는 보조 행동용 회색 아이콘이다.
 * silver는 예전 은색 테두리 이름이 남은 것으로, 지금은 ink와 같은 모양이다.
 */
export function IconButton({ icon, label, onPress, solid, disabled, finish = "ink" }: { icon: IconName; label: string; onPress: () => void; solid?: boolean; disabled?: boolean; finish?: "ink" | "silver" | "quiet" }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radius.control,
        backgroundColor: solid ? mono.ink : "transparent",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} size={solid ? 18 : 22} color={solid ? mono.bg : finish === "quiet" ? mono.gray : mono.ink} weight={solid ? 2 : 1.6} />
    </Pressable>
  );
}

// 버튼은 두 규칙뿐이다. 주 행동은 딥 틸 채움(흰 글자), 나머지는 옅은 회색 면(잉크 글자).
// danger는 같은 모양에 경고색을 쓴다. 높이 52pt, 모서리 12.
// checked를 넘기면 둘 중 하나를 고르는 라디오로 읽힌다. 모양은 그대로다.
type ButtonProps = { title: string; onPress: () => void; disabled?: boolean; icon?: IconName; danger?: boolean; label?: string; style?: StyleProp<ViewStyle>; checked?: boolean };

export function SolidButton({ title, onPress, disabled, icon, danger, label, style, checked }: ButtonProps) {
  const fill = danger ? mono.warn : mono.accent;
  return (
    <Pressable
      {...buttonA11y(checked, disabled)}
      accessibilityLabel={label ?? title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        { minHeight: 52, paddingHorizontal: 22, borderRadius: radius.control, backgroundColor: fill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.35 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {icon && <Icon name={icon} color={mono.bg} weight={2} />}
      <Text style={[textRole.control, { color: mono.bg, textAlign: "center" }]}>{title}</Text>
    </Pressable>
  );
}

export function LineButton({ title, onPress, disabled, icon, danger, label, style, checked }: ButtonProps) {
  const tone = danger ? mono.warn : mono.ink;
  return (
    <Pressable
      {...buttonA11y(checked, disabled)}
      accessibilityLabel={label ?? title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        { minHeight: 52, paddingHorizontal: 22, borderRadius: radius.control, backgroundColor: diary.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 },
        style,
      ]}
    >
      {icon && <Icon name={icon} color={tone} weight={2} />}
      <Text style={[textRole.control, { color: tone, textAlign: "center" }]}>{title}</Text>
    </Pressable>
  );
}

/** 하나만 고르면 role="radio", 여럿을 고르면 role="checkbox"를 넘긴다. 눌러서 실행만 하는 칩은 기본값 그대로 둔다. */
export function Chip({ title, onPress, selected, left, disabled, role = "button" }: { title: string; onPress: () => void; selected?: boolean; left?: ReactNode; disabled?: boolean; role?: SelectRole }) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={selectionState(role, !!selected)}
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        backgroundColor: selected ? mono.accent : diary.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      {left}
      <Text style={[textRole.meta, { fontWeight: "600", color: selected ? mono.bg : mono.ink }]}>{title}</Text>
    </Pressable>
  );
}

/**
 * 빈 화면 안내. 무엇이 비었는지 한 문장, 다음에 할 일 버튼 하나.
 * 같은 행동이 묶음 제목이나 화면 머리에 이미 있으면 action을 넘기지 않는다(같은 버튼을 두 번 두지 않는다).
 * 선은 묶음 제목이 긋는다. 여기서 또 그으면 두 줄이 겹친다.
 */
export function EmptyState({ text, action }: { text: string; action?: { title: string; onPress: () => void; icon?: IconName; disabled?: boolean } }) {
  return (
    <View style={{ gap: 14, paddingVertical: space.group }}>
      <Text lineBreakStrategyIOS="hangul-word" style={[textRole.body, { color: mono.gray }]}>{text}</Text>
      {action && <LineButton title={action.title} icon={action.icon} disabled={action.disabled} onPress={action.onPress} />}
    </View>
  );
}

/**
 * 밑줄 탭. 화면 어디서든 이 모양만 쓴다. 고른 탭만 잉크색과 600 굵기, 밑줄로 표시한다.
 * count를 넘기면 보이는 글자와 읽기 라벨에 함께 들어간다. 줄이 넘치면 다음 줄로 내려 큰 글씨에서도 잘리지 않는다.
 */
export function UnderlineTabs<K extends string>({ items, value, onChange, disabled, label, style }: {
  items: readonly { key: K; title: string; count?: number }[];
  value: K;
  onChange: (key: K) => void;
  disabled?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={[{ flexDirection: "row", flexWrap: "wrap", columnGap: space.gutter }, style]}>
      {items.map((item) => {
        const on = item.key === value;
        const text = tabTitle(item.title, item.count);
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={text}
            accessibilityState={{ selected: on, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => ({ minHeight: space.touch, justifyContent: "center", borderBottomWidth: 2, borderColor: on ? mono.accent : "transparent", opacity: disabled ? 0.35 : pressed ? 0.6 : 1 })}
          >
            <Text style={[textRole.control, { fontWeight: on ? "600" : "400", color: on ? mono.ink : mono.gray }]}>{text}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Tag({ text, solid }: { text: string; solid?: boolean }) {
  return (
    <View style={{ alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, borderWidth: solid ? 1 : 0, borderColor: mono.accent, backgroundColor: solid ? "transparent" : mono.accentSoft }}>
      <Text style={[textRole.label, { color: mono.accentText }]}>{text}</Text>
    </View>
  );
}

export function Check({ done, size = 20 }: { done: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {done ? (
        <>
          <Circle cx={12} cy={12} r={11} fill={mono.accent} />
          <Path d="M7.4 12.3l3 3 6.2-6.5" stroke={mono.onInk} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      ) : (
        <Circle cx={12} cy={12} r={10.5} stroke={mono.soft} strokeWidth={1.6} fill="none" />
      )}
    </Svg>
  );
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function Bar({ ratio, height = 4, color = mono.accent }: { ratio: number; height?: number; color?: string }) {
  return (
    <View style={{ height, borderRadius: height / 2, overflow: "hidden", backgroundColor: mono.track, flexDirection: "row" }}>
      <View style={{ width: `${clamp(ratio) * 100}%`, backgroundColor: color }} />
    </View>
  );
}

export function Stacked({ parts, height = 8 }: { parts: { ratio: number; category: ExpenseCategory }[]; height?: number }) {
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: mono.track, flexDirection: "row", overflow: "hidden" }}>
      {parts.map((p) => (
        <View key={p.category} style={{ width: `${clamp(p.ratio) * 100}%`, backgroundColor: categoryTone[p.category].fill }} />
      ))}
    </View>
  );
}

export function Swatch({ category, size = 10, onDark }: { category: ExpenseCategory; size?: number; onDark?: boolean }) {
  const tone = categoryTone[category];
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: tone.fill,
        borderWidth: tone.edge || onDark ? 1 : 0,
        borderColor: onDark ? mono.onInk : mono.ink,
      }}
    />
  );
}

export function TopBar({ left, center, right }: { left?: ReactNode; center?: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: space.gutter, paddingTop: 6, paddingBottom: 6 }}>
      <View style={{ minWidth: 44 }}>{left}</View>
      <View style={{ flex: 1, alignItems: "center" }}>{center}</View>
      <View style={{ minWidth: 44, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

/** 여행 안의 네 탭. 고른 탭만 딥 틸 아이콘·글자로 표시한다.
 * center를 주면 탭 가운데에 청록 돛 버튼(여행 도구)을 둔다. 탭이 아니라 여는 버튼이다.
 * 다른 탭처럼 아래에 이름을 달아 무엇을 여는지 보이게 하고, 길게 누르면 지출 적기처럼 자주 쓰는 일을 바로 연다. */
export function BottomNav<K extends string>({
  items,
  active,
  onSelect,
  label,
  disabled,
  center,
}: {
  items: { key: K; title: string; icon: IconName }[];
  active: K;
  onSelect: (key: K) => void;
  label: string;
  disabled?: boolean;
  center?: { label: string; title: string; hint?: string; onPress: () => void; onLongPress?: () => void };
}) {
  const half = Math.ceil(items.length / 2);
  return <View accessibilityRole="tablist" accessibilityLabel={label} style={{flexDirection:"row",alignItems:"center",backgroundColor:mono.bg,borderTopWidth:StyleSheet.hairlineWidth,borderColor:mono.rule}}>
    {items.map((item, i) => {
      const selected = item.key === active;
      const tab = <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={item.title}
        accessibilityState={{ selected, disabled: !!disabled }} disabled={disabled}
        onPress={() => onSelect(item.key)}
        style={({pressed}) => ({flex:1,minHeight:58,alignItems:"center",justifyContent:"center",gap:3,opacity:disabled ? 0.4 : pressed ? 0.6 : 1})}>
        <Icon name={item.icon} size={22} color={selected ? mono.accent : mono.gray} weight={selected ? 2 : 1.6}/>
        <Text style={[textRole.label,{fontSize:11,lineHeight:15,fontWeight:selected ? "600" : "400",color:selected ? mono.accent : mono.gray}]}>{item.title}</Text>
      </Pressable>;
      if (!center || i !== half) return tab;
      return [<Pressable key="center" accessibilityRole="button" accessibilityLabel={center.label} accessibilityHint={center.hint} disabled={disabled}
        onPress={center.onPress} onLongPress={center.onLongPress} delayLongPress={350} hitSlop={6}
        style={({pressed}) => ({flex:1,minHeight:58,alignItems:"center",justifyContent:"center",gap:3,opacity:disabled ? 0.4 : 1,transform:[{scale:pressed ? 0.96 : 1}]})}>
        {({pressed}) => <>
          <View style={{width:46,height:24,borderRadius:radius.pill,backgroundColor:pressed ? mono.accent : mono.sea,alignItems:"center",justifyContent:"center"}}>
            <Seal size={16} color={mono.coralChip} />
          </View>
          {/* 이름은 고르지 않은 탭과 같은 회색으로 둔다. 진하게 두면 어느 탭에서든 선택 표시가 둘로 보인다. */}
          <Text style={[textRole.label,{fontSize:11,lineHeight:15,fontWeight:"400",color:mono.gray}]}>{center.title}</Text>
        </>}
      </Pressable>, tab];
    })}
  </View>;
}

/** 화면 안의 보기 전환(시간표·캘린더·지도·예약 같은 것). 회색 판 없이 고른 칸 아래에만 청록 밑줄을 긋는다. */
export function Segmented<K extends string>({ items, value, onChange, label }: { items: readonly { key: K; title: string; icon?: IconName }[]; value: K; onChange: (key: K) => void; label: string }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={{ flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: mono.rule }}>
      {items.map((item) => {
        const on = item.key === value;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={item.title}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => ({ flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: -StyleSheet.hairlineWidth, borderBottomWidth: 2, borderColor: on ? mono.accent : "transparent", opacity: pressed ? 0.6 : 1 })}
          >
            {item.icon && <Icon name={item.icon} size={16} color={on ? mono.accent : mono.gray} />}
            <Text numberOfLines={1} style={[textRole.label, { fontWeight: on ? "600" : "400", color: on ? mono.ink : mono.gray }]}>{item.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 카드 하나. 옅은 회색 면, 모서리 14, 안쪽 16. 화면의 묶음은 모두 이 모양을 쓴다. */
export function Card({ children, style, onPress, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
  const base: ViewStyle = { backgroundColor: diary.surface, borderRadius: radius.card, padding: 16, gap: 10 };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [base, style, { opacity: pressed ? 0.7 : 1 }]}>
      {children}
    </Pressable>
  );
}
