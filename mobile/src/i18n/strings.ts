// 앱 문구 사전. 한 줄에 [한국어, English, 日本語] 순서로 둔다.
// 큰 제목(TODAY 같은 것)은 TITLES에 따로 두고, "큰 제목은 영어로"가 켜져 있으면 언어와 상관없이 영어를 쓴다.

export type Lang = "ko" | "en-US" | "en-GB" | "ja";

export const LANGS: { code: Lang; native: string; hint: string }[] = [
  { code: "ko", native: "한국어", hint: "Korean" },
  { code: "en-US", native: "English (US)", hint: "미국 영어" },
  { code: "en-GB", native: "English (UK)", hint: "영국 영어" },
  { code: "ja", native: "日本語", hint: "Japanese" },
];

const INDEX: Record<Lang, number> = { ko: 0, "en-US": 1, "en-GB": 1, ja: 2 };

import type { Entry } from "./entry";
import { ACCOUNT_STRINGS } from "./parts/account";
import { APP_STRINGS } from "./parts/app";
import { EDITOR_STRINGS } from "./parts/editors";
import { LEGAL_STRINGS } from "./parts/legal";
import { PLACE_STRINGS } from "./parts/places";
import { ROUTE_STRINGS } from "./parts/routes";
import { NOTEBOOK_STRINGS } from "./parts/notebook";
import { RESERVATION_STRINGS } from "./parts/reservations";
import { TODAY_STRINGS } from "./parts/today";
import { PICK_STRINGS } from "./parts/picks";
import { CONV_B_STRINGS } from "./parts/convB";
import { AUTOFILL_STRINGS } from "./parts/autofill";
import { ESCALE_STRINGS } from "./parts/escale";

