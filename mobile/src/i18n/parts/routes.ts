import type { Entry } from "../entry";

// 계획 탭에서 두 장소 사이 이동을 Google 지도로 넘길 때 쓰는 문구.
export const ROUTE_STRINGS = {
  "route.maps": ["Google 지도에서 길 보기", "Directions in Google Maps", "Google マップで経路を見る"],
  "route.mapsFailed": ["지도 앱을 열지 못했어요.", "Couldn't open the map app.", "地図アプリを開けませんでした。"],
  "route.a11y": ["{from}에서 {to}까지 Google 지도에서 길 보기", "Directions from {from} to {to} in Google Maps", "{from}から{to}への経路を Google マップで見る"],
  // 지도 보기의 하루 동선
  "route.title": ["하루 동선", "Day route", "1日の動線"],
  "route.sort": ["가까운 순서로", "Sort by distance", "近い順に並べる"],
  "route.undo": ["되돌리기", "Undo", "元に戻す"],
  "route.undoA11y": ["순서 되돌리기", "Undo the new order", "並び順を元に戻す"],
  "route.hint": ["손잡이를 끌어 순서를 바꿔요. 지도는 곳과 곳을 직선으로 이어요.", "Drag a handle to reorder. The map joins stops with straight lines.", "つまみをドラッグして並べ替えます。地図は場所を直線で結びます。"],
  "route.missing": ["위치를 모르는 {n}곳은 지도에서 뺐어요.", "{n} stops without a location are left off the map.", "位置のわからない{n}か所は地図から外しました。"],
  "route.readFailed": ["동선 순서를 읽지 못했어요.", "Couldn't read the route order.", "動線の順序を読み込めませんでした。"],
  "route.reselect": ["날짜를 다시 골라 주세요.", "Please choose the date again.", "日付を選び直してください。"],
  "route.saveFailed": ["순서를 저장하지 못했어요.", "Couldn't save the order.", "順序を保存できませんでした。"],
  "route.rowA11y": ["{title}, {n}번째", "{title}, stop {n}", "{title}、{n}番目"],
  "route.down": ["아래로", "Move down", "下へ"],
  "route.up": ["위로", "Move up", "上へ"],
} as const satisfies Record<string, Entry>;
