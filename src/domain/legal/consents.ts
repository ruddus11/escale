import { AI_CONSENT_VERSION, LEGAL_VERSION, PROCESSORS, aiDocId, type AiFeature, type LegalDocument, type LegalLang, type LegalLine } from "./legal";

// 동의 화면의 "보기"에서 여는 동의서. 개인정보 보호법 제15조제2항(수집·이용)과 제28조의8제2항(국외 이전)이
// 알리라고 정한 항목을 빠짐없이 적고, 중요한 내용은 strong으로 강조한다.
// 문구를 바꾸면 개인정보 처리방침의 같은 내용도 함께 고친다.

const { supabase, vercel, typesafe, google } = PROCESSORS;

export function collectionConsent(lang: LegalLang): LegalDocument {
  const base = { id: "collection" as const, version: LEGAL_VERSION, effective: LEGAL_VERSION };
  if (lang === "ko")
    return {
      ...base,
      title: "개인정보 수집·이용 동의",
      blocks: [
        { kind: "text", text: "Escale는 계정 로그인과 수첩 백업을 위해 아래와 같이 개인정보를 수집·이용합니다." },
        {
          kind: "table",
          rows: [
            { label: "목적", value: "회원 확인과 로그인, 수첩 백업과 다른 기기에서 불러오기, 장소 찾기와 지도 표시, 둘러보기 검색 횟수 한도 적용, 동의 기록 보관, 문의 응대", strong: true },
            {
              label: "항목",
              value:
                "계정: 이메일 주소(Apple로 로그인하면 Apple이 전달하는 이메일 또는 가린 이메일), 로그인 식별자, 로그인 방식. Google·카카오로 로그인하면 그 사업자가 전달하는 이름(닉네임)과 프로필 사진 주소\n" +
                "수첩 백업: 이 기기의 수첩 전체(여행 이름·여행지·기간, 동행자 이름, 예약 기본정보, 일정·장소·기록·준비물, 경비, 메모에 직접 적은 내용)\n" +
                "장소 찾기·둘러보기: 입력한 검색어, 여행지 이름과 장소 종류, 숙소 근처로 찾을 때 숙소 위치(약 100m 단위)(모두 저장하지 않음)와 고른 장소의 Google 장소 ID\n" +
                "둘러보기 이용 기록: 검색한 시각과 성공 여부(검색어와 위치는 남기지 않음)\n" +
                "동의 기록: 동의한 문서의 판과 동의 시각",
              strong: true,
            },
            {
              label: "보유·이용 기간",
              value: "계정을 삭제할 때까지. 삭제하면 지체 없이 파기합니다. 단, 로그인 기록(접속 일시·IP 주소)은 통신비밀보호법에 따라 3개월 보관한 뒤 파기하고, 둘러보기 이용 기록은 2개월 뒤 파기합니다.",
              strong: true,
            },
          ],
        },
        { kind: "text", text: "동의를 거부할 권리가 있습니다. 거부하면 로그인과 계정 백업을 쓸 수 없지만, 로그인하지 않고 이 기기에서 수첩을 계속 쓸 수 있습니다." },
        { kind: "text", text: "자세한 내용은 개인정보 처리방침에서 확인할 수 있습니다." },
      ],
    };
  if (lang === "ja")
    return {
      ...base,
      title: "個人情報の収集・利用への同意",
      blocks: [
        { kind: "text", text: "Escale（エスカル）は、アカウントへのログインとノートのバックアップのため、次のとおり個人情報を収集・利用します。" },
        {
          kind: "table",
          rows: [
            { label: "目的", value: "会員の確認とログイン、ノートのバックアップと他の端末への読み込み、場所の検索と地図表示、「見つける」の検索回数の上限管理、同意記録の保管、お問い合わせへの対応", strong: true },
            {
              label: "項目",
              value:
                "アカウント：メールアドレス（Appleでログインした場合はAppleから届くメール、または非公開のメール）、ログイン識別子、ログイン方法。Google・カカオでログインした場合は、その事業者から届く名前（ニックネーム）とプロフィール写真のアドレス\n" +
                "ノートのバックアップ：この端末のノート全体（旅の名前・行き先・期間、同行者の名前、予約の基本情報、予定・場所・記録・持ち物、費用、メモに書いた内容）\n" +
                "場所の検索・見つける：入力した検索語、行き先の名前と場所の種類、宿の近くで探すときの宿の位置（約100m単位）（いずれも保存しません）と選んだ場所のGoogleプレイスID\n" +
                "「見つける」の利用記録：検索した日時と成否（検索語と位置は残しません）\n" +
                "同意記録：同意した文書の版と同意した日時",
              strong: true,
            },
            {
              label: "保有・利用期間",
              value: "アカウントを削除するまで。削除するとすぐに破棄します。ただし、ログイン記録（接続日時・IPアドレス）は韓国の通信秘密保護法により3か月保管した後に破棄し、「見つける」の利用記録は2か月後に破棄します。",
              strong: true,
            },
          ],
        },
        { kind: "text", text: "同意を拒否する権利があります。拒否するとログインとアカウントのバックアップは使えませんが、ログインせずにこの端末でノートを使い続けられます。" },
        { kind: "text", text: "詳しくは個人情報処理方針をご覧ください。" },
      ],
    };
  return {
    ...base,
    title: "Consent to collect and use personal data",
    blocks: [
      { kind: "text", text: "Escale collects and uses the personal data below to sign you in and back up your notebooks." },
      {
        kind: "table",
        rows: [
          { label: "Purpose", value: "Confirming members and signing in, backing up notebooks and loading them on other devices, finding places and showing them on the map, applying the Explore search limit, keeping consent records, answering enquiries", strong: true },
          {
            label: "Data",
            value:
              "Account: email address (with Sign in with Apple, the email Apple shares or a hidden relay address), sign-in identifier, sign-in method. With Google or Kakao sign-in, the name (nickname) and profile photo address that company shares\n" +
              "Notebook backup: every notebook on this device (trip name, destination and dates, travel companions' names, booking basics, plans, places, stories, packing lists, expenses, and anything you type into notes)\n" +
              "Place search and browsing: what you type, the destination name and kind of place, and your stay's location rounded to about 100 m when you browse near it (none of these are stored), plus the Google place ID of the place you pick\n" +
              "Explore usage record: when you searched and whether it worked (no search text or location)\n" +
              "Consent record: the version of the documents you agreed to and when",
            strong: true,
          },
          {
            label: "How long",
            value: "Until you delete your account, then deleted without delay. Sign-in records (time and IP address) are kept for 3 months under Korea's Protection of Communications Secrets Act, then deleted, and Explore usage records are deleted after 2 months.",
            strong: true,
          },
        ],
      },
      { kind: "text", text: "You may refuse. If you do, you can't sign in or back up to an account, but you can keep using your notebooks on this device without signing in." },
      { kind: "text", text: "See the privacy policy for details." },
    ],
  };
}

