import { LEGAL_VERSION, PROCESSORS, PUBLIC_LEGAL_URLS, PUBLIC_WEB_HOST, legalDate, operatorText, type LegalDocument, type LegalLang } from "./legal";

// 개인정보 처리방침. 개인정보 보호법 제30조와 개인정보 처리방침 작성지침의 항목 순서를 따른다.
// 정본은 한국어다. 영어는 참고 번역이고, 일본어 화면에는 영어 번역과 환율 항목의 일본어 안내를 함께 보인다.
// 동의서(consents.ts)와 같은 내용을 다루므로 함께 고친다.

const { supabase, vercel, typesafe, google } = PROCESSORS;

export function privacyPolicy(lang: LegalLang): LegalDocument {
  return lang === "ko" ? korean() : english(lang);
}

function korean(): LegalDocument {
  const op = operatorText("ko");
  return {
    id: "privacy",
    title: "개인정보 처리방침",
    version: LEGAL_VERSION,
    effective: LEGAL_VERSION,
    blocks: [
      {
        kind: "text",
        text: `${op.name}(이하 "운영자")는 Escale 앱과 웹 버전(${PUBLIC_WEB_HOST}, 이하 함께 "앱")을 쓰는 분의 개인정보를 「개인정보 보호법」 등 관련 법령에 따라 보호하고, 관련 고충을 빠르게 처리하기 위해 이 처리방침을 둡니다.`,
      },
      { kind: "heading", text: "한눈에 보기" },
      {
        kind: "list",
        items: [
          "로그인하지 않으면 수첩은 이 기기에만 저장되고, 운영자는 그 내용을 볼 수 없습니다.",
          "로그인하면 계정 정보와 수첩 백업을 일본(도쿄)에 있는 Supabase 서버에 보관합니다.",
          "운영자는 광고·분석·추적 도구를 넣지 않고, 개인정보를 팔거나 제3자에게 제공하지 않습니다. 지도를 띄우는 Google 지도 SDK가 Google에 보내는 정보는 7항에 적었습니다.",
          "웹 버전은 수첩을 이 브라우저 저장소에만 두고, 쿠키를 쓰지 않습니다.",
          "앱 안에서 언제든 계정을 삭제할 수 있고, 삭제하면 서버의 정보도 지체 없이 지웁니다.",
          "AI·장소 기능은 따로 동의한 경우에만, 버튼을 누를 때 필요한 내용만 미국의 서버로 보냅니다.",
          "계획 탭 지도는 Google 지도를 쓰며, 내 위치는 쓰지 않습니다.",
        ],
      },

      { kind: "heading", text: "1. 기기 안에서만 처리하는 정보" },
      { kind: "text", text: "다음 정보는 이 기기 안에서만 저장·처리되며 운영자가 수집하지 않습니다." },
      {
        kind: "list",
        items: [
          "로그인하지 않은 상태의 수첩 전체(여행, 예약 기본정보, 일정, 장소, 기록, 준비물, 경비, 동행자 이름)",
          "영수증 사진: 기기의 글자 인식 기능(Apple Vision)으로 읽고, 사진과 읽은 글자를 기기 밖으로 보내지 않습니다. 사진은 수첩에 저장하지 않습니다.",
          "예약 사진(숙소·항공): 고른 사진을 기기의 글자 인식 기능(Apple Vision)으로 읽고, 사진과 읽은 글자를 기기 밖으로 보내지 않습니다. 사진은 저장하지 않으며, 이용자가 확인하고 저장한 예약 내용(숙소 이름·날짜, 항공편 번호·구간·날짜·시각)만 다른 수첩 내용처럼 남습니다.",
          "수첩 첫 장 사진: 개요 탭에 붙일 사진을 고르면 이 기기 안에만 저장하고 기기 밖으로 보내지 않습니다. 수첩 백업에도 넣지 않으며, 로그아웃하면 지웁니다.",
          "여행 도구에 적은 말의 기본 해석",
          "앱 언어 같은 설정과 로그인 상태를 유지하는 정보",
          "지도 위치(좌표): 장소 찾기로 받은 좌표는 Google 정책에 따라 이 기기에만 최대 30일 두고, 계정 백업에는 넣지 않습니다.",
          "백업 파일: 이용자가 직접 만들고 저장할 곳을 고릅니다. 파일은 암호화되지 않으니 안전한 곳에 두세요.",
          "웹 버전의 수첩 전체: 이 브라우저의 저장소(IndexedDB, 쓸 수 없으면 localStorage)에만 저장하고 서버로 보내지 않습니다. 장소 검색에 쓰는 개인 접근 코드도 이 브라우저의 localStorage에 둡니다. 자세한 내용은 10항에 있습니다.",
        ],
      },

      { kind: "heading", text: "2. 처리하는 개인정보와 목적, 보유 기간" },
      { kind: "text", text: "운영자는 아래 목적에 필요한 만큼만 개인정보를 처리하며, 목적이 바뀌면 미리 알리고 다시 동의를 받습니다." },
      {
        kind: "table",
        caption: "계정과 백업 — 로그인한 경우(근거: 정보주체의 동의, 법 제15조제1항제1호)",
        rows: [
          {
            label: "항목",
            value:
              "계정: 이메일 주소(Apple로 로그인하면 Apple이 전달하는 이메일 또는 가린 이메일), 로그인 식별자, 로그인 방식. Google·카카오로 로그인하면 그 사업자가 전달하는 이름(닉네임)과 프로필 사진 주소\n" +
              "수첩 백업: 이 기기의 수첩 전체(여행 이름·여행지·기간, 동행자 이름, 예약 기본정보, 일정·장소·기록·준비물, 경비, 메모에 직접 적은 내용)\n" +
              "장소 찾기·둘러보기: 입력한 검색어, 여행지 이름과 장소 종류, 숙소 근처로 찾을 때 숙소 위치(약 100m 단위로 줄여서), 고른 장소의 Google 장소 ID와 주소\n" +
              "둘러보기 이용 기록: 검색한 시각과 성공 여부(검색어와 위치는 남기지 않음)\n" +
              "동의 기록: 동의한 문서의 판과 동의 시각",
            strong: true,
          },
          { label: "목적", value: "회원 확인과 로그인, 수첩 백업과 다른 기기에서 불러오기, 장소 찾기와 지도 표시, 둘러보기 검색 횟수 한도 적용, 동의 사실 확인, 문의 응대", strong: true },
          { label: "보유 기간", value: "계정을 삭제할 때까지. 단, 장소 검색어와 숙소 위치의 원문은 앱 서버가 결과를 돌려준 즉시 파기하며 저장하지 않습니다. 같은 검색을 반복하지 않도록 검색 조건의 SHA-256 해시값과 Google의 장소 결과만 앱 서버 메모리에서 최대 30분 재사용하며, 계정·IP 주소와 연결하지 않습니다. 만료된 항목은 다음 캐시 조회 때 삭제합니다. 둘러보기 이용 기록은 2개월 뒤 파기합니다.", strong: true },
        ],
      },
      {
        kind: "table",
        caption: "AI·장소 기능 — 기능 동의를 한 경우(근거: 정보주체의 동의, 법 제15조제1항제1호)",
        rows: [
          {
            label: "항목",
            value:
              "장소 추천: 여행지, 여행 날짜, 인원 수, 이용자가 적은 취향 문장\n" +
              "예약 메일 읽기: 붙여넣은 메일·문자 내용(예약번호·이메일·전화번호·카드번호는 기기에서 가린 뒤)\n" +
              "Jev로 다시 읽기: 입력한 한 줄(같은 방식으로 가림)과 준비물 이름",
            strong: true,
          },
          { label: "목적", value: "이용자가 요청한 결과 제공", strong: true },
          { label: "보유 기간", value: "운영자 서버는 보낸 내용의 원문을 결과를 돌려준 즉시 파기하며 저장하지 않습니다. 장소 추천은 같은 조건으로 다시 열 때 비용을 아끼려고 조건(여행지·날짜·인원·취향 문장)의 SHA-256 해시값과 추천 결과(장소 목록)만 앱 서버 메모리에서 최대 30분 재사용하며, 계정·IP 주소와 연결하지 않습니다. 만료된 항목은 다음 캐시 조회 때 삭제합니다. 국외 수탁자의 보관은 6항을 따릅니다.", strong: true },
        ],
      },
      {
        kind: "table",
        caption: "동의 없이 처리하는 정보(법 제22조제3항에 따라 구분해 알림)",
        rows: [
          { label: "항목", value: "로그인 기록(로그인 일시, IP 주소), 서버 접속 기록(IP 주소, 요청 시각, 기기·앱 정보), 이용 한도 기록(장소·AI 기능별 사용 횟수와, 계정 식별자 또는 로그인하지 않았을 때의 IP 주소의 SHA-256 해시값)", strong: true },
          { label: "목적", value: "부정 이용과 과다 비용 방지, 보안 사고 대응, 법령상 의무 이행", strong: true },
          {
            label: "근거와 보유 기간",
            value:
              "로그인 기록: 통신비밀보호법 제15조의2와 같은 법 시행령 제41조(법 제15조제1항제2호) — 3개월\n" +
              "서버 접속 기록: 서비스 안정과 보안을 위한 운영자의 정당한 이익(법 제15조제1항제6호) — 1시간 뒤 자동 삭제\n" +
              "이용 한도 기록: 같은 정당한 이익 — 1분·1일 단위로 세고, 기간이 끝난 기록은 하루 뒤 매일 한 번 삭제(최대 3일)",
            strong: true,
          },
        ],
      },

      { kind: "heading", text: "3. 만 14세 미만 아동의 개인정보" },
      {
        kind: "text",
        text: "만 14세 미만은 로그인(회원 가입)을 할 수 없으며, 운영자는 만 14세 미만 아동의 개인정보를 수집하지 않습니다. 만 14세 미만의 정보가 수집된 것을 알게 되면 지체 없이 삭제합니다.",
      },

      { kind: "heading", text: "4. 개인정보의 파기" },
      {
        kind: "list",
        items: [
          "앱의 설정 > 계정에서 계정을 삭제하면 계정 정보, 수첩 백업, 동의 기록, 유료 이용 기록을 서버에서 지체 없이 삭제합니다. 이 기기에 있는 수첩은 남으니 필요하면 앱에서 직접 지워 주세요.",
          "로그아웃하면 계정에 백업된 것을 확인한 뒤 이 기기의 수첩을 지웁니다. 같은 기기를 쓰는 다른 사람에게 남지 않게 하기 위해서이며, 계정의 수첩은 다시 로그인하면 불러올 수 있습니다.",
          "전자 파일은 되살릴 수 없는 방법으로 삭제합니다. 종이 문서로는 개인정보를 보관하지 않습니다.",
          "서버 사업자의 백업본이 있으면 그 보관 기간(최대 7일)이 지난 뒤 함께 지워집니다.",
          "법령에 따라 보관하는 정보(로그인 기록 3개월)는 다른 정보와 분리해 두고, 기간이 끝나면 지체 없이 삭제합니다.",
        ],
      },

      { kind: "heading", text: "5. 개인정보의 제3자 제공" },
      {
        kind: "text",
        text: "운영자는 개인정보를 제3자에게 제공하지 않습니다. 다만 법률에 특별한 규정이 있거나 수사기관이 법령에 정한 절차에 따라 요구하는 경우는 예외입니다.",
      },

      { kind: "heading", text: "6. 개인정보 처리 위탁과 국외 이전" },
      {
        kind: "text",
        text: "운영자는 서비스를 위해 아래 사업자에게 개인정보 처리를 맡기며, 이 사업자들의 서버는 모두 국외에 있습니다(법 제26조, 제28조의8). 운영자는 각 사업자의 데이터 처리 약정으로 목적 외 처리 금지, 안전성 확보, 재위탁 제한, 손해배상 책임 등을 정하고 이를 지키는지 관리합니다.",
      },
      {
        kind: "table",
        caption: "로그인·백업 서버",
        rows: [
          { label: "받는 자", value: `${supabase.company} (${supabase.contact})`, strong: true },
          { label: "국가", value: "일본(도쿄 데이터센터, Amazon Web Services)", strong: true },
          { label: "항목", value: "계정 정보, 수첩 백업, 동의 기록, 로그인 기록, 이용 한도 기록(해시값과 횟수)", strong: true },
          { label: "시기·방법", value: "로그인할 때와 수첩이 바뀔 때마다 암호화된 통신(HTTPS)으로 전송" },
          { label: "맡기는 일", value: "로그인 처리와 데이터 보관", strong: true },
          { label: "보유 기간", value: "계정을 삭제할 때까지(로그인 기록은 3개월, 이용 한도 기록은 최대 3일)", strong: true },
        ],
      },
      {
        kind: "table",
        caption: "앱 서버",
        rows: [
          { label: "받는 자", value: `${vercel.company} (${vercel.contact})`, strong: true },
          { label: "국가", value: "미국(워싱턴 D.C. 인근 데이터센터)", strong: true },
          { label: "항목", value: "로그인 토큰(계정 식별자와 이메일이 들어 있음), 장소 검색어, 요청 기록(IP 주소, 시각), AI·장소 기능 요청 내용", strong: true },
          { label: "시기·방법", value: "계정 삭제를 요청하거나, 장소를 찾거나, AI·장소 기능을 쓸 때 암호화된 통신(HTTPS)으로 전송" },
          { label: "맡기는 일", value: "계정 삭제 처리, 장소 찾기와 AI·장소 기능 요청 전달", strong: true },
          { label: "보유 기간", value: "요청 내용의 원문은 처리한 즉시 파기하며 저장하지 않음. 장소 검색·추천 결과는 요청의 SHA-256 해시값과 함께 서버 메모리에서 최대 30분 재사용하며 계정·IP 주소와 연결하지 않음. 만료 항목은 다음 캐시 조회 때 삭제. 요청 기록은 1시간 뒤 자동 삭제", strong: true },
        ],
      },
      {
        kind: "table",
        caption: "AI 판단(기능 동의를 한 경우)",
        rows: [
          { label: "받는 자", value: `${typesafe.company} (${typesafe.contact})`, strong: true },
          { label: "국가", value: "미국", strong: true },
          { label: "항목", value: "2항의 AI·장소 기능 항목", strong: true },
          { label: "시기·방법", value: "AI 기능 버튼을 누를 때 앱 서버를 거쳐 암호화된 통신(HTTPS)으로 전송" },
          { label: "맡기는 일", value: "문장과 장소 판단(AI)", strong: true },
          { label: "보유 기간", value: "데이터 처리 약정에 따라 처리에 필요한 기간만 보관한 뒤 삭제. 받은 내용을 AI 학습에 쓰지 않음", strong: true },
        ],
      },
      {
        kind: "text",
        text: `장소를 찾거나 장소 추천을 쓰면 앱 서버가 ${google.company}(미국)의 장소 검색에 검색어(또는 여행지와 장소 종류)만 보내며, 이용자를 알아볼 수 있는 정보는 보내지 않습니다.`,
      },
      {
        kind: "text",
        text: "거부 방법과 효과: 로그인 전 동의 화면에서 동의하지 않거나, 동의한 뒤 계정을 삭제하면 Supabase·Vercel로 이전되지 않습니다. AI·장소 기능은 기능 동의를 하지 않거나 설정에서 철회하면 TypeSafe·Google로 보내지 않습니다. 어느 경우든 로그인하지 않고 이 기기에서 수첩을 쓸 수 있습니다.",
      },

      { kind: "heading", text: "7. 외부 서비스 연결" },
      {
        kind: "list",
        items: [
          "환율: 다른 통화로 지출을 적으면 기기가 Frankfurter(api.frankfurter.dev, 유럽중앙은행 기준가)에 통화 코드 두 개를 보내 환율을 받아옵니다. 이 요청으로 그 서버에 기기의 IP 주소도 전달됩니다.",
          "지도와 링크: 지도 열기나 예약 사이트 링크를 누르면 그 주소가 해당 서비스(예: Google 지도)로 전달되며, 그 서비스의 개인정보 처리방침이 적용됩니다.",
          "Apple로 로그인: Apple이 이메일(또는 가린 이메일)과 식별자를 운영자에게 전달합니다. Apple ID 정보는 Apple이 관리합니다.",
          "Google·카카오로 로그인(앱이 이 방법을 보여 줄 때): 로그인 창은 Google LLC(미국) 또는 주식회사 카카오(한국)의 페이지이며, 그 사업자가 이메일, 식별자, 이름(닉네임)과 프로필 사진 주소를 운영자의 로그인 서버(Supabase)에 전달합니다. 각 계정 정보는 그 사업자가 관리하고 그 사업자의 개인정보 처리방침이 적용됩니다.",
          "이메일로 로그인: 입력한 이메일 주소로 Supabase가 로그인 링크를 보냅니다.",
          "지도: 계획 탭의 지도는 Google 지도(Google LLC, 미국)를 앱 안에 띄웁니다. 지도를 보는 동안 기기가 Google에 지도를 직접 요청하며, Google 지도 SDK가 IP 주소, 기기 식별자, 지도 사용·성능·오류 정보를 Google의 분석과 서비스 제공을 위해 가져갈 수 있고 Google 개인정보처리방침이 적용됩니다. 광고 추적에는 쓰지 않으며, 내 위치는 쓰지 않습니다. 둘러보기의 장소 사진도 기기가 Google에서 직접 받아 오며, 이때 Google이 IP 주소 같은 기기 정보를 받을 수 있습니다.",
        ],
      },

      { kind: "heading", text: "8. 이용자의 권리와 행사 방법" },
      {
        kind: "list",
        items: [
          "이용자는 언제든 자신의 개인정보를 열람하고, 정정·삭제, 처리정지, 동의 철회를 요구할 수 있습니다.",
          "앱에서 직접: 수첩 내용을 보고 고치고 지우기, 설정 > 계정에서 계정 삭제(서버 정보 전체 삭제), 설정 > 개인정보와 약관에서 AI·장소 기능 동의 철회",
          `이메일로 요청: ${op.email}. 운영자는 요청을 받은 날부터 10일 안에 조치하고 결과를 알립니다.`,
          `앱 없이 계정 삭제를 요청하는 방법: ${PUBLIC_LEGAL_URLS.accountDeletion}`,
          "법정대리인이나 위임을 받은 사람을 통해서도 요구할 수 있으며, 이때 위임장을 요청할 수 있습니다.",
          "다른 법령이 보관을 정한 정보는 삭제를 요구해도 그 기간 동안 보관될 수 있습니다.",
          "운영자는 이용자의 권리나 의무에 중대한 영향을 미치는 완전히 자동화된 결정을 하지 않습니다. AI 기능의 결과는 제안일 뿐이며, 수첩에 반영하기 전에 이용자가 확인합니다.",
        ],
      },

      { kind: "heading", text: "9. 안전성 확보 조치" },
      {
        kind: "list",
        items: [
          "관리: 개인정보는 운영자만 다루며, 운영 계정에는 2단계 인증을 적용합니다.",
          "전송: 모든 통신을 암호화(HTTPS)합니다.",
          "저장: 서버 저장소는 암호화되며, 접근 제어로 회원이 자기 데이터에만 접근할 수 있게 합니다. 서버 비밀 키는 앱에 넣지 않고 서버에만 둡니다.",
          "최소화: 예약번호·이메일·전화번호·카드번호처럼 민감할 수 있는 내용은 AI 기능으로 보내기 전에 기기에서 가립니다.",
        ],
      },

      { kind: "heading", text: "10. 자동 수집 장치(쿠키 등)" },
      {
        kind: "text",
        text: "앱과 웹 버전은 쿠키, 광고 식별자, 분석·추적 도구를 쓰지 않으며 이용자의 행태 정보를 수집하지 않습니다. 모바일 앱은 로그인 상태를 유지하는 정보만 기기 안에 저장합니다.",
      },
      {
        kind: "list",
        items: [
          "웹 버전의 브라우저 저장소: 수첩(IndexedDB, 쓸 수 없으면 localStorage)과 장소 검색용 개인 접근 코드(localStorage)를 이 브라우저에 저장합니다. 수첩은 서버로 보내지 않고, 접근 코드는 장소를 찾을 때만 앱 서버로 보냅니다. 화면을 오프라인에서도 열 수 있도록 앱 화면 파일을 서비스 워커 캐시에 둡니다(개인정보 없음).",
          "보관과 삭제: 이용자가 지울 때까지 남습니다. 수첩은 웹 버전의 정보 화면에서 '여행 데이터 초기화'로 지울 수 있고, 접근 코드까지 모두 지우려면 브라우저 설정에서 이 사이트의 데이터를 삭제합니다.",
          "이용자를 추적하거나 광고에 쓰는 쿠키가 없으므로 쿠키 동의 창을 띄우지 않습니다. 이런 도구를 쓰게 되면 미리 알리고 동의를 받습니다.",
        ],
      },

      { kind: "heading", text: "11. 개인정보 보호책임자와 문의" },
      {
        kind: "table",
        rows: [
          { label: "개인정보 보호책임자", value: op.officer },
          { label: "연락처", value: op.email },
        ],
      },
      { kind: "text", text: "개인정보와 관련한 문의, 불만, 피해 구제 요청은 위 연락처로 보내 주세요. 지체 없이 답하고 처리합니다." },

      { kind: "heading", text: "12. 권익 침해 구제 방법" },
      { kind: "text", text: "개인정보 침해에 관한 상담이나 분쟁 해결이 필요하면 아래 기관에 문의할 수 있습니다." },
      {
        kind: "list",
        items: [
          "개인정보분쟁조정위원회: 국번 없이 1833-6972, www.kopico.go.kr",
          "개인정보침해신고센터(한국인터넷진흥원): 국번 없이 118, privacy.kisa.or.kr",
          "대검찰청: 국번 없이 1301, www.spo.go.kr",
          "경찰청: 국번 없이 182, ecrm.police.go.kr",
        ],
      },

      { kind: "heading", text: "13. 처리방침의 변경" },
      {
        kind: "text",
        text: `이 처리방침은 ${legalDate("ko", LEGAL_VERSION)}부터 적용합니다. 내용을 바꾸면 시행 7일 전(이용자에게 불리하거나 중요한 변경은 30일 전)부터 앱에서 알리고, 필요하면 다시 동의를 받습니다. 이 처리방침은 ${PUBLIC_LEGAL_URLS.privacy}에서도 볼 수 있습니다.`,
      },
    ],
  };
}