const CORE = {
  // 여행 안의 네 탭: 계획 · 오늘 · 돈 · 여권.
  "tab.today": ["오늘", "Today", "今日"],
  "tab.plan": ["계획", "Plan", "計画"],
  "tab.money": ["돈", "Money", "お金"],
  "tab.stories": ["기록", "Stories", "記録"],
  "kit.close": ["배낭 닫기", "Close Kit", "持ち物を閉じる"],
  "kit.addReservation": ["예약 추가", "Add reservation", "予約を追加"],
  "kit.emptyReservations": ["숙소와 이동편을 넣어두면 여행 중 바로 확인할 수 있어요.", "Keep stays and transport here for easy access during your trip.", "宿泊先や移動の予約を入れて、旅先ですぐ確認できます。"],
  "kit.private": ["예약번호·QR·출입 비밀번호는 원래 예약 앱에서 확인하세요.", "Check booking codes, QR codes and access passwords in the original booking app.", "予約番号・QRコード・入室パスワードは予約元のアプリで確認してください。"],
  "kit.delete": ["삭제", "Delete", "削除"],
  "kit.deleteTitle": ["준비물을 지울까요?", "Delete this item?", "この持ち物を削除しますか？"],
  "kit.saveError": ["저장하지 못했어요. 다시 시도해 주세요.", "Could not save. Please try again.", "保存できませんでした。もう一度お試しください。"],
  "kit.stay": ["숙소", "Stay", "宿泊"],
  "kit.flight": ["항공", "Flight", "フライト"],
  "kit.transport": ["이동편", "Transport", "移動"],
  "kit.activity": ["티켓", "Ticket", "チケット"],
  "pouch.ask": ["묻거나 적기", "Ask or jot down", "質問やメモ"],
  "pouch.placeholder": ["택시 {money}", "Taxi {money}", "タクシー {money}"],
  "pouch.send": ["보내기", "Send", "送信"],
  "pouch.log": ["여행 도구 대화", "Trip kit log", "旅の道具の会話"],
  "pouch.chipLeft": ["남은 돈", "Money left", "残りのお金"],
  "pouch.chipStay": ["체크인 몇 시", "Check-in time", "チェックイン"],
  "pouch.chipNext": ["다음 이동", "Next ride", "次の移動"],
  "pouch.chipTomorrow": ["내일 첫 일정", "Tomorrow", "明日の予定"],
  "pouch.chipAirport": ["공항 몇 시", "Airport time", "空港 何時"],
  "pouch.chipPack": ["짐 목록", "Pack list", "持ち物"],
  "pouch.chipBookings": ["예약 전체", "All bookings", "予約一覧"],
  "pouch.chipToday": ["오늘 기록", "Today's notes", "今日の記録"],
  "pouch.in": ["남은 시간", "IN", "あと"],
  "pouch.tonight": ["오늘 밤", "Tonight", "今夜"],
  "pouch.checkIn": ["체크인", "Check-in", "チェックイン"],
  "pouch.checkOut": ["체크아웃", "Check-out", "チェックアウト"],
  "pouch.pack": ["준비물", "Packing", "持ち物"],
  "pouch.wallet": ["지갑", "Wallet", "財布"],
  "pouch.prep": ["준비", "Getting ready", "準備"],
  "pouch.stayRow": ["숙소", "Stay", "宿泊"],
  "pouch.noSavedStay": ["등록한 숙소가 없어요", "No stay added yet", "宿泊先はまだありません"],
  "pouch.noBookings": ["등록한 예약이 없어요", "No bookings yet", "予約はまだありません"],
  "pouch.packNone": ["챙길 것을 적어 두세요", "List what to bring", "持ち物を書いておきましょう"],
  "pouch.addShort": ["추가", "Add", "追加"],
  "pouch.bookingCount": ["{n}개 저장해 두었어요", "{n} saved", "{n}件保存済み"],
  "pouch.spent": ["지출", "Spent", "支出"],
  "pouch.left": ["{amount} 남음", "{amount} left", "残り{amount}"],
  "pouch.over": ["{amount} 넘음", "{amount} over", "{amount}超過"],
  "pouch.leftToday": ["오늘 남은 돈", "Left today", "今日の残り"],
  "pouch.edit": ["고치기", "Edit", "直す"],
  "pouch.undo": ["되돌리기", "Undo", "元に戻す"],
  "pouch.undone": ["되돌렸어요.", "Undone.", "元に戻しました。"],
  "pouch.gone": ["지운 지출이에요.", "This expense was deleted.", "削除した支出です。"],
  "pouch.needRate": ["{from} 환율을 아직 몰라서 저장하지 않았어요.", "I don't know the {from} rate yet, so nothing was saved.", "{from}のレートが分からないので、まだ保存していません。"],
  "pouch.finish": ["지출 적기에서 마저 적기", "Finish in Add expense", "支出の記録で続ける"],
  "pouch.noStay": ["오늘 밤 숙소 예약이 없어요.", "No stay booked for tonight.", "今夜の宿の予約はありません。"],
  "pouch.noNext": ["다가오는 이동편이 없어요.", "No upcoming rides.", "これからの移動はありません。"],
  "pouch.noFlight": ["다가오는 항공편이 없어요. 여행 도구 › {section}에서 항공편을 추가해 주세요.", "No upcoming flight. Add one in Trip kit › {section}.", "今後のフライトはありません。旅の道具 › {section}でフライトを追加してください。"],
  "pouch.flightNoTime": ["{date} {flight} 항공편의 출발 시각은 아직 저장되지 않았어요.", "The departure time for {flight} on {date} isn't saved yet.", "{date}の{flight}は出発時刻がまだ保存されていません。"],
  "pouch.flightDepart": ["{date} {flight} · {time} 출발이에요({zone} 시각).", "{flight} departs {date} at {time} ({zone} time).", "{date}の{flight}は{time}出発です（{zone}時刻）。"],
  "pouch.flightInternational": ["국제선이라 {arrive}까지 {airport}에 도착하면 여유 있어요.", "For this international flight, arrive at {airport} by {arrive} (2 hours early).", "国際線なので、{arrive}までに{airport}に着くと余裕があります。"],
  "pouch.flightDomestic": ["국내선이라 출발 1시간 전인 {arrive}까지 {airport}에 도착하면 여유 있어요.", "For this domestic flight, arrive at {airport} by {arrive} (1 hour early).", "国内線なので、出発1時間前の{arrive}までに{airport}に着くと余裕があります。"],
  "pouch.departureAirport": ["출발 공항", "departure airport", "出発空港"],
  "pouch.tomorrow": ["내일", "Tomorrow", "明日"],
  "pouch.noTomorrow": ["내일 일정이 아직 없어요.", "Nothing planned for tomorrow yet.", "明日の予定はまだありません。"],
  "pouch.anytime": ["시간 미정", "Any time", "時間未定"],
  "pouch.packHint": ["‘선크림 챙겨야 해’처럼 적으면 목록에 들어가요. 길게 누르면 지워요.", "Type “add sunscreen” to put it on the list. Press and hold to delete.", "「日焼け止め 追加」と書くとリストに入ります。長押しで削除。"],
  "pouch.packEmpty": ["아직 적은 준비물이 없어요.", "Nothing on the list yet.", "まだ持ち物がありません。"],
  "pouch.bookings": ["예약", "Bookings", "予約"],
  "pouch.story": ["기록", "Story", "記録"],
  "pouch.storySaved": ["기록 탭에 오늘 날짜로 남겼어요.", "Saved to Stories under today's date.", "記録タブに今日の日付で残しました。"],
  "pouch.todayEmpty": ["오늘 남긴 기록이 없어요. ‘기록: 바다가 예뻤다’처럼 적어 보세요.", "No notes today. Try “note: the sea was lovely”.", "今日の記録はまだありません。「日記: 海がきれい」と書いてみて。"],
  "pouch.unknown": ["아직 이 말은 몰라요. 이렇게 적어 보세요.", "I can't read that yet. Try one of these.", "まだ分かりません。こう書いてみてください。"],
  "receipt.button": ["영수증 사진으로 지출 적기", "Add an expense from a receipt photo", "レシートの写真から支出を記録"],
  "receipt.title": ["영수증 읽기", "Read a receipt", "レシートを読む"],
  "receipt.body": [
    "사진은 이 기기 안에서만 읽어요. 카메라 권한은 선택이라, 허용하지 않아도 앨범에서 고르거나 직접 적을 수 있어요.",
    "The photo is read only on this device. Camera access is optional: without it you can still choose from your library or type the expense.",
    "写真はこの端末の中だけで読み取ります。カメラの許可は任意で、許可しなくてもアルバムから選ぶか直接入力できます。",
  ],
  "receipt.camera": ["사진 찍기", "Take photo", "写真を撮る"],
  "receipt.library": ["앨범에서 고르기", "Choose from library", "アルバムから選ぶ"],
  "receipt.reading": ["영수증을 읽는 중…", "Reading the receipt…", "レシートを読み取り中…"],
  "receipt.failed": ["사진에서 글자를 읽지 못했어요. 지출 적기에서 직접 적어 주세요.", "Couldn't read text in the photo. Enter the expense yourself.", "写真の文字を読めませんでした。支出を直接入力してください。"],
  "receipt.denied": [
    "카메라를 허용해야 사진을 찍을 수 있어요. 설정 앱에서 바꿀 수 있고, 앨범에서 고르기는 권한 없이 쓸 수 있어요.",
    "Allow camera access in the Settings app to take photos. Choosing from your library works without any permission.",
    "写真を撮るにはカメラを許可してください。設定アプリで変更できます。アルバムから選ぶのは許可なしで使えます。",
  ],
  "receipt.unavailable": ["카메라나 사진을 열지 못했어요. 앨범에서 골라 보거나 직접 적어 주세요.", "Couldn't open the camera or photos. Try the library, or enter it yourself.", "カメラや写真を開けませんでした。アルバムから選ぶか、直接入力してください。"],
  "pouch.askJev": ["Jev로 다시 읽기", "Ask Jev to read it", "Jevで読み直す"],
  "pouch.jevNote": [
    "이 줄과 준비물 이름을 판단하려고 미국의 TypeSafe 서버로 보내요. 우리 서버에는 남기지 않아요.",
    "This line and your packing item names go to TypeSafe's servers in the US to be read. Our server keeps nothing.",
    "この行と持ち物の名前を、判断のためアメリカのTypeSafeのサーバーに送ります。私たちのサーバーには残しません。",
  ],
  "pouch.jevUnsure": ["Jev도 확실하지 않아요. 이렇게 적어 보세요.", "Jev isn't sure either. Try one of these.", "Jevにも分かりませんでした。こう書いてみてください。"],
  "pouch.suggestSpend": ["지출로 적을까요?", "Record this as an expense?", "支出として記録しますか？"],
  "pouch.noAmount": ["금액 미정", "No amount yet", "金額未定"],
  "pouch.suggestPacked": ["챙김으로 표시할까요?", "Mark as packed?", "準備済みにしますか？"],
  "pouch.suggestUnpacked": ["안 챙김으로 되돌릴까요?", "Mark as not packed?", "未準備に戻しますか？"],
  "pouch.markPacked": ["챙김으로 표시", "Mark packed", "準備済みにする"],
  "pouch.markUnpacked": ["안 챙김으로 표시", "Mark not packed", "未準備にする"],
  "pouch.whichItem": ["목록에서 어느 준비물인지 못 찾았어요.", "Couldn't tell which item you meant.", "どの持ち物か分かりませんでした。"],
  "pouch.suggestAdd": ["준비물에 넣을까요?", "Add to the packing list?", "持ち物に追加しますか？"],
  "pouch.add": ["준비물에 넣기", "Add to list", "持ち物に追加"],
  "pouch.suggestNote": ["기록으로 남길까요?", "Save it as a note?", "記録に残しますか？"],
  "pouch.saveNote": ["기록에 남기기", "Save note", "記録に残す"],
  "pouch.examples": ["커피 {money} · 우산 챙겼어 · 체크인 몇 시", "coffee {money} · packed umbrella · check-in", "コーヒー {money} · 傘 入れた · チェックイン"],

  "common.cancel": ["취소", "Cancel", "キャンセル"],
  "select.search": ["{label} 검색", "Search {label}", "{label}を検索"],
  "select.choose": ["선택", "Choose", "選択"],
  "select.placeholder": ["한글 이름 또는 영문 코드", "Name or code", "名前またはコード"],
  "select.none": ["검색 결과가 없어요. 도시의 영문 이름이나 통화 코드를 입력해 보세요.", "No matches. Try the city's English name or a currency code.", "見つかりません。都市の英語名か通貨コードを入れてください。"],
  "select.more": ["{n}개 중 12개 표시 · 검색어를 더 적어주세요.", "Showing 12 of {n} · Type more to narrow it down.", "{n}件中12件を表示・もう少し入力してください。"],
  "select.close": ["선택 닫기", "Close list", "リストを閉じる"],
  "common.close": ["닫기", "Close", "閉じる"],
  "common.back": ["돌아가기", "Back", "戻る"],
  "common.save": ["저장", "Save", "保存"],
  "common.toLibrary": ["여행 목록로", "Back to library", "本棚へ"],

  "settings.label": ["설정", "Settings", "設定"],
  "settings.language": ["언어", "Language", "言語"],
  "settings.titles": ["큰 제목은 영어로", "English headings", "大きな見出しは英語で"],
  "settings.account": ["계정", "Account", "アカウント"],
  "settings.backup": ["백업 파일", "Backup file", "バックアップファイル"],
  "settings.export": ["백업 파일 저장·공유", "Save or share a backup", "バックアップを保存・共有"],
  "settings.import": ["백업 파일 가져오기", "Import a backup", "バックアップを読み込む"],
  "settings.exportTitle": ["개인정보가 담긴 백업이에요", "This backup holds personal data", "個人情報を含むバックアップです"],
  "settings.exportBody": [
    "예약 기본정보와 여행 기록이 암호화되지 않은 파일로 나가요. 안전한 곳에 저장하세요.",
    "Reservation basics and trip notes go into an unencrypted file. Keep it somewhere safe.",
    "予約の基本情報と旅の記録が暗号化されないファイルで出力されます。安全な場所に保存してください。",
  ],
  "settings.makeFile": ["파일 만들기", "Create file", "ファイルを作成"],
  "settings.privacyNote": [
    "예약번호·QR·여권·출입 비밀번호는 입력하지 마세요. 지도 열기를 누르면 주소가 지도 서비스로 전달돼요. 환율을 조회하면 통화 코드 두 개와 IP 주소가 Frankfurter에 전달돼요.",
    "Don't enter booking numbers, QR codes, passport details or door codes. Opening a map sends the address to the map service. Checking a rate sends two currency codes and your IP address to Frankfurter.",
    "予約番号・QR・パスポート・暗証番号は入力しないでください。地図を開くと住所が地図サービスに送られます。為替レートを取得すると、2つの通貨コードとIPアドレスがFrankfurterに送られます。",
  ],
  "settings.version": ["버전", "Version", "バージョン"],

  "library.settings": ["설정", "Settings", "設定"],
  "library.search": ["여행 찾기", "Search trips", "旅行を探す"],
  "library.searchHint": ["여행 이름이나 여행지", "Trip or destination", "旅行名や旅行先"],
  "library.new": ["새 여행", "New trip", "新しい旅行"],
  "library.all": ["전체", "All", "すべて"],
  "library.past": ["지난 여행", "Past trips", "過去の旅"],
  "library.continue": ["이어보기", "Continue", "続きを見る"],
  "library.first": ["첫 여행 만들기", "Make your first trip", "最初の旅行を作る"],
  "library.firstHint": ["이름만 정해도 시작할 수 있어요.", "A name is all you need to start.", "名前だけで始められます。"],
  "library.noMatch": ["찾는 여행이 없어요.", "No trip matches.", "見つかりませんでした。"],
  "library.noPast": [
    "다 쓴 여행은 여행 메뉴에서 지난 여행으로 옮길 수 있어요.",
    "Move finished trips here from the trip menu.",
    "使い終わった旅行は旅行のメニューから移せます。",
  ],
  "library.traveling": ["여행 중", "Traveling", "旅行中"],
  "library.newCount": ["{n}개", "{n}", "{n}件"],
  "library.others": ["다른 여행", "Other trips", "ほかの旅行"],
  "library.finished": ["지난 여행", "Past trips", "過去の旅行"],

  "welcome.headline": ["계획부터 귀국까지,\n여행을 한곳에서", "From plan to home,\nyour trip in one place", "計画から帰国まで、\n旅をひとつに"],
  "welcome.skip": ["로그인 없이 둘러보기", "Look around without signing in", "ログインせずに見てみる"],
  "welcome.note": [
    "로그인하면 여행이 계정에 백업돼서, 기기를 바꿔도 이어서 쓸 수 있어요.",
    "Sign in to back up your trips and pick up on any device.",
    "ログインすると旅行がアカウントにバックアップされ、機種を変えても続けられます。",
  ],

  "today.more": ["나머지 {n}개", "{n} more", "ほか{n}件"],
  "today.spent": ["오늘 쓴 돈", "Spent today", "今日の出費"],
  "today.over": ["예산 넘음", "Over budget", "予算超過"],
  "today.noBudget": ["경비 탭에서 하루 예산을 정할 수 있어요.", "Set a daily budget in Money.", "費用タブで1日の予算を決められます。"],
  "today.flight": ["다음 비행", "Next flight", "次のフライト"],
  "today.journey": ["다음 이동", "Next journey", "次の移動"],
  "today.zones": ["출발은 {from} 시각, 도착은 {to} 시각", "Departs on {from} time, arrives on {to} time", "出発は{from}時間、到着は{to}時間"],

  "plan.add": ["일정 추가", "Add plan", "予定を追加"],
  "plan.today": ["오늘", "Today", "今日"],
  "plan.dayN": ["{n}일째", "Day {n}", "{n}日目"],
  "plan.dayA11y": ["{n}일째 {date}, 일정 {count}개", "Day {n}, {date}, {count} plans", "{n}日目 {date}、予定{count}件"],
  "plan.free": ["빈 시간 {d}", "Free {d}", "空き時間 {d}"],
  "plan.freeHint": ["길게 누르면 이 시각에 일정을 추가합니다.", "Long press to add a plan at this time.", "長押しするとこの時間に予定を追加します。"],
  "plan.until": ["출발까지 {d}", "{d} to departure", "出発まで{d}"],
  "plan.tight": ["빠듯", "Tight", "ぎりぎり"],
  "plan.overlap": ["{d} 겹침", "{d} overlap", "{d}重複"],
  "plan.booked": ["예약", "Booked", "予約"],

  "places.picked": ["맞춤 추천", "Picked", "おすすめ"],

  "cat.food": ["식비", "Food", "食費"],
  "cat.drink": ["카페", "Café", "カフェ"],
  "cat.transport": ["교통", "Transport", "交通"],
  "cat.admission": ["입장료", "Tickets", "入場料"],
  "cat.shopping": ["쇼핑", "Shopping", "買い物"],
  "cat.other": ["기타", "Other", "その他"],

  "money.alreadyPaid": ["미리 결제한 예약", "Paid in advance", "支払い済みの予約"],
  "money.perDay": ["하루 예산", "Per day", "1日の予算"],
  "money.days": ["{n}일 · {total}", "{n} days · {total}", "{n}日 · {total}"],
  "money.less": ["{name} 줄이기", "Less {name}", "{name}を減らす"],
  "money.more": ["{name} 늘리기", "More {name}", "{name}を増やす"],
  "money.default": ["기본값", "Default", "標準"],
  "money.even": ["똑같이", "Even", "均等"],
  "money.done": ["완료", "Done", "完了"],
  "money.saving": ["저장 중…", "Saving…", "保存中…"],
  "money.checkAmount": ["금액을 확인해 주세요.", "Check the amount.", "金額を確認してください。"],
  "money.saveError": ["저장하지 못했어요. 다시 시도해 주세요.", "Couldn't save. Try again.", "保存できませんでした。もう一度お試しください。"],

  "expense.new": ["새 지출", "New expense", "新しい支出"],
  "expense.edit": ["지출 고치기", "Edit expense", "支出を直す"],
  "expense.amount": ["금액", "Amount", "金額"],
  "expense.what": ["어디에", "What", "内容"],
  "expense.currency": ["통화", "Currency", "通貨"],
  "expense.rateLive": ["유럽중앙은행 기준가 · {date} · 참고용이라 고칠 수 있어요", "European Central Bank reference rate · {date} · for reference, you can edit it", "欧州中央銀行の参考レート・{date}・参考値なので修正できます"],
  "expense.rateLast": ["지난번에 쓴 환율 · 고칠 수 있어요", "The rate you used last time · you can edit it", "前回使ったレート・修正できます"],
  "expense.rateManual": ["이 통화는 환율을 직접 적어 주세요.", "Enter the rate for this currency yourself.", "この通貨はレートを入力してください。"],
  "expense.rateLoading": ["환율을 가져오는 중…", "Getting today's rate…", "レートを取得中…"],
  "expense.envelopeOver": ["{amount} 넘음", "{amount} over", "{amount}超過"],
  "expense.approx": ["약 {amount}", "≈ {amount}", "約{amount}"],
  "expense.envelope": ["{name} 봉투", "{name} envelope", "{name}の封筒"],
  "expense.envelopeLeft": ["{name} 봉투 남은 돈 {before}에서 {after}로", "{name} envelope left: {before} to {after}", "{name}の封筒の残り {before} → {after}"],
  "expense.rate": ["1 {from} = 몇 {to}?", "1 {from} = how many {to}?", "1 {from} = 何{to}?"],
  "expense.category": ["분류", "Category", "分類"],
  "expense.paidBy": ["결제", "Paid by", "支払い"],
  "expense.card": ["카드", "Card", "カード"],
  "expense.cash": ["현금", "Cash", "現金"],
  "expense.save": ["지출 저장", "Save", "保存"],
  "expense.currencyError": ["통화 코드를 확인해 주세요.", "Check the currency code.", "通貨コードを確認してください。"],
  "expense.checkError": [
    "내용, 0보다 큰 금액과 환율을 확인해 주세요.",
    "Check the description, an amount above 0 and the rate.",
    "内容、0より大きい金額、為替レートを確認してください。",
  ],
  "expense.saveError": [
    "저장하지 못했어요. 금액과 환율을 확인하고 다시 시도해 주세요.",
    "Couldn't save. Check the amount and rate, then try again.",
    "保存できませんでした。金額とレートを確認してもう一度お試しください。",
  ],

  "dur.hm": ["{h}시간 {m}분", "{h}h {m}m", "{h}時間{m}分"],
  "dur.h": ["{h}시간", "{h}h", "{h}時間"],
  "dur.m": ["{m}분", "{m}m", "{m}分"],

  "until.moving": ["이동 중", "On the way", "移動中"],
  "until.tomorrow": ["내일 출발", "Tomorrow", "明日出発"],
  "until.days": ["{n}일 뒤 출발", "In {n} days", "{n}日後に出発"],
  "until.today": ["오늘 출발", "Today", "今日出発"],
  "until.hm": ["{h}시간 {m}분 뒤", "In {h}h {m}m", "{h}時間{m}分後"],
  "until.h": ["{h}시간 뒤", "In {h}h", "{h}時間後"],
  "until.m": ["{m}분 뒤", "In {m}m", "{m}分後"],
  "until.soon": ["곧 출발", "Now", "まもなく"],
} as const satisfies Record<string, Entry>;

