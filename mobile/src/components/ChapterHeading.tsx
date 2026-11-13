import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { diary, mono, textRole } from "../theme/tokens";

// 제목 옆 로마 숫자 장 번호(II, III…)는 뜻이 전해지지 않고 버튼처럼 보여 두지 않는다.
// 탭 제목은 화면 이름이라 pageTitle 크기로 둔다. 일기 탭과 같은 크기라야 수첩의 쪽끼리 같은 문법으로 읽힌다.
// 버튼(right)은 제목 줄 안에 두어 제목과 같은 높이로 맞추고, 선은 머리 전체 아래로 끝까지 긋는다.
export function ChapterHeading({title,sub,right}:{title:string;sub?:string;right?:ReactNode}) {
  return <View style={{gap:12,paddingTop:10,paddingBottom:18,borderBottomWidth:1,borderColor:diary.silver}}>
    <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12}}>
      <Text accessibilityRole="header" style={[textRole.pageTitle,{flexShrink:1,color:mono.ink}]}>{title}</Text>
      {right}
    </View>
    {!!sub && <Text style={[textRole.meta,{color:mono.gray}]}>{sub}</Text>}
  </View>;
}
