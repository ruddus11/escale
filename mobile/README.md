# Escale 모바일

계획을 실행하고, 여행 경비를 정산하고, 성공적으로 마친 여행을 여권 도장으로 남기는 Expo 앱이다. 여행 전에는 준비, 여행 중에는 다음 일정과 남은 돈을 확인하기 위해 다시 연다.

## 현재 구현

- **계획:** 시간표·월간/주간 캘린더·지도·예약이 하나의 선택 날짜를 공유한다. 시간 미정 일정만 모아 볼 수 있다.
- **오늘:** 다음 일정·길찾기·날씨·환율·오늘 지출과 기존 JEV 안내를 연결한다. 외부 정보 실패는 화면에 표시한다.
- **돈:** 예산·기간 내/밖 지출·현지 통화·영수증 초안·로컬 동행자 분담·정산 완료/취소 기록을 제공한다. 앱에서 실제 송금하지 않는다.
- **여권:** 귀국일 당일부터 성공 완료를 확인하면 국가별 도장을 한 번 발급한다. 취소한 여행은 제외한다. 기존 도장은 보존한다.
- 계정 없이 로컬 SQLite에 저장한다. 예전 일기 화면은 제거했지만 저장된 데이터·백업 호환·DB 마이그레이션은 유지한다.

초대·공동 편집·댓글·공유 앨범은 Stage 2, JEV 초안 적용/되돌리기·코스·위치 공유·멤버십 확장은 Stage 3 계획이다. [진행보고](../docs/구현_진행보고_escale.md)에서 구현과 미검증 항목을 확인한다.

## 실행

저장소 루트와 `mobile/` 양쪽 의존성이 필요하다. 기존 lockfile을 사용한다.

```sh
npm ci
cd mobile
npm ci
cp .env.example .env
npm start
```

네이티브 앱 실행:

```sh
cd mobile
npm run ios
# 또는
npm run android
```

iOS는 Xcode, Android는 Android SDK·에뮬레이터가 필요하다. 영수증 인식 등 `modules/`의 네이티브 기능은 Expo Go 대신 개발 빌드에서 확인한다. 네이티브 모듈·플러그인·지도 키 변경 후 재빌드한다.

## 환경 변수

로컬 여행·일정·돈·정산·여권은 로그인 없이 사용할 수 있다. 실시간 API에는 해당 서버 설정이 필요하다. 장소 검색·좌표 조회는 로그인 없이 `/api/guest-place`를 사용하고, 로그인한 경우 기존 `/api/place`를 사용한다. 새 손님 경로는 서버에도 반영되어 있어야 한다. 비밀키는 앱에 넣지 않는다.

| 변수 | 용도 |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | 기존 여행 API 서버 |
| `EXPO_PUBLIC_SUPABASE_URL` | 선택적 계정·개인 백업 서버 |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개 클라이언트 키. 서버 RLS 필요 |
| `EXPO_PUBLIC_LOGIN_METHODS` | 설정이 완료된 로그인 제공자만 노출 |
| `EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY` | 선택적 iOS Google 지도 키. 번들 ID/API 제한 필요 |
| `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` | Android 지도 키. 패키지명·서명 제한 필요. 없으면 지도 대신 장소 목록 표시 |
| `EXPO_PUBLIC_PAID_PREVIEW` | 내부 시험 전용. 출시 빌드에서는 비워 둔다 |

`GOOGLE_MAPS_API_KEY`, `TYPESAFE_API_KEY`, `TRANSIT_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` 같은 서버 비밀키를 `EXPO_PUBLIC_*`에 넣지 않는다.

손님용 장소 조회 기본 한도는 IP별 분당 12회·하루 80회, 서비스 전체 하루 600회다. 서버의 `API_LIMIT_GUEST_PLACE_PER_MINUTE`, `API_LIMIT_GUEST_PLACE_PER_DAY`, `API_LIMIT_GUEST_PLACE_GLOBAL_PER_DAY`로 조정한다. 한도가 끝나면 수기 장소 입력과 외부 지도 길찾기를 사용할 수 있다. 서버 전체 비용 제한 저장소 설정도 기존 정책을 따른다.

## 폴더 구조와 설계 이유

- `App.tsx`: 여행 선택·탭·공유 날짜·편집 흐름 연결.
- `src/screens/`: 여행 생성·계획·오늘·돈·여권 및 기존 편집기.
- `src/components/`: 검색·지도·예약·공통 기능 컴포넌트.
- `src/data/`: 로컬 모델·저장·날짜별 일정·정산 화면·여권 발급 로직.
- `src/theme/`, `src/i18n/`: 기존 공통 UI 체계와 한국어·영어·일본어 문자열.
- `../src/domain/`: 모바일과 웹이 공유하는 돈·여행·예약 계산.
- `modules/`: 영수증 등 로컬 네이티브 기능.
- `tests/`: Vitest 도메인 검증.

여행/돈 도메인을 재사용해 계산·저장 경로를 중복 구현하지 않는다. 여권은 `passport:v1` 설정에 별도 저장하며, 읽기 성공 전 쓰기와 겹치는 쓰기를 차단한다. 저장 성공 뒤에만 도장과 알림을 노출한다. 실제 스탬프 이미지는 아직 없으며 49개 국가·지역별 SVG placeholder를 쓴다. [이미지 요청서](../docs/design/필요한_이미지_에셋.md)에 소유자용 생성 프롬프트가 있다.

## 검증

```sh
cd mobile
npm run typecheck
npm test
npm run check:bundle
```

현재 자동 검사 결과와 시뮬레이터 인수 기록은 [진행보고](../docs/구현_진행보고_escale.md)를 따른다. 번들 export 성공을 네이티브 실행·실기기·배포 검증으로 간주하지 않는다. 영수증 카메라 인식·외부 API·Android 실기기는 별도 확인이 필요하다.

## 개발 예시 데이터

개발 빌드에서만 `escale://dev/sample`이 예시 여행을 추가한다. 예시 ID에 해당하는 여행을 갱신하며 다른 여행은 보존한다. 실제 사용자 여행과 예시를 혼동하지 않는다. 여행 탭은 `escale://trip?tab=plan` 등으로 열 수 있고 기존 `margin` scheme도 유지한다. 앱 이름은 Escale, bundle ID는 `com.travelpouch.notebook`으로 유지한다.

## 다음 작업

Stage 1 인수 검증과 캡처를 마치고 남은 결함을 수정한다. 시각 디자인은 소유자가 별도로 진행하며 기능 구현에서 restyle하지 않는다. Stage 1 완료 전 협업 기능을 확장하지 않는다. [통합 설계](../docs/design/Escale_통합_설계.md)와 [F-id 진행보고](../docs/구현_진행보고_escale.md)가 현재 기준이다.

