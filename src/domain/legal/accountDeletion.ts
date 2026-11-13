import { OPERATOR, PUBLIC_LEGAL_URLS, operatorText, type LegalDocument, type LegalLang } from "./legal";

// 계정·데이터 삭제 안내. Google Play의 "앱 밖 삭제 요청 URL"과 App Store 심사에 내는 공개 페이지다.
// 앱 이름·운영자, 앱에서 지우는 순서, 앱 없이 요청하는 방법, 지우는 정보와 남는 정보·기간을 모두 적어야 한다.
// 기간은 처리방침(privacyPolicy.ts)과 같아야 하므로 함께 고친다. 동의 대상 문서가 아니라서 판(LEGAL_VERSION)을 따로 두지 않는다.

export interface AccountDeletionPage extends Omit<LegalDocument, "id" | "version" | "effective"> {
  id: "account-deletion";
  /** 앱 없이 삭제를 요청하는 메일. 운영자 이메일이 비어 있으면 null. */
  request: { email: string; subject: string; body: string; label: string } | null;
}

interface Copy {
  title: string;
  lead: string;
  inApp: { heading: string; steps: string[]; note: string };
  byEmail: { heading: string; text: string; items: string[]; label: string; subject: string; body: string };
  deleted: { heading: string; items: string[] };
  kept: { heading: string; items: string[] };
  web: { heading: string; text: string };
  more: string;
}