/** 화면별로 나눈 문구. 같은 키가 두 곳에 있으면 테스트가 잡는다. */
export const STRING_PARTS = [CORE, APP_STRINGS, ACCOUNT_STRINGS, RESERVATION_STRINGS, EDITOR_STRINGS, NOTEBOOK_STRINGS, LEGAL_STRINGS, PLACE_STRINGS, ROUTE_STRINGS, TODAY_STRINGS, PICK_STRINGS, CONV_B_STRINGS, AUTOFILL_STRINGS, ESCALE_STRINGS] as const;
export const STRINGS = { ...CORE, ...APP_STRINGS, ...ACCOUNT_STRINGS, ...RESERVATION_STRINGS, ...EDITOR_STRINGS, ...NOTEBOOK_STRINGS, ...LEGAL_STRINGS, ...PLACE_STRINGS, ...ROUTE_STRINGS, ...TODAY_STRINGS, ...PICK_STRINGS, ...CONV_B_STRINGS, ...AUTOFILL_STRINGS, ...ESCALE_STRINGS } satisfies Record<string, Entry>;

export type Key = keyof typeof STRINGS;

// 큰 제목: [한국어, English, 日本語]. 영어는 대문자로 쓴다.
export const TITLES = {
  today: ["오늘", "TODAY", "今日"],
  plan: ["계획", "PLAN", "予定"],
  wishlist: ["가고 싶은 곳", "WISHLIST", "行きたい所"],
  picks: ["추천", "PICKS", "おすすめ"],
  spent: ["경비", "SPENT", "費用"],
  budget: ["예산", "BUDGET", "予算"],
  stories: ["기록", "STORIES", "記録"],
  settings: ["설정", "SETTINGS", "設定"],
} as const satisfies Record<string, Entry>;

