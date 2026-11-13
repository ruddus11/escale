# Escale 스토어 개인정보 신고 초안

작성 기준: 2026-11-01 소스. 이 문서는 **모바일 출시 빌드**의 App Store Connect `App Privacy`와 Play Console `Data safety` 입력안이다. 실제 바이너리, 제공자 설정, 서버 로그·백업 계약, 스토어에 이미 배포된 판은 확인하지 않았다. Google·Kakao 로그인과 유료 AI 미리보기는 설정에 따라 달라진다. 스토어 제출 전에 아래 `확인 필요`를 해소한다. Apple과 Google의 [신고 기준](https://developer.apple.com/app-store/app-privacy-details/), [Play Console 정의](https://support.google.com/googleplay/android-developer/answer/10787469)를 적용했다.

**병렬 변경 주의:** 아래 캐시 설명은 이 작업트리의 현재 코드 기준이다. 별도 브랜치가 `api/place.ts`, `api/recommend-places.ts`, `server/security/responseCache.ts`, `server/security/costGuard.ts`의 캐시 열쇠·식별자 처리를 바꾸고 있다. 병합 뒤 원문/해시 보관, 계정·IP 연결 여부, 만료 삭제 시점을 최종 코드로 다시 확인해야 한다.

## 데이터 이동 근거

| SDK/API·기능 | 기기에서 나가는 정보와 수신자 | 근거·확인 필요 |
|---|---|---|
| Supabase Auth/DB (`@supabase/supabase-js`) | 로그인 시 이메일(Apple 가림 이메일 가능), 제공자 토큰, 사용자 ID·세션 → Supabase. 계정 사용 시 수첩 전체 `notebooks.payload`, 동의·권한·장소 이용 기록 → Supabase. 여행명·일정·예약·동행자 이름·경비·기록·스티커 글과 사진 스티커 **파일명** 포함 | `mobile/src/data/auth.ts`, `mobile/src/data/supabase.ts`, `mobile/src/data/useAccount.ts`, `mobile/src/data/model.ts`, `supabase/migrations/20261013000000_accounts.sql`, `supabase/migrations/20261015000000_consents.sql`, `supabase/migrations/20261016000000_place_search_usage.sql`. **확인 필요:** 실제 리전, 인증·DB 로그 및 백업 보관 기간 |
| Apple Sign in, Google/Kakao OAuth | 사용자가 고른 제공자에 인증 요청 후 코드를 Supabase 세션으로 교환. 기본 노출은 Apple·이메일, Google/Kakao는 `EXPO_PUBLIC_LOGIN_METHODS`에 있을 때 | `mobile/src/data/auth.ts:9-18,43-82,104-123`. **확인 필요:** 출시 빌드의 제공자 목록·각 제공자 자체 처리 |
| Vercel `/api` | 장소 검색어·장소 ID·숙소 주변 좌표, 추천 조건, 가린 예약문·여행 도구 문장, Bearer 토큰·IP → 앱 서버. 이 작업트리에서는 장소 검색 조건과 추천 조건(추천은 계정 ID 또는 IP 해시 포함)의 캐시 열쇠 및 결과를 메모리에 둠. 재사용 유효 기간은 5~30분이지만, 만료 즉시 삭제 타이머는 없어 항목은 다음 조회·용량 초과·인스턴스 종료 때까지 더 남을 수 있음 | `api/place.ts`, `api/recommend-places.ts`, `api/extract-reservation.ts`, `api/read-pouch.ts`, `server/security/responseCache.ts`, `server/security/costGuard.ts`. **확인 필요:** 배포 리전·접근 로그·캐시 운영 설정과 병합 뒤 캐시 열쇠·실제 삭제 시점. 캐시를 즉시 삭제로 신고하지 않음 |
| Google Places API·Maps SDK (`react-native-maps`) | 서버가 검색어·장소 ID·근처 좌표(약 100m 단위)를 Google Places에 보냄. 기기 지도 SDK는 지도 타일·상호작용에 따른 IP, 기기/SDK 정보, 고유 식별자, 오류 지표 등을 Google에 직접 보낼 수 있음. 사용자가 외부 Google Maps 링크를 열 수도 있음 | `server/places/googlePlaceLookup.ts`, `server/places/browsePlaces.ts`, `mobile/src/components/DayMap.tsx`, `mobile/src/data/placeBrowse.ts`, `mobile/src/screens/PicksPage.tsx`; [Google Maps SDK for Android 공개 자료](https://developers.google.com/maps/documentation/android-sdk/play-data-disclosure). **확인 필요:** 출시 iOS·Android SDK의 매니페스트/실제 전송, Google의 연결 여부와 목적 |
| TypeSafe AI (`@typesafe-ai/sdk`, 유료 기능 사용 시) | 추천 조건·Google 후보, 가린 예약문, 가린 문장과 준비물 이름 → 앱 서버 → TypeSafe. 기능별 별도 동의 뒤에만 요청 | `server/recommendations/recommendPlaces.ts`, `api/extract-reservation.ts`, `api/read-pouch.ts`, `mobile/src/legal/Legal.tsx`. **확인 필요:** 출시 유료 기능 비활성, 계약상 보관·학습 조건 |
| Frankfurter 환율 | 통화 코드 두 개와 네트워크 IP → Frankfurter. 수첩의 금액·사용자 ID는 요청에 넣지 않음 | `mobile/src/data/rates.ts:5-8,33-42` |
| Expo/React Native 로컬 기능 | `expo-image-picker`, `expo-file-system`, `expo-sqlite`, `expo-document-picker`, `expo-print`, `expo-sharing`, `expo-crypto`, `expo-clipboard`, `expo-font`, `expo-localization`, `expo-web-browser`, `expo-apple-authentication`, `expo-constants`, `expo-splash-screen`, `expo-status-bar`, `@react-native-community/datetimepicker`, `react-native-svg`, `react-native-safe-area-context`, `react-native-url-polyfill`, React/React Native. 사진 선택·저장·내보내기·암호 함수 등은 앱 코드에서 로컬 처리. 인증 브라우저와 사용자가 선택한 공유 대상은 별도 외부 전송 경로 | `mobile/package.json`, `mobile/src/data/dayPhotoStore.ts`, `mobile/src/data/supabase.ts`, `mobile/src/export/pdfBook.ts`. **확인 필요:** 포함된 네이티브 하위 SDK의 독립 진단 전송 |
| 웹 앱: React, Astryx UI, StyleX, Lucide, PWA | 웹 수첩은 IndexedDB, 실패 시 localStorage에 저장하고 개인 접근 코드도 localStorage에 보관. 웹 장소 조회는 위 Vercel/Google 경로로 전송. UI·아이콘·PWA 라이브러리 자체의 독립 전송은 소스에서 확인되지 않음 | `package.json`, `src/repositories/browserTripRepository.ts`, `src/services/accessToken.ts`, `src/services/placesClient.ts`. 모바일 스토어 신고와 웹 개인정보 고지의 범위를 혼동하지 않음 |

사진 선택기는 EXIF의 찍은 시각과 GPS를 읽어 기기 안에서 날짜·장소 스티커를 맞춘다. 사진 바이트와 그날의 장 배치 상태는 기기 폴더·설정에 남고 계정 백업에는 들어가지 않는다. 사진 스티커 파일명과 텍스트는 수첩 동기화에 포함될 수 있다. 앱은 기기의 현재 GPS 권한을 요청하지 않고, 지도에는 여행지·저장한 장소 좌표를 사용한다. 근거: `mobile/src/data/dayPhotoStore.ts`, `mobile/src/data/photoDays.ts`, `mobile/src/data/photoStickerStore.ts`, `mobile/src/data/stickers.ts`, `mobile/src/components/DayMap.tsx`. **확인 필요:** 선택기·내보내기·OS 사진 캐시의 실제 EXIF 포함 범위.

## Apple App Store Connect — App Privacy

`Data Used to Track You`: **No**. 광고·크로스 앱 추적 코드가 없고 `NSPrivacyTracking=false`이다 (`mobile/app.json`, `mobile/package.json`). **확인 필요:** Google 지도 SDK와 다른 포함 SDK의 실제 데이터 이용·최종 매니페스트.

| Data Type / 하위 항목 | Collected | Linked to User | Purpose | 근거·조건 |
|---|---|---|---|---|
| Contact Info / Email Address | Yes | Yes | App Functionality | 이메일 또는 Apple 인증. `mobile/src/data/auth.ts`, `mobile/app.json` |
| Identifiers / User ID | Yes | Yes | App Functionality | Supabase 계정·동기화·장소 사용량. `mobile/src/data/useAccount.ts`, `supabase/migrations/20261016000000_place_search_usage.sql` |
| User Content / Other User Content | Yes | Yes | App Functionality | 동기화 수첩의 자유 입력·일정·예약·동행자 이름·스티커와 선택 기능의 입력. `mobile/src/data/model.ts`, `mobile/src/data/useAccount.ts`, `mobile/src/data/stickers.ts` |
| Financial Info / Other Financial Info | Yes | Yes | App Functionality | 수첩 경비·분담·결제 방식. `src/domain/money/types.ts`, `mobile/src/data/useAccount.ts` |
| Search History / Search History 또는 Other User Content | **확인 필요** | 계정 사용 시 Yes 여부 확인 | App Functionality | 장소 검색어가 Vercel 메모리 캐시 열쇠에 쓰임. 재사용 유효 기간은 5~30분이나 실제 삭제는 늦을 수 있음. Apple 분류·계정 연결·로그 보관을 병합 뒤 확인. `api/place.ts`, `server/security/responseCache.ts` |
| Identifiers / Device ID, Diagnostics / Crash Data·Performance Data, Usage Data / Product Interaction, Other Data / Other Data Types | **지도 SDK 자료 대조 후 Yes 여부 확정** | **확인 필요** | App Functionality, SDK가 명시하면 Analytics | 과거 초안은 이 항목을 Yes로 기재. iOS SDK 매니페스트와 출시 버전 재확인. `docs/legal/LEGAL-CHECKLIST.md:96-112`, `mobile/src/components/DayMap.tsx`, `mobile/app.json` |
| Location / Precise Location·Coarse Location | **확인 필요** | **확인 필요** | App Functionality | 앱은 현재 위치 권한을 쓰지 않음. 사진 EXIF GPS는 로컬 분석, 장소·숙소 좌표는 서버/Google로 전송. 사진 GPS가 외부로 새는 경로 및 SDK의 IP 기반 위치 분류 검증. `mobile/src/data/photoDays.ts`, `server/places/browsePlaces.ts`, `mobile/src/components/DayMap.tsx` |
| User Content / Photos or Videos | 현재 코드상 **No** | — | — | 선택 사진 바이트는 기기 전용. 사진 파일명은 Other User Content에 포함. 원본의 클라우드 사진 선택기·사용자 내보내기·SDK 자체 전송은 별도 확인. `mobile/src/data/dayPhotoStore.ts`, `mobile/src/data/photoStickerStore.ts`, `mobile/src/data/useAccount.ts` |

`Contacts`(주소록), `Health & Fitness`, `Purchases` 및 광고 데이터 수집은 코드에서 확인되지 않는다 (`mobile/package.json`, `mobile/src/data/model.ts`). `Privacy Policy URL`은 공개 HTTPS 방침 주소를 넣는다. 실제 주소는 다른 작업의 공개 페이지 완료 후 확인한다 (`docs/legal/LEGAL-CHECKLIST.md:53-57`). iOS `NSPrivacyCollectedDataTypes`는 이메일·ID·기타 사용자 콘텐츠만 선언하므로 경비·SDK 항목과 대조해야 한다 (`mobile/app.json:19-65`).

## Google Play Console — Data safety

`Does your app collect or share any of the required user data types?`: **Yes**. Play의 `Collected`는 앱 또는 SDK가 기기 밖으로 보낸 정보도 포함하며, 메모리에 요청 후 남는 캐시는 `processed ephemerally`로 단정하지 않는다. `Shared`는 제공자 계약과 SDK의 독립 목적을 확인해야 한다 ([Play Console 정의](https://support.google.com/googleplay/android-developer/answer/10787469), `server/security/responseCache.ts`).

| Data type / 하위 항목 | Collected | Required or optional | Purpose | Shared 및 근거 |
|---|---|---|---|---|
| Personal info / Email address, User IDs | Yes | Optional: 로그인 없이 기기 사용 가능 | App functionality, Account management | Supabase·선택 OAuth. 수탁자 예외 적용 계약 확인. `mobile/src/data/auth.ts`, `mobile/src/data/useAccount.ts` |
| Personal info / Name | Yes, 사용자가 동행자 이름을 적고 로그인하면 | Optional | App functionality | 수첩 동기화. `src/domain/workspace/types.ts`, `mobile/src/data/useAccount.ts` |
| Financial info / Other financial info | Yes, 경비를 적고 로그인하면 | Optional | App functionality | 수첩 동기화. `src/domain/money/types.ts`, `mobile/src/data/useAccount.ts` |
| App activity / Other user-generated content | Yes | Optional | App functionality | 수첩 메모·예약·스티커 글, AI를 켠 경우 가린 문장. `mobile/src/data/model.ts`, `mobile/src/data/useAccount.ts`, `api/extract-reservation.ts` |
| App activity / In-app search history | Yes, 장소 검색 시 | Optional | App functionality | Vercel 캐시와 Google Places. `api/place.ts`, `server/security/responseCache.ts`, `server/places/googlePlaceLookup.ts` |
| Location / Approximate location 또는 Precise location | **확인 필요** | Optional | App functionality | 현재 GPS 수집 없음. 장소 좌표·사진 EXIF·IP 기반 위치의 분류를 실제 전송과 대조. `mobile/src/data/photoDays.ts`, `mobile/src/components/DayMap.tsx`, `server/places/browsePlaces.ts` |
| Device or other IDs, App info and performance / Crash logs·Diagnostics, App activity / App interactions | **지도 SDK 공개 자료상 Yes 후보** | 지도를 쓰면 SDK 자동 전송 가능 | App functionality, Analytics 여부 확인 | Google Maps SDK는 기기/SDK 정보·식별자·스택 추적·IP를 자동 수집하고 지도 상호작용을 조건부 수집한다고 공개. `mobile/src/components/DayMap.tsx`, [Google SDK 자료](https://developers.google.com/maps/documentation/android-sdk/play-data-disclosure) |
| Photos and videos / Photos | 현재 코드상 No | — | — | 원본·사본은 기기에만 저장. `mobile/src/data/dayPhotoStore.ts`, `mobile/src/data/photoStickerStore.ts` |

`Is all of the user data collected by your app encrypted in transit?`: **코드상 HTTPS 경로이나 최종 확인 필요**. Supabase, Frankfurter, Google Places와 설정된 앱 API URL의 실제 빌드·외부 SDK 전송을 확인한 뒤 Yes를 선택한다 (`mobile/src/data/rates.ts`, `mobile/src/data/supabase.ts`, `mobile/src/data/placeBrowse.ts`, `server/places/googlePlaceLookup.ts`). `Can users request that their data be deleted?`: **Yes, 계정 데이터**. 설정에서 탈퇴하면 `/api/delete-account`가 Supabase Auth와 FK 연결 수첩·동의·사용 기록을 삭제한다. 기기 수첩은 탈퇴 뒤 남을 수 있고, 서버 캐시·로그·공급자 백업의 제거 시점은 미확인이다 (`mobile/src/screens/Account.tsx:97-100,135-148`, `api/delete-account.ts`, `mobile/src/data/useAccount.ts:394-404`, `server/security/responseCache.ts`). Play의 계정 삭제 요청용 공개 웹 URL은 다른 작업의 페이지가 실제 배포된 뒤 입력한다.

`Shared`: Google Maps SDK가 자체 서비스 개선 목적으로 직접 전송하는 데이터는 Yes 후보로 보수적으로 검토한다. Supabase·Vercel·TypeSafe의 수탁자 예외와 Google Places의 사용자 요청 예외는 계약·실제 사용 방식 확인 전 확정하지 않는다 ([Play Console 정의](https://support.google.com/googleplay/android-developer/answer/10787469), `mobile/src/components/DayMap.tsx`, `server/recommendations/recommendPlaces.ts`). 앱 자체 광고·분석·Crashlytics/Sentry 호출은 선언된 의존성 및 소스에서 확인되지 않지만 Google 지도 SDK 진단 수집은 별도로 신고한다 (`mobile/package.json`, `mobile/src/components/DayMap.tsx`).