export function overseasConsent(lang: LegalLang): LegalDocument {
  const base = { id: "overseas" as const, version: LEGAL_VERSION, effective: LEGAL_VERSION };
  if (lang === "ko")
    return {
      ...base,
      title: "개인정보 국외 이전 동의",
      blocks: [
        { kind: "text", text: "계정과 수첩 백업은 아래 해외 사업자의 서버에 저장·처리됩니다. 운영자는 각 사업자와 맺은 데이터 처리 약정에 따라 안전하게 처리되도록 관리합니다." },
        {
          kind: "table",
          caption: "로그인·백업 서버",
          rows: [
            { label: "받는 자", value: `${supabase.company} (${supabase.contact})`, strong: true },
            { label: "국가", value: "일본(도쿄 데이터센터, Amazon Web Services)", strong: true },
            { label: "항목", value: "계정 정보(이메일 주소, 로그인 식별자), 수첩 백업, 동의 기록, 로그인 기록, 둘러보기 이용 기록, 이용 한도 기록(계정 식별자의 해시값과 횟수)", strong: true },
            { label: "시기·방법", value: "로그인할 때와 수첩이 바뀔 때마다 암호화된 통신(HTTPS)으로 전송" },
            { label: "이용 목적", value: "로그인 처리와 데이터 보관", strong: true },
            { label: "보유·이용 기간", value: "계정을 삭제할 때까지(로그인 기록은 3개월, 둘러보기 이용 기록은 2개월, 이용 한도 기록은 최대 3일)", strong: true },
          ],
        },
        {
          kind: "table",
          caption: "앱 서버",
          rows: [
            { label: "받는 자", value: `${vercel.company} (${vercel.contact})`, strong: true },
            { label: "국가", value: "미국(워싱턴 D.C. 인근 데이터센터)", strong: true },
            { label: "항목", value: "로그인 토큰(계정 식별자와 이메일이 들어 있음), 장소 검색어와 숙소 근처 검색 위치, 요청 기록(IP 주소, 시각)", strong: true },
            { label: "시기·방법", value: "계정 삭제를 요청하거나 장소를 찾을 때 암호화된 통신(HTTPS)으로 전송" },
            { label: "이용 목적", value: "계정 삭제 처리, 장소 찾기 요청 전달", strong: true },
            { label: "보유·이용 기간", value: "검색어·위치 원문은 처리한 즉시 파기하며 저장하지 않음. 장소 결과는 요청의 SHA-256 해시값과 함께 서버 메모리에서 최대 30분 재사용하며 계정·IP 주소와 연결하지 않음. 만료 항목은 다음 캐시 조회 때 삭제. 요청 기록은 1시간 뒤 자동 삭제", strong: true },
          ],
        },
        { kind: "text", text: "거부 방법과 효과: 동의하지 않으면 로그인할 수 없습니다. 동의한 뒤에는 설정 > 계정에서 계정을 삭제해 이전을 멈출 수 있습니다. 어느 경우든 로그인하지 않고 이 기기에서 수첩을 계속 쓸 수 있습니다." },
      ],
    };
  if (lang === "ja")
    return {
      ...base,
      title: "個人情報の国外移転への同意",
      blocks: [
        { kind: "text", text: "アカウントとノートのバックアップは、次の海外事業者のサーバーに保存・処理されます。運営者は各事業者とのデータ処理契約により、安全に処理されるよう管理します。" },
        {
          kind: "table",
          caption: "ログイン・バックアップのサーバー",
          rows: [
            { label: "移転先", value: `${supabase.company}（${supabase.contact}）`, strong: true },
            { label: "国", value: "日本（東京のデータセンター、Amazon Web Services）", strong: true },
            { label: "項目", value: "アカウント情報（メールアドレス、ログイン識別子）、ノートのバックアップ、同意記録、ログイン記録、「見つける」の利用記録、利用上限の記録（アカウント識別子のハッシュ値と回数）", strong: true },
            { label: "時期・方法", value: "ログイン時とノートが変わるたびに暗号化された通信（HTTPS）で送信" },
            { label: "利用目的", value: "ログイン処理とデータの保管", strong: true },
            { label: "保有・利用期間", value: "アカウントを削除するまで（ログイン記録は3か月、「見つける」の利用記録は2か月、利用上限の記録は最大3日）", strong: true },
          ],
        },
        {
          kind: "table",
          caption: "アプリのサーバー",
          rows: [
            { label: "移転先", value: `${vercel.company}（${vercel.contact}）`, strong: true },
            { label: "国", value: "アメリカ（ワシントンD.C.近郊のデータセンター）", strong: true },
            { label: "項目", value: "ログイントークン（アカウント識別子とメールアドレスを含む）、場所の検索語と宿の近くを探すときの位置、リクエスト記録（IPアドレス、日時）", strong: true },
            { label: "時期・方法", value: "アカウントの削除を依頼したとき、場所を検索したときに暗号化された通信（HTTPS）で送信" },
            { label: "利用目的", value: "アカウント削除の処理、場所検索の中継", strong: true },
            { label: "保有・利用期間", value: "検索語・位置そのものは処理後すぐに破棄し、保存しません。場所の結果は、リクエストのSHA-256ハッシュ値とともにサーバーのメモリで最大30分再利用し、アカウント・IPアドレスとは結び付けません。期限切れの項目は次にキャッシュを参照するときに削除します。リクエスト記録は1時間後に自動で削除", strong: true },
          ],
        },
        { kind: "text", text: "拒否の方法と影響：同意しないとログインできません。同意した後は、設定＞アカウントからアカウントを削除すると移転が止まります。どちらの場合も、ログインせずにこの端末でノートを使い続けられます。" },
      ],
    };
  return {
    ...base,
    title: "Consent to transfer personal data abroad",
    blocks: [
      { kind: "text", text: "Your account and notebook backup are stored and processed on the servers of the companies below, outside Korea. We hold each company to a data processing agreement that requires safe handling." },
      {
        kind: "table",
        caption: "Sign-in and backup server",
        rows: [
          { label: "Recipient", value: `${supabase.company} (${supabase.contact})`, strong: true },
          { label: "Country", value: "Japan (Tokyo data centre, Amazon Web Services)", strong: true },
          { label: "Data", value: "Account details (email address, sign-in identifier), notebook backup, consent records, sign-in records, Explore usage records, usage-limit records (a hash of your account identifier and counts)", strong: true },
          { label: "When and how", value: "Sent over an encrypted connection (HTTPS) when you sign in and whenever a notebook changes" },
          { label: "Purpose", value: "Signing you in and storing your data", strong: true },
          { label: "How long", value: "Until you delete your account (sign-in records: 3 months; Explore usage records: 2 months; usage-limit records: up to 3 days)", strong: true },
        ],
      },
      {
        kind: "table",
        caption: "App server",
        rows: [
          { label: "Recipient", value: `${vercel.company} (${vercel.contact})`, strong: true },
          { label: "Country", value: "United States (data centre near Washington, D.C.)", strong: true },
          { label: "Data", value: "Sign-in token (contains your account identifier and email), place search text and the stay location used to browse nearby, request records (IP address, time)", strong: true },
          { label: "When and how", value: "Sent over an encrypted connection (HTTPS) when you ask to delete your account or search for a place" },
          { label: "Purpose", value: "Deleting your account, passing place searches on", strong: true },
          { label: "How long", value: "Search text and location are discarded as soon as the request is handled and never stored. Place results are reused from server memory for up to 30 minutes with a SHA-256 hash of the request, not linked to your account or IP address. Expired entries are removed when the cache is next accessed. Request records are deleted automatically after 1 hour", strong: true },
        ],
      },
      { kind: "text", text: "How to refuse and what happens: without this consent you can't sign in. After agreeing, you can stop the transfer by deleting your account in Settings > Account. Either way, you can keep using your notebooks on this device without signing in." },
    ],
  };
}

