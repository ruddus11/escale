import type { ReactNode } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { useI18n } from "../i18n/I18n";
import { Chevron, IconButton, LineButton, SolidButton, TextLink, type IconName } from "../theme/mono";
import { dateForTimeText, stepTimeText, timeTextOfDate } from "../data/timeText";
import { diary, mono, radius, space, textRole } from "../theme/tokens";
// 흑백 틀(theme/tokens.ts)을 그대로 가리킨다. 값을 여기 따로 적지 않는다. 예전 이름(blue, coral)은 화면 코드 호환을 위해 남긴다.
export const colors = {
  paper: mono.bg,
  ink: mono.ink,
  muted: mono.gray,
  line: mono.hair,
  blue: mono.accent,
  wash: diary.inset,
  coral: mono.warn,
  white: mono.white,
};
// 숫자도 굵은 고딕으로 쓴다. 예전 세리프 자리는 시스템 글꼴로 둔다.
export const serif: string | undefined = undefined;
export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}
export function Title({ children }: { children: ReactNode }) {
  return <Text style={s.title}>{children}</Text>;
}
export function Caption({ children }: { children: ReactNode }) {
  return <Text lineBreakStrategyIOS="hangul-word" style={s.caption}>{children}</Text>;
}
// 예전 패널 버튼. 모양은 mono의 두 규칙(채움·테두리)을 그대로 쓴다. quiet = 테두리.
export function Button({
  title,
  onPress,
  quiet,
  disabled,
  danger,
  icon,
}: {
  title: string;
  onPress: () => void;
  quiet?: boolean;
  disabled?: boolean;
  danger?: boolean;
  icon?: IconName;
}) {
  const Shape = quiet ? LineButton : SolidButton;
  return <Shape title={title} onPress={onPress} disabled={disabled} danger={danger} icon={icon} />;
}
// 예전 이름. 글자 행동은 mono.TextLink 하나로 그린다.
export function TextAction({title,onPress,disabled,danger,icon}:{title:string;onPress:()=>void;disabled?:boolean;danger?:boolean;icon?:IconName}) {
  return <TextLink title={title} onPress={onPress} disabled={disabled} tone={danger ? "danger" : "inline"} icon={icon} style={{ paddingHorizontal: 8 }} />;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={s.field}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[
          s.input,
          props.multiline && { minHeight: 110, textAlignVertical: "top" },
        ]}
        autoCorrect={false}
        {...props}
      />
    </View>
  );
}
export function DateField({
  label,
  value,
  onChange,
  line=false,
}: {
  label: string;
  value: string;
  onChange: (date: string) => void;
  line?: boolean;
}) {
  const { t, lang } = useI18n();
  const [show, setShow] = useState(false);
  const date = new Date(value + "T12:00:00");
  return (
    <View style={s.field}>
      <Label>{label}</Label>
      {line ? <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value}`} accessibilityState={{expanded:show}} onPress={()=>setShow(!show)} style={({pressed})=>({minHeight:48,justifyContent:"center",paddingHorizontal:14,borderRadius:12,backgroundColor:diary.surface,opacity:pressed?.6:1})}><Text style={[textRole.body,{color:colors.ink}]}>{value}</Text></Pressable> : <Button title={value} quiet onPress={() => setShow(!show)} />}
      {show && (
        <>
          <DateTimePicker
            value={isNaN(date.getTime()) ? new Date() : date}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            locale={lang}
            onChange={(event, picked) => {
              if (Platform.OS !== "ios") setShow(false);
              if (event.type === "set" && picked)
                onChange(
                  `${picked.getFullYear()}-${String(picked.getMonth() + 1).padStart(2, "0")}-${String(picked.getDate()).padStart(2, "0")}`,
                );
            }}
          />
          {Platform.OS === "ios" && (
            <Button
              title={t("ui.dateDone")}
              quiet
              onPress={() => setShow(false)}
            />
          )}
        </>
      )}
    </View>
  );
}
// 예약 시각 칸. DateField처럼 눌러서 선택기를 열고, 저장 형식은 "HH:MM" 문자열 그대로 둔다(비우기 허용).
// 웹에는 기본 선택기가 없어(라이브러리가 아무것도 그리지 않는다) 시는 1시간, 분은 1분·10분씩 옮기는 버튼을 대신 보인다.
export function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (time: string) => void;
}) {
  const { t, lang } = useI18n();
  const [show, setShow] = useState(false);
  // iOS 휠과 웹 버튼은 고르는 동안 보이는 값. 완료를 누르면 손대지 않은 정오 값도 저장한다.
  const [draft, setDraft] = useState(value);
  // 비었거나 형식이 틀린 값은 정오로 보인다. 저장값은 사용자가 고를 때까지 그대로다.
  const shown = timeTextOfDate(dateForTimeText(draft));
  const pick = (time: string) => {
    setDraft(time);
    onChange(time);
  };
  const open = () => {
    setDraft(value);
    setShow(!show);
  };
  const done = () => {
    if (!value) onChange(shown);
    setShow(false);
  };
  return (
    <View style={s.field}>
      <Label>{label}</Label>
      <LineButton title={value || "--:--"} label={`${label}, ${value || t("ui.timeNone")}`} onPress={open} />
      {show && Platform.OS === "web" && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <IconButton icon="minus" label={t("ui.hourLess")} onPress={() => pick(stepTimeText(shown, "hour", -1))} />
          <Text accessibilityLiveRegion="polite" style={[textRole.feature, { color: colors.ink }]}>{shown.slice(0, 2)}</Text>
          <IconButton icon="plus" label={t("ui.hourMore")} onPress={() => pick(stepTimeText(shown, "hour", 1))} />
          <Text style={[textRole.feature, { color: colors.ink }]}>:</Text>
          <TextLink title="−10" label={t("ui.minuteLessTen")} onPress={() => pick(stepTimeText(shown, "minute", -10))} style={{ minWidth: 44, alignItems: "center" }} />
          <IconButton icon="minus" label={t("ui.minuteLess")} onPress={() => pick(stepTimeText(shown, "minute", -1))} />
          <Text accessibilityLiveRegion="polite" style={[textRole.feature, { color: colors.ink }]}>{shown.slice(3, 5)}</Text>
          <IconButton icon="plus" label={t("ui.minuteMore")} onPress={() => pick(stepTimeText(shown, "minute", 1))} />
          <TextLink title="+10" label={t("ui.minuteMoreTen")} onPress={() => pick(stepTimeText(shown, "minute", 10))} style={{ minWidth: 44, alignItems: "center" }} />
        </View>
      )}
      {show && Platform.OS !== "web" && (
        <DateTimePicker
          value={dateForTimeText(shown)}
          mode="time"
          is24Hour
          display={Platform.OS === "ios" ? "spinner" : "default"}
          locale={lang}
          onChange={(event, picked) => {
            if (Platform.OS !== "ios") setShow(false);
            if (event.type === "set" && picked) pick(timeTextOfDate(picked));
          }}
        />
      )}
      {show && Platform.OS !== "android" && <Button title={t("ui.timeDone")} quiet onPress={done} />}
      {!!value && !show && <TextLink tone="dismiss" title={t("ui.timeClear")} onPress={() => onChange("")} style={{ alignSelf: "flex-start" }} />}
    </View>
  );
}
export function Sheet({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      // iOS: 키보드가 올라오면 입력칸이 가려지지 않게 스크롤 여백을 맞춘다.
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={s.page}
    >
      {children}
    </ScrollView>
  );
}
export function Row({
  title,
  detail,
  marker,
  onPress,
}: {
  title: string;
  detail?: string;
  marker?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={[title, detail].filter(Boolean).join(" · ")}
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && onPress && { opacity: 0.6 }]}
    >
      {marker && <Text style={s.marker}>{marker}</Text>}
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {detail ? <Caption>{detail}</Caption> : null}
      </View>
      {onPress && <Chevron />}
    </Pressable>
  );
}
export function Choices<T extends string>({
  value,
  choices,
  onChange,
}: {
  value: T;
  choices: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={s.choices}>
      {choices.map((c) => (
        <Pressable
          key={c.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: c.value === value }}
          onPress={() => onChange(c.value)}
          style={[
            s.choice,
            value === c.value && { backgroundColor: mono.accent },
          ]}
        >
          <Text
            style={{
              ...textRole.meta,
              color: value === c.value ? colors.paper : colors.ink,
            }}
          >
            {c.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export const s = StyleSheet.create({
  page: { paddingHorizontal: space.gutter, paddingTop: 22, paddingBottom: 40, gap: 18 },
  // 글자 크기·굵기는 theme/tokens.ts의 textRole을 따른다.
  title: { ...textRole.pageTitle, color: colors.ink },
  label: { ...textRole.label, color: colors.muted },
  caption: { ...textRole.meta, color: colors.muted },
  field: { gap: 8 },
  input: {
    backgroundColor: diary.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    ...textRole.body,
    color: colors.ink,
  },
  row: {
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingVertical: 18,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    minHeight: 65,
  },
  rowTitle: { ...textRole.body, lineHeight: 24, color: colors.ink },
  marker: { ...textRole.sectionTitle, color: colors.ink, minWidth: 30 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    backgroundColor: diary.surface,
    borderRadius: radius.pill,
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  error: { ...textRole.meta, color: mono.warn },
  divider: { height: 1, backgroundColor: colors.line },
  header: {
    minHeight: 56,
    paddingHorizontal: space.gutter,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  headerButton: { padding: 12, minHeight: 44 },
  headerTitle: { ...textRole.control, color: colors.ink },
  book: {
    minHeight: 165,
    borderRadius: 0,
    padding: 18,
    paddingLeft: 23,
    justifyContent: "space-between",
    borderLeftWidth: 7,
    borderLeftColor: mono.hair,
  },
  spread: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tag: { ...textRole.label, color: colors.ink },
  note: { backgroundColor: colors.wash, padding: 20, gap: 12, borderRadius: 0 },
  section: { gap: 8, marginTop: 8 },
  tabs: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: { ...textRole.label },
  // 선택한 탭은 수첩 위로 튀어나온 책갈피처럼 보인다.
  bookmark: {
    backgroundColor: diary.paper,
    borderTopWidth: 3,
    borderTopColor: colors.blue,
  },
  dateHead: { ...textRole.sectionTitle, color: colors.ink, marginTop: 10 },
  reading: { ...textRole.body, lineHeight: 27, color: colors.ink },
  amount: { ...textRole.feature, color: colors.ink },
  empty: { minHeight: 200, justifyContent: "center", gap: 20 },
  toolbar: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
});
