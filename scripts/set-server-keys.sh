#!/bin/bash
# 서버 키를 Vercel 실제 서버(Production)에 다시 넣고, 다시 배포한 뒤 실제로 동작하는지 확인한다.
# - TypeSafe 키와 Supabase service_role 키는 이 터미널에서 붙여넣기로만 받고, 파일에 저장하지 않는다.
# - 키마다 저장하기 전에 진짜 키인지 먼저 확인한다(잘못 붙여넣으면 다시 묻는다).
# - 접근 코드는 새로 만들어 .env.local(깃에 올라가지 않음)에 남기고 클립보드에 복사한다.
# - TypeSafe 크레딧이 없으면 키 대신 "건너뛰기"를 입력한다. 서버의 TypeSafe 키는 그대로 두고 나머지만 맞춘다.
# 실행: bash scripts/set-server-keys.sh
set -uo pipefail
cd "$(dirname "$0")/.."

SITE="https://osaka-pocket.vercel.app"
SUPABASE_URL=$(grep -E '^EXPO_PUBLIC_SUPABASE_URL=' mobile/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d "\"' \r")

if ! vercel whoami </dev/null >/dev/null 2>&1; then
  echo "먼저 터미널에서 vercel login 을 해 주세요."
  exit 1
fi

# 붙여넣은 값을 받는다. 키에는 띄어쓰기가 없으니, 띄어쓰기가 있으면 명령어 같은 걸 잘못 붙여넣은 것이다.
ask() {
  local value
  while true; do
    printf '%s' "$1" >&2
    IFS= read -r value
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [ -z "$value" ]; then
      echo "     비어 있어요. 다시 붙여넣어 주세요." >&2
      continue
    fi
    case "$value" in
      *[[:space:]]*)
        echo "     키에는 띄어쓰기가 없어요. 키만 복사해서 다시 붙여넣어 주세요." >&2
        continue
        ;;
    esac
    printf '%s' "$value"
    return
  done
}

# 아주 짧은 질문 하나로 TypeSafe가 이 키를 받아 주는지 본다.
typesafe_ok() {
  local status
  status=$(curl -s -m 30 -o /dev/null -w '%{http_code}' -X POST https://api.typesafe.ai/v1/systemone \
    -H "Authorization: Bearer $1" -H "Content-Type: application/json" \
    -d '{"state":"key check","model":"jev-latest","questions":{"ok":{"type":"noul","instructions":"Is this a short test message?"}}}')
  [ "$status" = "200" ]
}

# 관리자 전용 목록을 읽을 수 있으면 service_role 키다. anon·publishable 키는 거절된다.
supabase_ok() {
  local status
  if [[ "$1" == eyJ* ]]; then
    status=$(curl -s -m 20 -o /dev/null -w '%{http_code}' "$SUPABASE_URL/auth/v1/admin/users?per_page=1" -H "apikey: $1" -H "Authorization: Bearer $1")
  else
    status=$(curl -s -m 20 -o /dev/null -w '%{http_code}' "$SUPABASE_URL/auth/v1/admin/users?per_page=1" -H "apikey: $1")
  fi
  [ "$status" = "200" ]
}

put() {
  if printf '%s' "$2" | vercel env add "$1" production --force --sensitive --yes >/dev/null 2>&1; then
    echo "     ✓ $1"
  else
    echo "     ✗ $1 저장 실패"
    exit 1
  fi
}

echo
echo "1/4  TypeSafe 콘솔(https://console.typesafe.ai/keys)에서 API 키를 복사해 오세요."
echo "     크레딧이 없어 키를 못 만들면 '건너뛰기'를 입력하세요. Jev 기능만 나중에 켜져요."
while true; do
  TYPESAFE_KEY=$(ask "     TypeSafe 키를 붙여넣고 Enter: ")
  if [ "$TYPESAFE_KEY" = "건너뛰기" ] || [ "$TYPESAFE_KEY" = "skip" ]; then
    TYPESAFE_KEY=""
    echo "     → TypeSafe는 건너뛰어요"
    break
  fi
  if typesafe_ok "$TYPESAFE_KEY"; then
    echo "     ✓ TypeSafe 키 확인됨"
    break
  fi
  echo "     ✗ TypeSafe가 이 키를 거절했어요. 키를 다시 복사해 주세요."
done

echo
echo "2/4  Supabase → Project Settings → API 에서 service_role(secret) 키를 복사해 오세요."
while true; do
  SERVICE_KEY=$(ask "     service_role 키를 붙여넣고 Enter: ")
  if [ -z "$SUPABASE_URL" ]; then
    echo "     (mobile/.env에 Supabase 주소가 없어 확인은 건너뛰어요)"
    break
  fi
  if supabase_ok "$SERVICE_KEY"; then
    echo "     ✓ Supabase 키 확인됨"
    break
  fi
  echo "     ✗ 이 키로는 관리자 확인이 안 돼요. anon·publishable 키가 아니라 service_role(secret) 키인지 확인해 주세요."
done

echo
echo "3/4  새 접근 코드를 만들고 서버에 넣는 중…"
ACCESS_CODE=$(openssl rand -hex 24)
[ -n "$TYPESAFE_KEY" ] && put TYPESAFE_API_KEY "$TYPESAFE_KEY"
put SUPABASE_SERVICE_ROLE_KEY "$SERVICE_KEY"
put TRANSIT_ACCESS_TOKEN "$ACCESS_CODE"
touch .env.local
{ grep -v '^TRANSIT_ACCESS_TOKEN=' .env.local || true; echo "TRANSIT_ACCESS_TOKEN=$ACCESS_CODE"; } > .env.local.tmp && mv .env.local.tmp .env.local
echo "     ✓ 접근 코드를 .env.local 에 저장했어요 (깃에 올라가지 않아요)"

echo
echo "4/4  서버를 다시 배포하는 중… (1~2분)"
if ! vercel deploy --prod --yes </dev/null >/tmp/osaka-deploy.log 2>&1; then
  echo "     ✗ 배포 실패. 기록: /tmp/osaka-deploy.log"
  exit 1
fi
echo "     ✓ 배포 완료"

echo
echo "실제 서버로 Jev를 불러 보는 중…"
RESULT=$(curl -s -m 40 -X POST "$SITE/api/read-pouch" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_CODE" \
  -d '{"text":"배터리 가방에 넣어놨어","items":[{"id":"p1","title":"보조배터리"}]}')
case "$RESULT" in
  *'"intent"'*) echo "✅ Jev 정상 작동: $RESULT" ;;
  *UPSTREAM_PROVIDER_ERROR*)
    if [ -z "$TYPESAFE_KEY" ]; then
      echo "✅ 서버와 접근 코드 정상. Jev는 TypeSafe 크레딧을 넣고 이 스크립트를 다시 실행하면 켜져요."
    else
      echo "❌ 서버가 TypeSafe를 부르지 못했어요: $RESULT"
    fi
    ;;
  *UNAUTHORIZED*) echo "❌ 새 접근 코드가 아직 반영되지 않았어요. 1분 뒤 이 스크립트를 다시 실행해 보세요: $RESULT" ;;
  *) echo "결과: $RESULT" ;;
esac

printf '%s' "$ACCESS_CODE" | pbcopy
echo
echo "새 접근 코드를 클립보드에 복사해 뒀어요. 메모장 같은 곳에 붙여넣어 보관하세요."
echo "앱에서 유료 기능을 쓸 때 이 코드를 넣어요. (채팅에는 붙여넣지 마세요)"