function english(lang: LegalLang): LegalDocument {
  const op = operatorText("en");
  return {
    id: "privacy",
    title: "Privacy policy",
    version: LEGAL_VERSION,
    effective: LEGAL_VERSION,
    notice:
      lang === "ja"
        ? "正式な文書は韓国語版です。為替レートの項目を除き、英語の参考訳を表示しています。"
        : "This is a translation for reference. If it differs from the Korean version, the Korean version applies.",
    blocks: [
      {
        kind: "text",
        text: `${op.name} ("we") runs the Escale app and its web version (${PUBLIC_WEB_HOST}), together the "App". We protect the personal data of people who use the App under Korea's Personal Information Protection Act and related laws, and keep this policy so that concerns can be handled quickly.`,
      },
      { kind: "heading", text: "At a glance" },
      {
        kind: "list",
        items: [
          "If you don't sign in, your notebooks stay on this device and we can't see them.",
          "If you sign in, your account details and notebook backup are kept on Supabase servers in Tokyo, Japan.",
          "We add no advertising, analytics or tracking tools, and we never sell or give your data to third parties. What the Google Maps SDK sends to Google when it shows a map is described in section 7.",
          "The web version keeps your notebooks only in this browser's storage and uses no cookies.",
          "You can delete your account in the App at any time, and we then delete your data from our servers without delay.",
          "AI and place features send only what they need, to servers in the United States, and only after you agree and tap the button.",
          "The map on the Plan tab uses Google Maps and never uses your location.",
        ],
      },

      { kind: "heading", text: "1. Data that stays on your device" },
      { kind: "text", text: "We do not collect the following. It is stored and processed only on your device." },
      {
        kind: "list",
        items: [
          "All notebooks while you are signed out (trips, booking basics, plans, places, stories, packing lists, expenses, companions' names)",
          "Receipt photos: read with the device's own text recognition (Apple Vision). Neither the photo nor the text read from it leaves the device, and the photo is not saved in your notebook.",
          "Booking photos (stays and flights): the photo you choose is read with the device's own text recognition (Apple Vision). Neither the photo nor the text read from it leaves the device. The photo is not saved; only the booking details you confirm and save (stay name and dates; flight number, route, dates and times) stay in your notebook like any other entry.",
          "First page photo: a photo you choose for the Overview tab is saved only on this device. It never leaves the device, is not included in your notebook backup, and is deleted when you sign out.",
          "Basic reading of what you type into the trip kit",
          "Settings such as the App language, and the data that keeps you signed in",
          "Map coordinates: coordinates from place search stay only on this device for up to 30 days, as Google's policy allows, and are not included in your account backup.",
          "Backup files: you create them and choose where to save them. They are not encrypted, so keep them somewhere safe.",
          "All notebooks in the web version: stored only in this browser's storage (IndexedDB, or localStorage if that is unavailable) and never sent to our servers. The personal access code used for place search is also kept in this browser's localStorage. See section 10.",
        ],
      },

      { kind: "heading", text: "2. Data we process, why, and for how long" },
      { kind: "text", text: "We process only what these purposes need. If a purpose changes, we tell you first and ask for your consent again." },
      {
        kind: "table",
        caption: "Account and backup — when you sign in (legal basis: your consent, PIPA Art. 15(1)1)",
        rows: [
          {
            label: "Data",
            value:
              "Account: email address (with Sign in with Apple, the email Apple shares or a hidden relay address), sign-in identifier, sign-in method. With Google or Kakao sign-in, the name (nickname) and profile photo address that company shares\n" +
              "Notebook backup: every notebook on this device (trip name, destination and dates, companions' names, booking basics, plans, places, stories, packing lists, expenses, and anything you type into notes)\n" +
              "Place search and browsing: what you type to search, the destination name and kind of place, your stay's location rounded to about 100 m when you browse near it, and the Google place ID and address of the place you pick\n" +
              "Explore usage record: when you searched and whether it worked (no search text or location)\n" +
              "Consent record: the version of the documents you agreed to and when",
            strong: true,
          },
          { label: "Purpose", value: "Confirming members and signing in, backing up notebooks and loading them on other devices, finding places and showing them on the map, applying the Explore search limit, proving consent, answering enquiries", strong: true },
          { label: "How long", value: "Until you delete your account. The search text and stay location themselves are discarded as soon as our server returns the result and are never stored. So that the same search isn't repeated, our server reuses only a SHA-256 hash of the search and Google's place results from memory for up to 30 minutes, not linked to your account or IP address. Expired entries are removed when the cache is next accessed. Explore usage records are deleted after 2 months.", strong: true },
        ],
      },
      {
        kind: "table",
        caption: "AI and place features — when you agree to them (legal basis: your consent, PIPA Art. 15(1)1)",
        rows: [
          {
            label: "Data",
            value:
              "Place suggestions: destination, travel dates, number of travellers, the preference you type\n" +
              "Reading booking emails: the email or message you paste (booking codes, emails, phone and card numbers hidden on the device first)\n" +
              "Ask Jev to read it: the line you typed (hidden the same way) and your packing item names",
            strong: true,
          },
          { label: "Purpose", value: "Giving you the result you asked for", strong: true },
          { label: "How long", value: "Our server discards what you sent as soon as it returns the result and never stores it. For place suggestions, so that reopening the same trip costs nothing extra, it reuses only a SHA-256 hash of the conditions (destination, dates, travellers, preference) and the suggested places from memory for up to 30 minutes, not linked to your account or IP address. Expired entries are removed when the cache is next accessed. Processors abroad keep data as described in section 6.", strong: true },
        ],
      },
      {
        kind: "table",
        caption: "Data processed without consent (listed separately under PIPA Art. 22(3))",
        rows: [
          { label: "Data", value: "Sign-in records (time, IP address); server access records (IP address, request time, device and app details); usage-limit records (how many times each place or AI feature was used, with a SHA-256 hash of your account identifier, or of your IP address if you are not signed in)", strong: true },
          { label: "Purpose", value: "Preventing misuse and runaway costs, responding to security incidents, meeting legal duties", strong: true },
          {
            label: "Basis and how long",
            value:
              "Sign-in records: Protection of Communications Secrets Act Art. 15-2 and its Enforcement Decree Art. 41 (PIPA Art. 15(1)2) — 3 months\n" +
              "Server access records: our legitimate interest in a stable, secure service (PIPA Art. 15(1)6) — deleted automatically after 1 hour\n" +
              "Usage-limit records: the same legitimate interest — counted per minute and per day; records whose period has ended are deleted by a daily job one day later (within 3 days)",
            strong: true,
          },
        ],
      },

      { kind: "heading", text: "3. Children under 14" },
      {
        kind: "text",
        text: "Children under 14 cannot sign in or create an account, and we do not collect their personal data. If we learn that we have, we delete it without delay.",
      },

      { kind: "heading", text: "4. Deletion" },
      {
        kind: "list",
        items: [
          "When you delete your account in Settings > Account, we delete your account details, notebook backup, consent records and paid-use records from our servers without delay. Notebooks on this device stay, so delete them in the App if you want.",
          "When you sign out, we check that everything is backed up to your account, then remove the notebooks from this device so the next person using it can't see them. Sign in again to bring them back.",
          "Electronic files are deleted so they cannot be recovered. We keep no personal data on paper.",
          "If our server provider holds a backup copy, it is removed when that backup expires (within 7 days).",
          "Data we must keep by law (sign-in records, 3 months) is kept apart and deleted without delay when the period ends.",
        ],
      },

      { kind: "heading", text: "5. Sharing with third parties" },
      {
        kind: "text",
        text: "We do not give personal data to third parties, except where a law specifically requires it or an investigative authority asks through the procedure the law sets.",
      },

      { kind: "heading", text: "6. Processors and transfers abroad" },
      {
        kind: "text",
        text: "We use the companies below to process personal data for us, and all of their servers are outside Korea (PIPA Arts. 26 and 28-8). Their data processing agreements bind them to use the data only for our purposes, keep it secure, limit sub-processing and accept liability, and we check that they do.",
      },
      {
        kind: "table",
        caption: "Sign-in and backup server",
        rows: [
          { label: "Recipient", value: `${supabase.company} (${supabase.contact})`, strong: true },
          { label: "Country", value: "Japan (Tokyo data centre, Amazon Web Services)", strong: true },
          { label: "Data", value: "Account details, notebook backup, consent records, sign-in records, usage-limit records (hashes and counts)", strong: true },
          { label: "When and how", value: "Sent over an encrypted connection (HTTPS) when you sign in and whenever a notebook changes" },
          { label: "Task", value: "Signing you in and storing your data", strong: true },
          { label: "How long", value: "Until you delete your account (sign-in records: 3 months; usage-limit records: up to 3 days)", strong: true },
        ],
      },
      {
        kind: "table",
        caption: "App server",
        rows: [
          { label: "Recipient", value: `${vercel.company} (${vercel.contact})`, strong: true },
          { label: "Country", value: "United States (data centre near Washington, D.C.)", strong: true },
          { label: "Data", value: "Sign-in token (contains your account identifier and email), place search text, request records (IP address, time), the content of AI and place requests", strong: true },
          { label: "When and how", value: "Sent over an encrypted connection (HTTPS) when you ask to delete your account, search for a place, or use an AI or place feature" },
          { label: "Task", value: "Deleting accounts and passing place searches and AI and place requests on", strong: true },
          { label: "How long", value: "The request itself is discarded as soon as it is handled and never stored. Place search and suggestion results are reused from server memory for up to 30 minutes with a SHA-256 hash of the request, not linked to your account or IP address. Expired entries are removed when the cache is next accessed. Request records are deleted automatically after 1 hour", strong: true },
        ],
      },
      {
        kind: "table",
        caption: "AI judgement (if you agree to the AI features)",
        rows: [
          { label: "Recipient", value: `${typesafe.company} (${typesafe.contact})`, strong: true },
          { label: "Country", value: "United States", strong: true },
          { label: "Data", value: "The AI and place feature data in section 2", strong: true },
          { label: "When and how", value: "Sent through the app server over an encrypted connection (HTTPS) when you tap an AI feature button" },
          { label: "Task", value: "Judging text and places (AI)", strong: true },
          { label: "How long", value: "Kept only as long as processing needs under its data processing agreement, then deleted. Never used to train AI", strong: true },
        ],
      },
      {
        kind: "text",
        text: `When you search for a place or use place suggestions, our server sends ${google.company} (United States) place search only the search text (or the destination and kind of place), never anything that identifies you.`,
      },
      {
        kind: "text",
        text: "How to refuse and what happens: if you don't agree on the consent screen before signing in, or you delete your account after agreeing, nothing goes to Supabase or Vercel. If you don't agree to the AI and place features, or withdraw that consent in Settings, nothing goes to TypeSafe or Google. Either way you can keep using your notebooks on this device without signing in.",
      },

      { kind: "heading", text: "7. Outside services the App connects to" },
      {
        kind: "list",
        items: [
          lang === "ja"
            ? "為替レート：別の通貨で支出を記録すると、端末はFrankfurter（api.frankfurter.dev、欧州中央銀行の参考レート）に2つの通貨コードを送ってレートを取得します。このリクエストで端末のIPアドレスも同サービスに送られます。"
            : "Exchange rates: when you record an expense in another currency, your device sends two currency codes to Frankfurter (api.frankfurter.dev, European Central Bank reference rates). That request also sends your device's IP address to the service.",
          "Maps and links: when you open a map or a booking site link, the address goes to that service (for example Google Maps) and its privacy policy applies.",
          "Sign in with Apple: Apple gives us your email (or a hidden relay address) and an identifier. Apple manages your Apple ID details.",
          "Google or Kakao sign-in (when the App offers it): the sign-in page belongs to Google LLC (United States) or Kakao Corp. (Korea), and that company gives our sign-in server (Supabase) your email, an identifier, your name (nickname) and profile photo address. That company manages your account details there, and its privacy policy applies.",
          "Email sign-in: Supabase sends a sign-in link to the email address you enter.",
          "Maps: the Plan tab shows Google Maps (Google LLC, United States) inside the App. While you look at the map, your device requests it directly from Google, and the Google Maps SDK may collect your IP address, a device identifier, and map usage, performance and error information for Google's analytics and to provide the service; Google's privacy policy applies. It is not used for ad tracking, and the App never uses your location. Place photos in Explore are also fetched by your device directly from Google, so Google may receive device information such as your IP address.",
        ],
      },

      { kind: "heading", text: "8. Your rights and how to use them" },
      {
        kind: "list",
        items: [
          "You can ask at any time to see, correct or delete your personal data, to stop its processing, or to withdraw consent.",
          "In the App: view, edit and delete notebook content; delete your account in Settings > Account (removes everything on our servers); withdraw AI and place consent in Settings > Privacy and terms.",
          `By email: ${op.email}. We act within 10 days of receiving your request and tell you the outcome.`,
          `To ask for account deletion without the App: ${PUBLIC_LEGAL_URLS.accountDeletion}`,
          "A legal representative or someone you authorise can ask for you; we may ask for a letter of authorisation.",
          "Data another law requires us to keep may be kept for that period even if you ask for deletion.",
          "We make no fully automated decisions that significantly affect your rights or obligations. AI results are only suggestions, and you confirm them before anything changes in your notebook.",
        ],
      },

      { kind: "heading", text: "9. How we keep data safe" },
      {
        kind: "list",
        items: [
          "Management: only the operator handles personal data, and our service accounts use two-step verification.",
          "In transit: all connections are encrypted (HTTPS).",
          "At rest: server storage is encrypted, and access controls let members reach only their own data. Server secret keys stay on the server and are never put in the App.",
          "Minimisation: booking codes, emails, phone and card numbers are hidden on the device before anything goes to an AI feature.",
        ],
      },

      { kind: "heading", text: "10. Cookies and similar technology" },
      {
        kind: "text",
        text: "Neither the App nor its web version uses cookies, advertising identifiers, analytics or tracking tools, and neither collects behavioural data. The mobile app stores only what keeps you signed in, on your device.",
      },
      {
        kind: "list",
        items: [
          "Browser storage in the web version: your notebooks (IndexedDB, or localStorage if that is unavailable) and the personal access code for place search (localStorage) are stored in this browser. Notebooks are never sent to our servers; the access code goes to our app server only when you search for a place. So the screens open offline, the App's own page files are kept in a service worker cache (no personal data).",
          "How long and how to delete: it stays until you remove it. Notebooks can be cleared with '여행 데이터 초기화' (Reset trip data) on the web version's info screen; to remove the access code as well, clear this site's data in your browser settings.",
          "There are no cookies that track you or serve ads, so we show no cookie consent banner. If we ever add such tools, we will tell you first and ask for consent.",
        ],
      },

      { kind: "heading", text: "11. Privacy officer and contact" },
      {
        kind: "table",
        rows: [
          { label: "Privacy officer", value: op.officer },
          { label: "Contact", value: op.email },
        ],
      },
      { kind: "text", text: "Send privacy questions, complaints and requests for help to the contact above. We will answer and act without delay." },

      { kind: "heading", text: "12. Where else to get help" },
      { kind: "text", text: "For advice or dispute resolution about personal data, you can also contact these Korean bodies." },
      {
        kind: "list",
        items: [
          "Personal Information Dispute Mediation Committee: 1833-6972, www.kopico.go.kr",
          "Personal Information Infringement Report Center (KISA): 118, privacy.kisa.or.kr",
          "Supreme Prosecutors' Office: 1301, www.spo.go.kr",
          "Korean National Police Agency: 182, ecrm.police.go.kr",
        ],
      },

      { kind: "heading", text: "13. Changes to this policy" },
      {
        kind: "text",
        text: `This policy applies from ${legalDate("en", LEGAL_VERSION)}. If we change it, we announce the change in the App at least 7 days before it takes effect (30 days for changes that are important or unfavourable to you) and ask for consent again where needed. This policy is also available at ${PUBLIC_LEGAL_URLS.privacy}.`,
      },
    ],
  };
}
