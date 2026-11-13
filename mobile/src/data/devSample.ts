import { createTrip } from "../../../src/domain/workspace/tripForm";
import type { TripExpense, TripWorkspace } from "../../../src/domain/workspace/types";
import type { Reservation } from "../../../src/domain/reservations/types";
import { zonedDate } from "../../../src/domain/time/zoned";
import type { PageEntry } from "./model";

// 개발 빌드에서만 쓰는 예시 여행. 화면 점검과 캡처용으로 "지금 여행 중"인 오사카 3박 4일과
// 이미 다녀온 타이베이 여행을 만든다. 출시 빌드에서는 부르는 곳이 __DEV__로 막혀 있다.

const day = (base: string, offset: number) => new Date(Date.parse(`${base}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);

export function sampleTrips(now: Date): { trips: TripWorkspace[]; pages: PageEntry[] } {
  const today = zonedDate(now, "Asia/Tokyo");
  const start = day(today, -1);
  const end = day(today, 2);
  const osaka = createTrip(
    { title: "오사카 먹방 여행", destination: "오사카", startDate: start, endDate: end, timeZone: "Asia/Tokyo", baseCurrency: "KRW", localCurrency: "JPY", members: [{ name: "나" }, { name: "민지" }, { name: "준호" }], coverColor: "ink" },
    { id: `sample-osaka-${start}`, now },
  );
  const [me, minji, junho] = osaka.settings.members.map((m) => m.id);
  const stamp = now.toISOString();
  const reservations: Reservation[] = [
    { id: `${osaka.id}-flight`, kind: "flight", title: "KE723 인천 → 간사이", serviceNumber: "KE723", departure: "ICN", arrival: "KIX", startDate: start, startTime: "08:30", timeZone: "Asia/Seoul", endDate: start, endTime: "10:20", endTimeZone: "Asia/Tokyo", updatedAt: stamp },
    { id: `${osaka.id}-stay`, kind: "stay", title: "호텔 난바 오리엔탈", address: "大阪市中央区千日前2-8-17", startDate: start, startTime: "15:00", endDate: end, endTime: "11:00", timeZone: "Asia/Tokyo", updatedAt: stamp },
    { id: `${osaka.id}-usj`, kind: "activity", title: "유니버설 스튜디오 재팬 입장권", address: "Universal Studios Japan", startDate: day(today, 1), startTime: "09:00", timeZone: "Asia/Tokyo", updatedAt: stamp },
    { id: `${osaka.id}-back`, kind: "flight", title: "KE724 간사이 → 인천", serviceNumber: "KE724", departure: "KIX", arrival: "ICN", startDate: end, startTime: "14:10", timeZone: "Asia/Tokyo", endDate: end, endTime: "16:05", endTimeZone: "Asia/Seoul", updatedAt: stamp },
  ];
  osaka.reservations = reservations;
  osaka.budget.totalBudgetMinor = 1_200_000;
  osaka.budget.dailyBudgetMinor = 150_000;
  const at = (date: string, time: string) => new Date(`${date}T${time}:00+09:00`).toISOString();
  const expense = (id: string, title: string, yen: number, category: TripExpense["category"], when: string, payer: string, split = [me, minji, junho]): TripExpense => ({
    id: `${osaka.id}-${id}`, title, amount: yen, currency: "JPY", rateToBase: "9.12", category, method: "card", occurredAt: when,
    paidBy: { kind: "member", memberId: payer }, split: { kind: "even", memberIds: split },
  });
  osaka.ledger.expenses = [
    expense("e0", "포켓 와이파이 예약", 3600, "other", at(day(start, -3), "21:00"), me),
    expense("e1", "라피트 특급", 4620, "transport", at(start, "11:10"), me),
    expense("e2", "이치란 라멘", 3900, "food", at(start, "13:00"), minji),
    expense("e3", "도톤보리 타코야키", 1800, "food", at(start, "19:40"), junho),
    expense("e4", "구로몬 시장", 6200, "food", at(today, "10:30"), me),
    expense("e5", "오사카성 입장", 1800, "admission", at(today, "13:10"), minji),
    expense("e6", "드럭스토어", 5400, "shopping", at(today, "16:00"), me, [me]),
  ];
  const page = (id: string, title: string, date: string, time: string | undefined, address: string, done = false, kind: PageEntry["kind"] = "plan"): PageEntry => ({
    id: `${osaka.id}-${id}`, tripId: osaka.id, kind, title, date, body: "", address, done, ...(time ? { time, minutes: 90 } : {}),
  });
  const nowHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", hourCycle: "h23" }).format(now));
  const soon = `${String(Math.min(22, nowHour + 1)).padStart(2, "0")}:20`;
  const later = `${String(Math.min(23, nowHour + 3)).padStart(2, "0")}:00`;
  const pages: PageEntry[] = [
    page("p1", "도톤보리 산책", start, "18:00", "道頓堀, 大阪市中央区", true),
    page("p2", "구로몬 시장", today, "10:00", "黒門市場, 大阪市中央区日本橋2-4-1", true),
    page("p3", "오사카성 천수각", today, "13:00", "大阪城, 大阪市中央区大阪城1-1", true),
    page("p4", "우메다 스카이빌딩 공중정원", today, soon, "梅田スカイビル, 大阪市北区大淀中1-1-88"),
    page("p5", "신세카이 쿠시카츠", today, later, "新世界, 大阪市浪速区恵美須東"),
    page("p6", "덴포잔 대관람차", day(today, 1), undefined, "天保山大観覧車"),
    page("p7", "나카노시마 장미정원", today, undefined, "中之島バラ園", false, "place"),
    page("p8", "카이유칸 수족관", today, undefined, "海遊館, 大阪市港区海岸通1-1-10", false, "place"),
  ];
  const taipei = createTrip(
    { title: "타이베이 주말", destination: "타이베이", startDate: day(today, -40), endDate: day(today, -37), timeZone: "Asia/Taipei", baseCurrency: "KRW", localCurrency: "TWD", members: [{ name: "나" }], coverColor: "ink" },
    { id: `sample-taipei-${start}`, now },
  );
  return { trips: [osaka, taipei], pages };
}
