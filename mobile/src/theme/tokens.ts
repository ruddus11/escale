import type { TextStyle } from "react-native";
import type { ExpenseCategory } from "../../../src/domain/workspace/types";

// 바탕은 흰색·옅은 회색. 딥 틸은 선택 상태와 주요 버튼에, 산호는 오늘 표시 같은 작은 점에만 쓴다. 민트는 쓰지 않는다.
const sea = "#103A45";
const teal = "#0F5560";
const whitewash = "#FFFFFF";
const card = "#F7F8FA";
const deep = "#E8EBEF";
export const mono = {
  bg: whitewash, ink: "#252830", onInk: whitewash,
  gray: "#626873", mutedText: "#686E78", soft: "#D5D9E0",
  hair: "rgba(37,40,48,0.08)", rule: "rgba(37,40,48,0.16)",
  track: "rgba(37,40,48,0.08)", frost: "rgba(255,255,255,0.97)",
  scrim: "rgba(0,0,0,0.4)", white: "#FFFFFF", veil: "rgba(0,0,0,0.55)",
  whiteHair: "rgba(255,255,255,0.45)", warn: "#B33D46",
  accent: teal, accentText: teal, accentSoft: "#EDF2F3",
  /** 작은 점·배지에만. 글자에는 coralText를 쓴다. */
  coral: "#E0664F", coralText: "#B4472F",
  /** 표지 사진 위 상태 칩. 위에 올리는 글자는 sea(5:1). */
  coralChip: "#EE9A8F", sea,
  /** 표지 사진 아래쪽 띠. 흰 글자를 올린다. */
  heroVeil: "rgba(11,44,53,0.82)",
  /** 표지 띠 위 보조 글자. */
  onSea: "#E3ECEB",
  /** 사진 없는 표지의 돛 표시. 바다색 위에서 한 단계만 밝다. */
  heroMark: "#1E5562",
  /** 여권 표지 안쪽 눌러 찍은 테두리와 칸 나눔. */
  coverRule: "rgba(244,238,227,0.28)",
  /** 여권 표지의 금박 글자와 문장. 가죽 사진(assets/passport/cover.jpg)의 가장 밝은 결 #245C68 위에서 4.5:1 이상. */
  foil: "#E2C88F",
  /** 금박 테두리처럼 옅게 누른 선. */
  foilRule: "rgba(226,200,143,0.45)",
  /** 사증 면 종이(assets/passport/visa-page.jpg)의 평균 바탕색. 도장 마모 반점을 이 색으로 칠해 잉크가 덜 묻은 곳처럼 보이게 한다. */
  visaPaper: "#E4DFD3",
  /** 사증 면 위 보조 글자(도장 아래 여행 이름, 쪽 번호). 회색 gray는 이 종이에서 4.5:1이 안 된다. */
  visaMuted: "#4C5059",
};

// 모서리. 2026-11-13 시안에 맞춰 각지게 줄였다. 카드·버튼·입력·날짜 칸 8, 칩 6. 알약 모양은 쓰지 않는다.
export const radius = { card: 8, control: 8, pill: 6 } as const;
export const diary = {
  paper: whitewash, page: whitewash, surface: card, inset: deep,
  silver: "#E5E8EC", edge: "#E5E8EC",
  radius: 8,
};

// 글자를 올리는 바탕 전체. 대비 검사(tests/contrast.test.ts)가 이 목록을 돈다. 사진 테두리 흰색은 글자 바탕이 아니다.
export const textBackgrounds = { bg: mono.bg, card: diary.surface } as const;

// 장소 스티커와 PDF의 두 색. 스티커는 바다 위에 붙인 인쇄물이라 크림 종이에 바다색 잉크로 찍는다. 반전은 두 색을 바꾼다.
export const stickerTone = {
  paper: "#F6F3EC",
  ink: "#103A45",
};

// 외부 로그인 제공자 버튼에만 쓰는 원래의 브랜드 색. 제공자 규정이라 팔레트 통일의 예외로 둔다.
export const authProviderColors = {
  apple: { background: "#000000", foreground: "#FFFFFF" },
  kakao: { background: "#FEE500", foreground: "#191919" },
  google: { background: "#FFFFFF", foreground: "#1F1F1F", border: "#D6D3CB" },
} as const;

// Google 지도 출처 표시는 규정 색 #5E5E5E를 지킨다. 어두운 바다 위에서는 읽히지 않아 크림 쪽지 위에 둔다.
export const mapAttribution = { text: "#5E5E5E", plate: "#F6F3EC" } as const;

