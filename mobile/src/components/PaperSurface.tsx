import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import type { PaperStyle } from "../data/notebookDesign";
import { diary } from "../theme/tokens";
export function PaperSurface({ children, style }: { paper: PaperStyle; children: ReactNode; style?: StyleProp<ViewStyle>; stitch?: boolean }) {
  return <View style={[{ backgroundColor: diary.page }, style]}>{children}</View>;
}
