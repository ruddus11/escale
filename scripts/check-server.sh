#!/bin/bash
# 실제 서버에서 접근 코드와 Jev가 동작하는지 확인한다. 접근 코드는 .env.local에서 읽고 화면에 띄우지 않는다.
# 실행: bash scripts/check-server.sh
set -uo pipefail
cd "$(dirname "$0")/.."
CODE=$(grep -E '^TRANSIT_ACCESS_TOKEN=' .env.local 2>/dev/null | head -1 | cut -d= -f2-)
if [ -z "$CODE" ]; then
  echo "❌ .env.local에 접근 코드가 없어요. 먼저 bash scripts/set-server-keys.sh 를 실행해 주세요."
  exit 1
fi
RESULT=$(curl -s -m 40 -X POST https://osaka-pocket.vercel.app/api/read-pouch -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CODE" \
  -d '{"text":"배터리 가방에 넣어놨어","items":[{"id":"p1","title":"보조배터리"}]}')
case "$RESULT" in
  *'"intent"'*) echo "✅ Jev 정상 작동: $RESULT" ;;
  *UPSTREAM_PROVIDER_ERROR*) echo "❌ 접근 코드는 맞는데 서버가 TypeSafe를 부르지 못했어요(키나 크레딧 확인): $RESULT" ;;
  *UPSTREAM_TIMEOUT*) echo "⏳ Jev 응답이 늦었어요. 잠시 뒤 다시 실행해 보세요: $RESULT" ;;
  *UNAUTHORIZED*) echo "❌ 서버가 접근 코드를 거절했어요: $RESULT" ;;
  *) echo "결과: $RESULT" ;;
esac

# 계획 탭의 장소 찾기: 주소 한 줄로 지도 위치를 받는지 본다.
PLACE=$(curl -s -m 40 -w '\n%{http_code}' -X POST https://osaka-pocket.vercel.app/api/place -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CODE" \
  -d '{"action":"find","text":"Lisbon Cathedral","language":"en"}')
STATUS=$(printf '%s' "$PLACE" | tail -1)
BODY=$(printf '%s' "$PLACE" | sed '$d')
case "$STATUS:$BODY" in
  200:*'"latitude"'*) echo "✅ 장소 찾기 정상 작동: $BODY" ;;
  404:*) echo "❌ 장소 찾기가 아직 서버에 없어요. vercel deploy --prod --yes 로 먼저 올려 주세요." ;;
  *UPSTREAM*) echo "❌ 서버가 Google 장소 검색을 부르지 못했어요(Places API 사용 설정·키 제한 확인): $BODY" ;;
  *) echo "장소 찾기 결과($STATUS): $BODY" ;;
esac
