// 위쪽 탭 4칸. 일정 칸 안에 오늘·전체 일정·교통편 화면이 있다.
export type NotebookTab = "plan" | "places" | "budget" | "bookings";

export type AppScreen =
  | "today"
  | "schedule"
  | "transit"
  | "places"
  | "budget"
  | "bookings"
  | "covers"
  | "new-trip"
  | "trip-settings";

const appScreens: readonly AppScreen[] = [
  "today",
  "schedule",
  "transit",
  "places",
  "budget",
  "bookings",
  "covers",
  "new-trip",
  "trip-settings",
];

// 예전 하단 탭 주소로 저장된 북마크·홈 화면 바로가기를 그대로 연다.
const legacyAliases: Record<string, AppScreen> = { info: "bookings" };

export function isAppScreen(value: string): value is AppScreen {
  return appScreens.includes(value as AppScreen);
}

export function screenFromHash(hash: string): AppScreen {
  const candidate = hash.replace(/^#/, "");
  if (isAppScreen(candidate)) return candidate;
  return legacyAliases[candidate] ?? "today";
}

/** 화면이 속한 탭. 표지와 수첩 양식은 탭 밖이라 null. */
export function tabForScreen(screen: AppScreen): NotebookTab | null {
  switch (screen) {
    case "today":
    case "schedule":
    case "transit":
      return "plan";
    case "places":
    case "budget":
    case "bookings":
      return screen;
    default:
      return null;
  }
}

export function screenForTab(tab: NotebookTab): AppScreen {
  return tab === "plan" ? "today" : tab;
}