export type TitleKey = keyof typeof TITLES;

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  let text: string = STRINGS[key][INDEX[lang]];
  if (vars) for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value));
  return text;
}

export function bigTitle(lang: Lang, inEnglish: boolean, key: TitleKey): string {
  return TITLES[key][inEnglish ? 1 : INDEX[lang]];
}

/** 저장된 언어가 있으면 그것, 없으면 기기 언어 목록에서 처음 맞는 것, 그것도 없으면 한국어. */
export function resolveLang(saved: string | null | undefined, device: readonly (string | null | undefined)[]): Lang {
  // 기존 영어 설정은 미국 영어로 읽어 이전 설치와 호환한다.
  if (saved === "en") return "en-US";
  if (LANGS.some(item => item.code === saved)) return saved as Lang;
  for (const code of device) {
    const parts = code?.toLowerCase().split(/[-_]/) ?? [];
    const base = parts[0];
    if (base === "en") return parts.includes("gb") ? "en-GB" : "en-US";
    if (base === "ko" || base === "ja") return base;
  }
  return "ko";
}

const WEEK: Record<"ko" | "en" | "ja", readonly string[]> = {
  ko: ["일", "월", "화", "수", "목", "금", "토"],
  en: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
  ja: ["日", "月", "火", "水", "木", "金", "土"],
};
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** 2026-10-14 → "10월 14일 수요일" · "WED · OCT 14" · "10月14日(水)" */
export function formatDay(lang: Lang, iso: string): string {
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  const weekday = new Date(`${iso}T12:00:00Z`).getUTCDay();
  if (lang === "en-GB") return `${WEEK.en[weekday]} · ${day} ${MONTHS[month - 1]}`;
  if (lang === "en-US") return `${WEEK.en[weekday]} · ${MONTHS[month - 1]} ${day}`;
  if (lang === "ja") return `${month}月${day}日(${WEEK.ja[weekday]})`;
  return `${month}월 ${day}일 ${WEEK.ko[weekday]}요일`;
}