const COPY: Record<LegalLang, (op: { name: string; email: string }) => Copy> = {
  ko: (op) => ({
    title: "계정·데이터 삭제",
    lead: `Escale(운영자 ${op.name})의 계정과 서버에 저장된 정보를 지우는 방법입니다.`,
    inApp: {
      heading: "앱에서 바로 삭제하기",
      steps: [
        "앱을 열고 서재 왼쪽 위의 설정(톱니바퀴)을 누릅니다.",
        "계정에서 '계정 삭제'를 누릅니다.",
        "확인 창에서 '계정 삭제'를 한 번 더 누르면 바로 지워집니다.",
      ],
      note: "삭제는 되돌릴 수 없습니다. 이 기기의 수첩은 남으니, 필요하면 먼저 설정 > 백업에서 파일로 내보내세요.",
    },
    byEmail: {
      heading: "앱 없이 삭제 요청하기",
      text: `앱을 지웠거나 열 수 없다면 ${op.email}로 메일을 보내 주세요. 받은 날부터 10일 안에 삭제하고 결과를 알려 드립니다.`,
      items: [
        "로그인에 쓴 이메일 주소에서 보내 주세요. 다른 주소에서 보내면 본인 확인을 위해 추가 정보를 여쭐 수 있습니다.",
        "Apple의 '나의 이메일 가리기'로 가입했다면 로그인 방법(Apple)과 가입한 대략의 날짜를 함께 적어 주세요.",
      ],
      label: "삭제 요청 메일 쓰기",
      subject: "Escale 계정 삭제 요청",
      body: "Escale 계정 삭제를 요청합니다.\n로그인 방법(Apple·Google·카카오·이메일):\n로그인 이메일:\n",
    },
    deleted: {
      heading: "지우는 정보",
      items: [
        "계정 정보: 이메일 주소, 로그인 식별자, 로그인 방식, 로그인 사업자가 전달한 이름(닉네임)과 프로필 사진 주소",
        "계정에 백업된 수첩 전체",
        "동의 기록, 유료 이용 권한 기록, 둘러보기 이용 기록",
      ],
    },
    kept: {
      heading: "남는 정보와 기간",
      items: [
        "로그인 기록(로그인 일시, IP 주소): 통신비밀보호법에 따라 3개월 보관한 뒤 삭제",
        "서버 사업자의 백업본: 최대 7일 뒤 함께 삭제",
        "이용 한도 기록(계정 식별자의 해시값과 횟수): 최대 3일 뒤 삭제",
        "장소 검색·추천 조건의 SHA-256 해시값과 장소 결과: 계정·IP와 연결하지 않고 앱 서버 메모리에서 최대 30분 재사용. 만료된 항목은 다음 캐시 조회 때 삭제",
        "앱 서버의 요청 기록(IP 주소, 시각): 1시간 뒤 자동 삭제",
        "이 기기나 브라우저에 있는 수첩, 직접 내보낸 백업 파일: 운영자 서버에 있지 않으므로 이용자가 직접 지웁니다",
      ],
    },
    web: {
      heading: "웹 버전",
      text: "웹 버전에는 계정이 없고 수첩은 이 브라우저에만 저장됩니다. 정보 화면의 '여행 데이터 초기화'를 누르거나 브라우저 설정에서 이 사이트의 데이터를 삭제하면 지워집니다.",
    },
    more: `자세한 내용은 개인정보 처리방침(${PUBLIC_LEGAL_URLS.privacy})에 있습니다.`,
  }),
  en: (op) => ({
    title: "Delete your account and data",
    lead: `How to delete your Escale account and the data on our servers. Escale is run by ${op.name}.`,
    inApp: {
      heading: "Delete in the App",
      steps: [
        "Open the App and tap Settings (the gear) at the top left of your library.",
        "Under Account, tap 'Delete account'.",
        "Tap 'Delete account' again to confirm. It is deleted straight away.",
      ],
      note: "This can't be undone. Notebooks on your device stay, so export them first in Settings > Backup if you want a copy.",
    },
    byEmail: {
      heading: "Ask without the App",
      text: `If you've removed the App or can't open it, email ${op.email}. We delete your account within 10 days of receiving the request and tell you when it's done.`,
      items: [
        "Send it from the email address you sign in with. If you write from another address, we may ask for more details to confirm it's you.",
        "If you signed up with Apple's Hide My Email, tell us your sign-in method (Apple) and roughly when you signed up.",
      ],
      label: "Write a deletion request",
      subject: "Escale account deletion request",
      body: "Please delete my Escale account.\nSign-in method (Apple, Google, Kakao or email):\nSign-in email:\n",
    },
    deleted: {
      heading: "What we delete",
      items: [
        "Account details: email address, sign-in identifier, sign-in method, and the name (nickname) and profile photo address your sign-in provider shared",
        "Every notebook backed up to your account",
        "Consent records, paid-access records and Explore usage records",
      ],
    },
    kept: {
      heading: "What stays, and for how long",
      items: [
        "Sign-in records (time, IP address): kept for 3 months under Korea's Protection of Communications Secrets Act, then deleted",
        "Our server provider's backups: removed within 7 days",
        "Usage-limit records (a hash of your account identifier and counts): deleted within 3 days",
        "A SHA-256 hash of place search and suggestion conditions, and place results: reused from app server memory for up to 30 minutes without a link to your account or IP address. Expired entries are removed when the cache is next accessed",
        "App server request records (IP address, time): deleted automatically after 1 hour",
        "Notebooks on your device or in your browser, and backup files you exported: these aren't on our servers, so you delete them yourself",
      ],
    },
    web: {
      heading: "Web version",
      text: "The web version has no account; notebooks are stored only in your browser. Tap '여행 데이터 초기화' (Reset trip data) on its info screen, or clear this site's data in your browser settings.",
    },
    more: `See the privacy policy (${PUBLIC_LEGAL_URLS.privacy}) for details.`,
  }),
  ja: (op) => ({
    title: "アカウントとデータの削除",
    lead: `Escale（運営者：${op.name}）のアカウントと、サーバーに保存された情報を削除する方法です。`,
    inApp: {
      heading: "アプリで削除する",
      steps: [
        "アプリを開き、本棚の左上にある設定（歯車）を押します。",
        "「アカウント」の「アカウントを削除」を押します。",
        "確認画面でもう一度「アカウントを削除」を押すと、すぐに削除されます。",
      ],
      note: "削除は取り消せません。この端末のノートは残るので、必要なら先に「設定＞バックアップ」からファイルに書き出してください。",
    },
    byEmail: {
      heading: "アプリなしで削除を依頼する",
      text: `アプリを削除した、または開けない場合は ${op.email} までメールでご連絡ください。受け取った日から10日以内に削除し、結果をお知らせします。`,
      items: [
        "ログインに使ったメールアドレスから送ってください。別のアドレスから送る場合は、本人確認のため追加の情報をお願いすることがあります。",
        "Appleの「メールを非公開」で登録した場合は、ログイン方法（Apple）とおおよその登録日もお書きください。",
      ],
      label: "削除依頼のメールを書く",
      subject: "Escale アカウント削除の依頼",
      body: "Escaleのアカウント削除をお願いします。\nログイン方法（Apple・Google・カカオ・メール）：\nログインのメールアドレス：\n",
    },
    deleted: {
      heading: "削除する情報",
      items: [
        "アカウント情報：メールアドレス、ログイン識別子、ログイン方法、ログイン事業者から届いた名前（ニックネーム）とプロフィール写真のアドレス",
        "アカウントにバックアップされたノートすべて",
        "同意記録、有料機能の権利の記録、「見つける」の利用記録",
      ],
    },
    kept: {
      heading: "残る情報と期間",
      items: [
        "ログイン記録（ログイン日時、IPアドレス）：韓国の通信秘密保護法により3か月保管した後に削除",
        "サーバー事業者のバックアップ：最大7日後に削除",
        "利用上限の記録（アカウント識別子のハッシュ値と回数）：最大3日後に削除",
        "場所の検索・おすすめの条件のSHA-256ハッシュ値と場所の結果：アカウント・IPアドレスと結び付けず、アプリのサーバーのメモリで最大30分再利用。期限切れの項目は次にキャッシュを参照するときに削除",
        "アプリのサーバーのリクエスト記録（IPアドレス、日時）：1時間後に自動で削除",
        "端末やブラウザにあるノート、自分で書き出したバックアップファイル：運営者のサーバーにはないため、ご自身で削除してください",
      ],
    },
    web: {
      heading: "ウェブ版",
      text: "ウェブ版にはアカウントがなく、ノートはこのブラウザにだけ保存されます。情報画面の「여행 데이터 초기화」（旅のデータを初期化）を押すか、ブラウザの設定でこのサイトのデータを削除してください。",
    },
    more: `詳しくは個人情報処理方針（${PUBLIC_LEGAL_URLS.privacy}）をご覧ください。韓国語版が正式な文書です。`,
  }),
};

export function accountDeletionPage(lang: LegalLang, operator = OPERATOR): AccountDeletionPage {
  const op = operatorText(lang, operator);
  const c = COPY[lang](op);
  const email = operator.email.trim();
  return {
    id: "account-deletion",
    title: c.title,
    lead: c.lead,
    blocks: [
      { kind: "heading", text: c.inApp.heading },
      { kind: "list", items: c.inApp.steps },
      { kind: "fine", text: c.inApp.note },
      { kind: "heading", text: c.byEmail.heading },
      { kind: "text", text: c.byEmail.text, strong: true },
      { kind: "list", items: c.byEmail.items },
      { kind: "heading", text: c.deleted.heading },
      { kind: "list", items: c.deleted.items },
      { kind: "heading", text: c.kept.heading },
      { kind: "list", items: c.kept.items },
      { kind: "heading", text: c.web.heading },
      { kind: "text", text: c.web.text },
      { kind: "fine", text: c.more },
    ],
    request: email ? { email, subject: c.byEmail.subject, body: c.byEmail.body, label: c.byEmail.label } : null,
  };
}
