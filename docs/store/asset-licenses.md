# Escale 자산 출처와 사용권 증거

2026-11-01 저장소 기준. 이 목록은 파일의 출처 기록과 패키지 메타데이터를 대조한 결과다. `확인 필요`는 소스만으로 원본 제작 이력이나 제3자 이용 조건을 입증할 수 없다는 뜻이다. 스토어 스크린샷·사용자 사진은 실제 배포 자료와 별도로 대조한다.

| 자산 | 출처·권리 근거 | 상태와 사용처 |
|---|---|---|
| `mobile/assets/fonts/NanumMyeongjo-Regular.ttf` | NHN/Naver Nanum Myeongjo. 번들 `mobile/assets/fonts/NanumMyeongjo-OFL.txt`에 저작권 표시와 SIL OFL 1.1 원문 있음 | 사용권 확인. `mobile/App.tsx`에서 BookSerif로 로드. OFL 원문 유지 |
| UnifrakturMaguntia 글꼴 | `mobile/node_modules/@expo-google-fonts/unifrakturmaguntia/package.json`은 `MIT AND OFL-1.1`, 패키지 README는 코드 MIT·글꼴 개별 라이선스 확인을 안내 | 사용권 근거 있음. `mobile/src/theme/tokens.ts`의 워드마크 글꼴. **확인 필요:** 배포 글꼴 파일의 OFL 저작권/예약 이름 고지 원문을 보관 |
| iOS/Android 시스템 글꼴 및 웹 시스템 글꼴 | OS 제공 글꼴; 웹 스택 `src/styles/base.css`, 모바일 기본 React Native 글꼴 | 별도 번들 글꼴 파일 없음. OS 이용 조건 적용 |
| Lucide 웹 아이콘 | `node_modules/lucide-react/package.json`의 ISC, `package.json`의 `lucide-react` | 사용권 근거 있음. `src/features/schedule/ScheduleScreen.tsx` 등 |
| 모바일 선 아이콘·도장·스티커 도형 | 앱 안의 경로와 모양 코드: `mobile/src/theme/mono.tsx`, `mobile/src/components/PlaceSticker.tsx`, `mobile/src/components/PhotoSticker.tsx`, `mobile/src/data/stickers.ts`, `mobile/src/export/pdfBook.ts`. SVG 렌더러 `react-native-svg`는 `mobile/node_modules/react-native-svg/package.json`의 MIT | 코드로 그린 앱 자체 도형. **확인 필요:** 원안 제작 기록과 외부 도안 참조 여부. 사용자 사진 스티커는 사용자 선택 이미지이므로 저장소 배포 자산이 아님 |
| 서재 표지 16종과 안쪽 SVG 16종 | `mobile/src/data/libraryCovers.ts`의 코드 도안. `docs/design/library-editions.md`는 새 벡터 표지 제작과 `docs/design/library-covers/*.svg` 32개 비교판을 기록 | 앱 자체 제작 기록 있음. **확인 필요:** 원본 편집 이력 보관. 비교 SVG는 앱 런타임에서 직접 로드하지 않음 |
| 이전 표지 JPEG 13개 | `mobile/assets/covers/*.jpg`. `docs/design/material-notebook-covers.md`는 생성 원본을 JPEG로 인코딩했고 원본은 저장소 밖에 있다고 기록. `docs/design/library-editions.md`는 구형 래스터를 비교 자료로 보존한다고 기록 | **확인 필요:** 생성 서비스·입력 원본·상업적 이용 조건, 실제 출시 번들에 불포함인지 재검증. 파일별 원본 증거는 저장소에 없음 |
| 웰컴 바다·질감 | `mobile/assets/welcome-sea.jpg`, `mobile/assets/grain.png`. `docs/legal/LEGAL-CHECKLIST.md:92-94`는 직접 그린 그림·코드로 제작했다고 기록 | 자체 제작 주장 기록 있음. **확인 필요:** 원본 파일·제작 이력. `mobile/src/screens/Welcome.tsx`, `mobile/src/theme/mono.tsx`에서 사용 |
| 모바일 로고·런처·스플래시 | `mobile/assets/app-icon.svg`, `mobile/assets/app-icon.png`, `mobile/assets/adaptive-icon.png`, `mobile/assets/splash-icon.png`, `mobile/assets/brand/margin-traveler*.svg/png`. `mobile/README.md`의 벡터 원본 기록, `mobile/app.json`의 실제 참조 | 앱 자체 제작 기록 있음. **확인 필요:** 래스터 파생 관계·원본 제작 이력 |
| 웹 PWA·파비콘 | `public/icon-source.svg`, `public/pwa-64x64.png`, `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon-512x512.png`, `public/apple-touch-icon-180x180.png`, `public/favicon.ico`. `package.json`의 `generate:pwa-assets` 스크립트가 SVG에서 파생 자산을 생성 | 앱 자체 원본 추정. **확인 필요:** SVG와 각 PNG/ICO의 실제 생성 이력·권리자 |
| 디자인 참고 이미지 2개 | `docs/design/today-light-reference.png`, `docs/design/travel-notebook-concept-v1.png` | **출처·라이선스 미상.** 제품 번들에서 참조 없음. 외부 공개 자료에 포함하기 전 권리 확인 |
| 디자인 화면 캡처 8개 | `docs/design/screenshots/*.png` | 내부 UI 캡처로 보이나 파일별 촬영자·포함된 제3자 사진 권리 **미확인**. 출시 홍보 이미지로 재사용 전 화면 내용을 검토 |
| Google 장소 사진·지도 타일 | 앱 저장소에 파일 없음. `server/places/browsePlaces.ts`가 제공자 표기를 전달하고 추천 탭(`mobile/src/screens/PicksPage.tsx`)과 장소 검색이 장소 이름·주소에 `GoogleMapsAttribution` 출처를 붙여 표시. 현재 앱 화면은 장소 사진을 보이지 않음(사진을 보이던 예전 둘러보기 화면은 2026-11-01에 지움) | Google Maps Platform 제공 콘텐츠. **확인 필요:** 출시 기기에서 제공자 표기, 사진 캐시/재사용, 현재 약관 준수. 사용권을 앱 자체 자산으로 표시하지 않음 |
| 사용자가 고른 사진·내보낸 PDF | `mobile/src/data/dayPhotoStore.ts`, `mobile/src/data/photoStickerStore.ts`, `mobile/src/export/pdfBook.ts` | 사용자가 제공·생성한 내용. 앱 배포 자산 사용권 목록 밖이며 공유 상대에 따라 사용자가 권리를 확인해야 함 |

앱의 오픈소스 패키지 고지는 `mobile/src/legal/licenses.json`과 `mobile/src/legal/Licenses.tsx`, 네이티브 고지는 `mobile/scripts/native-licenses/*.txt`에서 제공한다. 이 문서는 글꼴·아이콘·그림의 **출처와 사용권 증거**에 집중한다. 패키지 판을 바꾸거나 스토어 캡처에 외부 장소 사진을 넣으면 해당 판의 라이선스와 콘텐츠 조건을 다시 대조한다.
