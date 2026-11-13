import type { ReactNode } from "react";
import { View, type TextStyle } from "react-native";
import type { PaperStyle } from "../data/notebookDesign";
import { mono, textRole } from "../theme/tokens";
import { PaperSurface } from "./PaperSurface";

// 예전에 남긴 기록(JEV의 한 줄 기록 포함)을 읽는 글자. 앱 전체와 같은 시스템 글꼴을 쓴다.
export const journalType = {
  heading: { ...textRole.pageTitle, color: mono.ink },
  body: { ...textRole.body, lineHeight: 26, color: mono.ink },
} as const satisfies Record<string, TextStyle>;

// 읽기와 쓰기가 같은 행간·종이 여백을 사용한다. 조작 버튼은 지면 밖에 둔다.
export function JournalPaper({ paper, children, fill = false }: { paper: PaperStyle; children: ReactNode; fill?: boolean }) {
  return <PaperSurface paper={paper} style={fill ? { flexGrow: 1 } : undefined}><View style={{ flexGrow: fill ? 1 : 0, paddingHorizontal: 4, paddingTop: 8, paddingBottom: 24, minHeight: 320 }}>{children}</View></PaperSurface>;
}
