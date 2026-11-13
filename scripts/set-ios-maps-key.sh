#!/bin/bash
# 아이폰용 Google 지도 키를 mobile/.env에 넣는다(깃에 올라가지 않는 파일).
# - 키는 이 터미널에 붙여넣기로만 받고, 형식이 맞는지 확인한 뒤 저장한다.
# - 이 키는 앱 안에 들어가는 공개용 키다. Google Cloud에서 "iOS 앱" 제한(번들 ID)과
#   "Maps SDK for iOS" API 제한을 꼭 걸어 둔다. 서버용 키(GOOGLE_MAPS_API_KEY)와는 다른 키다.
# - 저장한 뒤에는 네이티브 앱을 다시 빌드해야 지도가 보인다.
# 실행: bash scripts/set-ios-maps-key.sh
set -uo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="mobile/.env"
BUNDLE_ID=$(node -p "require('./mobile/app.json').expo.ios.bundleIdentifier" 2>/dev/null || echo "com.travelpouch.notebook")

cat <<EOF
Google Cloud 콘솔에서 아이폰용 지도 키를 만들어 주세요(서버 키와 같은 프로젝트).
  1. API 및 서비스 → 라이브러리 → "Maps SDK for iOS" 사용 설정
  2. API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → API 키
  3. 만든 키를 눌러서
     - 애플리케이션 제한사항: iOS 앱 → 번들 ID에 ${BUNDLE_ID} 추가
     - API 제한사항: 키 제한 → "Maps SDK for iOS"만 선택 → 저장
  4. 키 값(AIza로 시작)을 복사해서 아래에 붙여넣기

EOF

while true; do
  printf '아이폰용 지도 키를 붙여넣고 Enter: ' >&2
  IFS= read -r KEY
  KEY="${KEY#"${KEY%%[![:space:]]*}"}"
  KEY="${KEY%"${KEY##*[![:space:]]}"}"
  # Google API 키는 "AIza" + 35글자(영문·숫자·-·_)다.
  if [[ "$KEY" =~ ^AIza[0-9A-Za-z_-]{35}$ ]]; then
    break
  fi
  echo "     Google API 키 모양이 아니에요(AIza로 시작하는 39글자). 키만 복사해서 다시 붙여넣어 주세요." >&2
done

touch "$ENV_FILE"
# 예전 값이 있으면 지우고 새 값을 넣는다.
grep -v '^EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY=' "$ENV_FILE" > "$ENV_FILE.tmp" || true
printf 'EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY=%s\n' "$KEY" >> "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"

echo
echo "✅ 저장했어요($ENV_FILE). 이제 Claude에게 \"키 넣었어\"라고 알려 주세요. 앱을 다시 빌드할게요."