// AI·장소 기능 동의는 기능 버튼을 처음 누를 때 시트로 뜬다. 기능마다 그 기능이 보내는 것만 보이고 따로 동의를 받는다.
// 국외 이전 고지 항목(보내는 것, 국가, 시기·방법, 받는 자·연락처, 목적, 보유 기간, 거부 방법)을 모두 보이되,
// 중요한 내용(받는 자와 목적, 보유 기간)만 강조한다.
const contact = (p: { contact: string }) => p.contact.replace(/^https:\/\//, "");

interface AiCopy {
  title: Record<AiFeature, string>;
  lead: Record<AiFeature, string>;
  sendLabel: string;
  send: Record<AiFeature, LegalLine>;
  toLabel: string;
  /** TypeSafe(Jev)가 기능마다 하는 일. */
  jev: Record<AiFeature, string>;
  google: { text: string; note: string };
  vercel: string;
  recommendVercel: string;
  keepLabel: string;
  keep: [string, string];
  recommendKeep: string;
  fine: string;
}

const AI_COPY: Record<LegalLang, AiCopy> = {
  ko: {
    title: { recommend: "장소 추천에\n쓰는 정보", booking: "예약 메일 읽기에\n쓰는 정보", pouch: "Jev로 다시 읽기에\n쓰는 정보" },
    lead: {
      recommend: "추천받기를 누를 때만 아래 정보를 미국 서버로 보내요. Jev는 AI라서 틀릴 수 있으니, 담기 전에 한 번 봐 주세요.",
      booking: "읽어서 채우기를 누를 때만 붙여 넣은 내용을 미국 서버로 보내요. Jev는 AI라서 틀릴 수 있으니, 저장하기 전에 칸을 한 번 봐 주세요.",
      pouch: "Jev로 다시 읽기를 누를 때만 적은 말을 미국 서버로 보내요. Jev는 AI라서 틀릴 수 있으니, 결과를 한 번 봐 주세요.",
    },
    sendLabel: "보내는 것",
    send: {
      recommend: { text: "여행지, 날짜, 인원, 적어 둔 취향", note: "수첩의 예약, 경비, 사진, 동행자 이름은 보내지 않아요. 취향 칸에는 개인정보를 적지 마세요." },
      booking: { text: "붙여 넣은 메일이나 문자", note: "예약번호, 이메일, 전화번호, 카드번호는 폰에서 먼저 가려요" },
      pouch: { text: "적은 한 줄과 준비물 이름", note: "예약번호, 이메일, 전화번호, 카드번호는 폰에서 먼저 가려요" },
    },
    toLabel: "받는 곳 · 미국",
    jev: {
      recommend: "Jev가 여행지와 취향에 맞는 곳을 골라요",
      booking: "Jev가 날짜, 시간, 장소를 골라 칸을 채워요",
      pouch: "Jev가 적은 말이 무슨 뜻인지 판단해요",
    },
    google: { text: "장소를 찾아요", note: "여행지 이름과 장소 종류만 보내요" },
    vercel: "앱 서버예요. 전달만 해요",
    recommendVercel: "앱 서버예요. 요청을 전달하고 같은 조건의 장소 결과를 잠깐 기억해요",
    keepLabel: "보관 기간",
    keep: ["앱 서버는 보낸 원문을 결과를 돌려주면 바로 지워요", "TypeSafe는 약정에 따라 처리에 필요한 기간만 보관하고, AI 학습에 쓰지 않아요"],
    recommendKeep: "장소 추천 조건의 SHA-256 해시값과 장소 결과는 계정·IP와 연결하지 않고 앱 서버 메모리에서 최대 30분 재사용해요. 만료된 항목은 다음 캐시 조회 때 지워요",
    fine: "이 동의는 이 기능에만 써요. 보낼 때마다 HTTPS로 암호화해요. 동의하지 않아도 다른 기능은 그대로 쓸 수 있고, 설정 > 개인정보와 약관에서 언제든 철회할 수 있어요.",
  },
  ja: {
    title: { recommend: "おすすめに\n使う情報", booking: "予約メールの読み取りに\n使う情報", pouch: "Jevの読み直しに\n使う情報" },
    lead: {
      recommend: "「おすすめを見る」を押したときだけ、下の情報をアメリカのサーバーに送ります。JevはAIなので間違うことがあります。保存する前に一度確認してください。",
      booking: "「読み取って入力」を押したときだけ、貼り付けた内容をアメリカのサーバーに送ります。JevはAIなので間違うことがあります。保存する前に欄を一度確認してください。",
      pouch: "「Jevで読み直す」を押したときだけ、入力した言葉をアメリカのサーバーに送ります。JevはAIなので間違うことがあります。結果を一度確認してください。",
    },
    sendLabel: "送るもの",
    send: {
      recommend: { text: "行き先、日付、人数、書いた好み", note: "ノートの予約、支出、写真、同行者の名前は送りません。好みの欄には個人情報を書かないでください。" },
      booking: { text: "貼り付けたメールやメッセージ", note: "予約番号、メール、電話番号、カード番号は端末で先に隠します" },
      pouch: { text: "入力した一行と持ち物の名前", note: "予約番号、メール、電話番号、カード番号は端末で先に隠します" },
    },
    toLabel: "送り先 · アメリカ",
    jev: {
      recommend: "Jevが行き先と好みに合う場所を選びます",
      booking: "Jevが日付、時刻、場所を選んで欄を埋めます",
      pouch: "Jevが入力した言葉の意味を判断します",
    },
    google: { text: "場所を探します", note: "行き先の名前と場所の種類だけを送ります" },
    vercel: "アプリのサーバーです。中継だけします",
    recommendVercel: "アプリのサーバーです。リクエストを中継し、同じ条件の場所の結果を短期間記憶します",
    keepLabel: "保管期間",
    keep: ["アプリのサーバーは送られた元の内容を結果を返したらすぐに消します", "TypeSafeは契約に基づき処理に必要な期間だけ保管し、AIの学習には使いません"],
    recommendKeep: "おすすめの条件のSHA-256ハッシュ値と場所の結果は、アカウント・IPアドレスと結び付けず、アプリのサーバーのメモリで最大30分再利用します。期限切れの項目は次にキャッシュを参照するときに削除します",
    fine: "この同意はこの機能だけに使います。送るたびにHTTPSで暗号化します。同意しなくても他の機能はそのまま使え、設定＞個人情報と規約からいつでも取り消せます。",
  },
  en: {
    title: { recommend: "Sent for\nplace picks", booking: "Sent to read\na booking email", pouch: "Sent when you\nask Jev" },
    lead: {
      recommend: "Only when you tap Get picks, the details below go to servers in the United States. Jev is an AI and can get things wrong, so check a place before you save it.",
      booking: "Only when you tap Read and fill, what you pasted goes to servers in the United States. Jev is an AI and can get things wrong, so check the fields before you save.",
      pouch: "Only when you tap Ask Jev to read it, what you typed goes to servers in the United States. Jev is an AI and can get things wrong, so check the result.",
    },
    sendLabel: "What we send",
    send: {
      recommend: { text: "Destination, dates, number of travellers and the preference you type", note: "Your bookings, expenses, photos and companions' names are not sent. Don't type personal details into the preference." },
      booking: { text: "The email or message you paste", note: "Booking codes, emails, phone and card numbers are masked on your phone first" },
      pouch: { text: "The line you type and your packing item names", note: "Booking codes, emails, phone and card numbers are masked on your phone first" },
    },
    toLabel: "Who receives it · United States",
    jev: {
      recommend: "Jev picks places that fit the destination and your preference",
      booking: "Jev picks the dates, times and places to fill in",
      pouch: "Jev judges what your line means",
    },
    google: { text: "Finds places", note: "Only the destination name and kind of place are sent" },
    vercel: "Our app server. It only passes requests on",
    recommendVercel: "Our app server. It passes the request on and briefly remembers place results for the same conditions",
    keepLabel: "How long it's kept",
    keep: ["Our app server deletes the original content you sent as soon as the result goes back", "TypeSafe keeps it only as long as processing needs under our agreement and never uses it to train AI"],
    recommendKeep: "A SHA-256 hash of the place suggestion conditions and the place results are reused from app server memory for up to 30 minutes, without a link to your account or IP address. Expired entries are removed when the cache is next accessed",
    fine: "This consent covers this feature only. Every request is encrypted with HTTPS. Without agreeing, everything else still works, and you can withdraw any time in Settings > Privacy and terms.",
  },
};

export function aiConsent(feature: AiFeature, lang: LegalLang): LegalDocument {
  const c = AI_COPY[lang];
  return {
    id: aiDocId(feature),
    version: AI_CONSENT_VERSION,
    effective: AI_CONSENT_VERSION.slice(0, 10),
    title: c.title[feature],
    lead: c.lead[feature],
    blocks: [
      {
        kind: "box",
        sections: [
          { label: c.sendLabel, lines: [c.send[feature]] },
          {
            label: c.toLabel,
            strong: true,
            lines: [
              { title: typesafe.company, contact: contact(typesafe), text: c.jev[feature] },
              // 장소 추천만 Google 장소 검색을 쓴다.
              ...(feature === "recommend" ? [{ title: google.company, contact: contact(google), text: c.google.text, note: c.google.note }] : []),
              { title: vercel.company, contact: contact(vercel), text: feature === "recommend" ? c.recommendVercel : c.vercel },
            ],
          },
          { label: c.keepLabel, strong: true, lines: [c.keep[0], ...(feature === "recommend" ? [c.recommendKeep] : []), c.keep[1]].map((text) => ({ text })) },
        ],
      },
      { kind: "fine", text: c.fine },
    ],
  };
}