export type UntilValue = { kind: "moving" } | { kind: "days"; days: number } | { kind: "today" } | { kind: "soon"; hours: number; minutes: number };

/** 출발까지 남은 때를 언어에 맞는 짧은 문구로. */
export function formatUntil(lang: Lang, until: UntilValue): string {
  switch (until.kind) {
    case "moving":
      return translate(lang, "until.moving");
    case "today":
      return translate(lang, "until.today");
    case "days":
      return until.days === 1 ? translate(lang, "until.tomorrow") : translate(lang, "until.days", { n: until.days });
    case "soon":
      if (until.hours && until.minutes) return translate(lang, "until.hm", { h: until.hours, m: until.minutes });
      if (until.hours) return translate(lang, "until.h", { h: until.hours });
      if (until.minutes) return translate(lang, "until.m", { m: until.minutes });
      return translate(lang, "until.soon");
  }
}

/** 걸리는 시간(분)을 짧게. 150 → "2시간 30분" · "2h 30m" · "2時間30分" */
export function formatDuration(lang: Lang, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return translate(lang, "dur.hm", { h, m });
  return h ? translate(lang, "dur.h", { h }) : translate(lang, "dur.m", { m });
}

/** 2026-10-14 → "수" · "WED" · "水" */
export function weekdayShort(lang: Lang, iso: string): string {
  return WEEK[lang.startsWith("en-") ? "en" : lang as "ko" | "ja"][new Date(`${iso}T12:00:00Z`).getUTCDay()];
}