// 붙이는 재료의 색. 이름은 예전 키치 팔레트에서 왔고, 2026-11-12 지중해 팔레트로 값을 바꿨다.
// pink = 산호(로고의 노을, 소인과 날짜 메모 글자, 바다 위 5.6:1), blue = 깊은 바다(어두운 표지),
// tape = 모래(테이프·표지), spine = 테라코타 지붕(책등·선반), lime = 밝은 모래(티켓 스티커), blush = 물빛 면(사진 자리·고른 칸), photo = 인화지.
export const scrapbook = { pink: "#A64F43", lime: "#E9DCC0", blue: deep, tape: "#DCC195", blush: card, spine: "#B8643F", photo: "#FFFDFA" } as const;

// 글자 역할. 화면마다 크기·굵기를 고르지 않고 역할을 고른다(근거: .lazyweb/design-research/mobile-hierarchy-2026-10-16).
// 위계는 display > pageTitle > sectionTitle > itemTitle > meta·label 네 단계로 읽힌다.
// 묶음 제목(21/600)과 목록 이름(17/500)은 크기와 굵기를 함께 달리해 한눈에 갈리게 한다. 굵기는 600까지만 쓴다.
export const textRole = {
  /** 수첩 이름과 장 제목. 화면마다 하나만 둔다. */
  display: { fontFamily: undefined, fontSize: 25, lineHeight: 33, fontWeight: "600" },
  /** 화면에서 먼저 읽힐 숫자나 이름 하나: 다음 이동 시각, 오늘 쓴 돈. */
  feature: { fontSize: 32, lineHeight: 38, fontWeight: "600", fontVariant: ["tabular-nums"] },
  /** 화면 이름, 예약·대표 수첩 이름. */
  pageTitle: { fontSize: 20, lineHeight: 27, fontWeight: "600" },
  /** 화면 안의 묶음 제목. 밑줄·대문자 자간을 붙이지 않는다. */
  sectionTitle: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
  /** 장소명, 예약명, 금액처럼 목록 한 줄의 이름. 묶음 제목보다 한 단계 가볍다. */
  itemTitle: { fontSize: 15, lineHeight: 22, fontWeight: "500" },
  /** 기록, 입력, 설명. */
  body: { fontSize: 15, lineHeight: 23, fontWeight: "400" },
  /** 날짜, 주소, 현지 시간대처럼 읽어야 하는 보조 정보. 작게 줄이지 않는다. */
  meta: { fontSize: 13, lineHeight: 20, fontWeight: "400" },
  /** 버튼과 선택. */
  control: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  /** 칸 이름과 개수처럼 짧은 이름표(iOS 각주 크기). 꼭 읽어야 하는 정보에는 쓰지 않는다. */
  label: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  /** 사진 출처처럼 제공자가 요구하는 고지에만. */
  attribution: { fontSize: 12, lineHeight: 17, fontWeight: "400" },
} as const satisfies Record<string, TextStyle>;

// 글자로 된 행동은 두 가지뿐이다. 밑줄·화살표를 붙이지 않고 색과 굵기로만 구분한다.
// inline은 "넣기·예약 추가·모두 보기"처럼 앞으로 가는 행동, dismiss는 "닫기·건너뛰기"처럼 물러나는 행동.
export const actionText = {
  inline: { ...textRole.control, color: mono.ink },
  dismiss: { ...textRole.meta, color: mono.gray },
  danger: { ...textRole.control, color: mono.warn },
} as const satisfies Record<string, TextStyle>;

// 세로 간격(pt). 묶음 사이를 묶음 안보다 세 배 띄워 어디서 묶음이 바뀌는지 보이게 한다.
// 예: 개요에서 "첫 장 채우기"와 "가고 싶은 곳" 사이 36, 제목과 첫 줄 사이 12.
export const space = {
  gutter: 18,
  section: 22,
  group: 12,
  touch: 44,
} as const;

// 테두리 두께(pt). 버튼·입력·카드는 1, 고른 상태가 보여야 하는 선택 칩(Chip·Choices)과 아이콘 버튼 테두리만 1.5.
export const stroke = {
  button: 1,
  chip: 1.5,
} as const;

// 경비 분류는 회벽에서 바다로 내려가는 단계로 나눈다. 바탕에 가까운 두 단계는 테두리를 둘러 구분한다.
export const categoryTone: Record<ExpenseCategory, { fill: string; edge: boolean }> = {
  food: { fill: whitewash, edge: false },
  drink: { fill: "#C6D6D3", edge: false },
  transport: { fill: "#8FAEAD", edge: false },
  admission: { fill: "#5D8389", edge: false },
  shopping: { fill: "#2A5A66", edge: true },
  other: { fill: sea, edge: true },
};