const MONTH_TITLE = MONTHS.map((m) => m[0] + m.slice(1).toLowerCase());

/** 여행 기간 한 줄. 2026-10-14~16 → "10월 14일 – 16일" · "Oct 14 – 16" · "14 – 16 Oct" · "10月14日〜16日" */
export function formatDateRange(lang: Lang, start: string, end: string): string {
  const [sm, sd] = [Number(start.slice(5, 7)), Number(start.slice(8, 10))];
  const [em, ed] = [Number(end.slice(5, 7)), Number(end.slice(8, 10))];
  const same = start === end, sameMonth = sm === em;
  if (lang === "en-US") return same ? `${MONTH_TITLE[sm - 1]} ${sd}` : sameMonth ? `${MONTH_TITLE[sm - 1]} ${sd} – ${ed}` : `${MONTH_TITLE[sm - 1]} ${sd} – ${MONTH_TITLE[em - 1]} ${ed}`;
  if (lang === "en-GB") return same ? `${sd} ${MONTH_TITLE[sm - 1]}` : sameMonth ? `${sd} – ${ed} ${MONTH_TITLE[sm - 1]}` : `${sd} ${MONTH_TITLE[sm - 1]} – ${ed} ${MONTH_TITLE[em - 1]}`;
  if (lang === "ja") return same ? `${sm}月${sd}日` : sameMonth ? `${sm}月${sd}日〜${ed}日` : `${sm}月${sd}日〜${em}月${ed}日`;
  return same ? `${sm}월 ${sd}일` : sameMonth ? `${sm}월 ${sd}일 – ${ed}일` : `${sm}월 ${sd}일 – ${em}월 ${ed}일`;
}
