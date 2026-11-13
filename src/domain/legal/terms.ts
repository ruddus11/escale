import { LEGAL_VERSION, legalDate, operatorText, type LegalDocument, type LegalLang } from "./legal";

// 이용약관. 정본은 한국어다.
// 약관의 규제에 관한 법률 제7조에 따라 운영자의 고의·중대한 과실 책임은 빼지 않는다.
// 마지막 조항은 App Store로 배포하는 앱이 약관에 넣어야 하는 최소 조건(Apple의 EULA 최소 조건)이다.

export function termsOfService(lang: LegalLang): LegalDocument {
  return lang === "ko" ? korean() : english(lang);
}

function korean(): LegalDocument {
  const op = operatorText("ko");
  return {
    id: "terms",
    title: "이용약관",
    version: LEGAL_VERSION,
    effective: LEGAL_VERSION,
    blocks: [
      { kind: "heading", text: "제1조(목적)" },
      {
        kind: "text",
        text: `이 약관은 ${op.name}(이하 "운영자")가 제공하는 Escale 앱과 관련 서비스(이하 "서비스")의 이용 조건과 절차, 운영자와 이용자의 권리·의무를 정합니다.`,
      },

      { kind: "heading", text: "제2조(정의)" },
      {
        kind: "list",
        items: [
          "\"이용자\"는 이 약관에 따라 서비스를 쓰는 사람입니다.",
          "\"회원\"은 이 약관과 개인정보 처리에 동의하고 로그인한 이용자입니다.",
          "\"수첩\"은 이용자가 앱에 적은 여행, 예약 기본정보, 일정, 장소, 기록, 준비물, 경비 등입니다.",
          "\"유료 기능\"은 운영자가 정한 요금을 내고 쓰는 기능입니다.",
        ],
      },

      { kind: "heading", text: "제3조(약관의 게시와 변경)" },
      {
        kind: "list",
        items: [
          "운영자는 이 약관을 앱 안(설정 > 개인정보와 약관)에 게시합니다.",
          "운영자는 관련 법령을 어기지 않는 범위에서 약관을 바꿀 수 있습니다. 바꿀 때에는 바뀌는 내용과 시행일, 이유를 시행 7일 전(이용자에게 불리하거나 중요한 변경은 30일 전)부터 앱에서 알립니다.",
          "회원에게는 바뀐 약관에 다시 동의를 받습니다. 동의하지 않으면 계정 기능을 쓸 수 없고 계정을 삭제할 수 있으며, 로그인하지 않고 이 기기에서 수첩은 계속 쓸 수 있습니다.",
        ],
      },

      { kind: "heading", text: "제4조(서비스의 내용)" },
      {
        kind: "list",
        items: [
          "기기에 저장하는 여행 수첩(로그인하지 않고 사용)",
          "회원의 수첩 계정 백업과 다른 기기에서 불러오기",
          "환율 조회, 영수증 글자 읽기 같은 보조 기능",
          "회원의 장소 찾기와 계획 지도(Google 지도)",
          "유료 기능(장소 추천, 예약 메일 읽기, AI로 다시 읽기 등). 운영자가 유료 기능을 제공하면 내용과 요금을 구매 화면에 표시합니다.",
        ],
      },

      { kind: "heading", text: "제5조(이용 계약과 회원 가입)" },
      {
        kind: "list",
        items: [
          "만 14세 이상인 사람이 이 약관, 개인정보 수집·이용, 개인정보 국외 이전에 동의하고 로그인하면 회원이 됩니다.",
          "다른 사람의 이메일이나 계정으로 가입하면 안 됩니다. 이런 사실이 확인되면 운영자는 그 계정을 삭제할 수 있습니다.",
        ],
      },

      { kind: "heading", text: "제6조(회원 탈퇴와 이용 제한)" },
      {
        kind: "list",
        items: [
          "회원은 언제든 설정 > 계정에서 계정을 삭제(탈퇴)할 수 있으며, 운영자는 서버의 회원 정보를 지체 없이 삭제합니다. 이 기기에 있는 수첩은 남습니다.",
          "운영자는 회원이 법령이나 이 약관을 어겨 서비스 운영을 심각하게 방해하면 이유를 알리고 이용을 제한할 수 있습니다. 회원은 이에 이의를 제기할 수 있으며, 운영자는 이의가 정당하면 바로 제한을 풉니다.",
        ],
      },

      { kind: "heading", text: "제7조(이용자의 의무)" },
      {
        kind: "list",
        items: [
          "법령과 이 약관을 지켜야 합니다.",
          "동행자 같은 다른 사람의 개인정보는 그 사람이 허락한 범위에서만 적어야 합니다.",
          "예약번호, 여권번호, 출입 비밀번호, 카드번호처럼 민감한 정보는 수첩에 적지 않기를 권합니다. 적은 내용은 계정 백업에 포함됩니다.",
          "서비스를 방해하거나, 정상적이지 않은 방법으로 서버에 접근하거나, 다른 사람의 계정을 쓰면 안 됩니다.",
        ],
      },

      { kind: "heading", text: "제8조(수첩과 앱의 권리)" },
      {
        kind: "list",
        items: [
          "이용자가 적은 수첩의 권리는 이용자에게 있습니다. 운영자는 백업과 불러오기처럼 서비스 제공에 필요한 범위에서만 수첩을 처리합니다.",
          "앱의 디자인, 로고, 프로그램 등의 권리는 운영자에게 있습니다. 앱에 들어 있는 오픈소스 소프트웨어는 각 라이선스를 따릅니다(설정 > 개인정보와 약관 > 오픈소스 라이선스).",
        ],
      },

      { kind: "heading", text: "제9조(참고용 정보와 AI 기능)" },
      {
        kind: "list",
        items: [
          "환율은 유럽중앙은행 기준가를 받아온 참고용 값이라 실제 결제나 환전 환율과 다를 수 있습니다.",
          "영수증 읽기, AI 판단, 장소 추천의 결과는 자동으로 만든 것이라 틀릴 수 있습니다. 이용자는 저장하기 전에 내용을 확인해야 합니다.",
          "예약, 교통, 장소의 영업 정보는 바뀔 수 있으니 원래 예약처와 해당 서비스에서 확인해 주세요. 장소 정보는 Google이 제공합니다.",
        ],
      },

      { kind: "heading", text: "제10조(서비스의 변경과 중단)" },
      {
        kind: "list",
        items: [
          "운영자는 운영상·기술상 필요하면 서비스의 일부를 바꿀 수 있으며, 중요한 변경은 미리 알립니다.",
          "설비 점검이나 고장, 통신 장애, 외부 서비스 장애로 서비스가 잠시 멈출 수 있습니다.",
          "운영자가 계정 백업 서비스를 끝내려면 30일 전에 알리고, 그동안 이용자가 수첩을 백업 파일로 내려받을 수 있게 합니다.",
        ],
      },

      { kind: "heading", text: "제11조(유료 기능)" },
      {
        kind: "list",
        items: [
          "운영자가 유료 기능을 제공하면 App Store의 인앱 결제로 판매하며, 가격·이용 기간·자동 갱신 여부를 구매 전에 표시합니다.",
          "구독 해지와 환불 요청은 Apple 계정 설정에서 할 수 있으며, Apple의 정책과 「전자상거래 등에서의 소비자보호에 관한 법률」 등 관련 법령을 따릅니다.",
          "디지털 콘텐츠의 제공이 시작되면 청약철회가 제한될 수 있으며, 운영자는 그 사실을 구매 전에 분명히 알립니다.",
        ],
      },

      { kind: "heading", text: "제12조(책임의 제한)" },
      {
        kind: "list",
        items: [
          "운영자는 천재지변, 전쟁, 통신 사업자나 외부 서비스(Apple, Supabase, Vercel, Google, TypeSafe, Frankfurter 등)의 장애처럼 운영자가 막을 수 없는 사유로 생긴 손해에 대해 책임을 지지 않습니다.",
          "운영자는 이용자의 잘못(기기 분실, 백업하지 않은 상태에서 앱 삭제, 로그인 수단 관리 소홀 등)으로 생긴 손해에 대해 책임을 지지 않습니다.",
          "운영자는 무료로 제공하는 기능과 관련하여 운영자의 고의 또는 중대한 과실이 없으면 손해배상 책임을 지지 않습니다.",
          "이 조의 내용은 운영자의 고의 또는 중대한 과실로 생긴 손해와, 관련 법령상 배제할 수 없는 책임에는 적용하지 않습니다.",
        ],
      },

      { kind: "heading", text: "제13조(개인정보 보호)" },
      { kind: "text", text: "운영자는 개인정보 처리방침에 따라 이용자의 개인정보를 보호합니다." },

      { kind: "heading", text: "제14조(알림과 문의)" },
      { kind: "text", text: `운영자는 앱 안의 알림이나 회원의 이메일로 알립니다. 서비스에 관한 문의는 ${op.email}로 보내 주세요.` },

      { kind: "heading", text: "제15조(App Store로 받은 앱)" },
      {
        kind: "list",
        items: [
          "이 약관은 이용자와 운영자 사이의 계약이며 Apple Inc.는 당사자가 아닙니다. 앱과 그 내용에 대한 책임은 운영자에게 있습니다.",
          "앱을 쓸 권리는 이용자가 소유하거나 관리하는 Apple 기기에서 App Store 이용 약관의 사용 규칙이 허용하는 범위로 한정되며, 다른 사람에게 넘길 수 없습니다.",
          "Apple은 앱의 유지·관리와 지원에 대한 의무를 지지 않습니다.",
          "앱이 적용되는 보증에 맞지 않으면 이용자는 Apple에 알려 구매 금액을 환불받을 수 있으며, 법이 허용하는 범위에서 Apple은 앱에 대해 그 밖의 보증 의무를 지지 않습니다.",
          "앱과 관련한 제조물 책임, 법령·규제 위반, 소비자 보호 관련 청구와 앱이 제3자의 지식재산권을 침해한다는 주장은 Apple이 아니라 운영자가 처리합니다.",
          "이용자는 미국 정부의 금수 조치 대상국이나 테러 지원국으로 지정된 나라에 있지 않고, 미국 정부의 거래 금지·제한 명단에 올라 있지 않음을 확인합니다.",
          "Apple Inc.와 그 자회사는 이 약관의 제3자 수익자이며, 이용자가 약관에 동의하면 이용자에 대해 이 약관을 집행할 권리를 갖습니다.",
        ],
      },

      { kind: "heading", text: "제16조(준거법과 분쟁 해결)" },
      {
        kind: "list",
        items: [
          "이 약관은 대한민국 법을 따릅니다.",
          "분쟁이 생기면 운영자와 이용자는 성실히 협의하며, 협의가 되지 않으면 민사소송법에 따른 관할 법원에서 해결합니다.",
        ],
      },

      { kind: "heading", text: "부칙" },
      { kind: "text", text: `이 약관은 ${legalDate("ko", LEGAL_VERSION)}부터 적용합니다.` },
    ],
  };
}

function english(lang: LegalLang): LegalDocument {
  const op = operatorText("en");
  return {
    id: "terms",
    title: "Terms of service",
    version: LEGAL_VERSION,
    effective: LEGAL_VERSION,
    notice:
      lang === "ja"
        ? "正式な文書は韓国語版です。日本語訳はまだないため、英語の参考訳を表示しています。"
        : "This is a translation for reference. If it differs from the Korean version, the Korean version applies.",
    blocks: [
      { kind: "heading", text: "1. Purpose" },
      {
        kind: "text",
        text: `These terms set out how you may use the Escale app and related services (the "Service") provided by ${op.name} ("we"), and the rights and duties of you and us.`,
      },

      { kind: "heading", text: "2. Definitions" },
      {
        kind: "list",
        items: [
          "\"User\" means anyone who uses the Service under these terms.",
          "\"Member\" means a user who has agreed to these terms and to the processing of personal data, and has signed in.",
          "\"Notebook\" means the trips, booking basics, plans, places, stories, packing lists, expenses and other content a user enters in the App.",
          "\"Paid features\" means features you pay a fee we set to use.",
        ],
      },

      { kind: "heading", text: "3. Posting and changing these terms" },
      {
        kind: "list",
        items: [
          "We post these terms in the App (Settings > Privacy and terms).",
          "We may change these terms within the law. We announce what changes, when and why in the App at least 7 days before the change takes effect (30 days for changes that are important or unfavourable to you).",
          "We ask members to agree to changed terms. If you don't agree, you can't use account features and may delete your account; you can still use your notebooks on this device without signing in.",
        ],
      },

      { kind: "heading", text: "4. What the Service includes" },
      {
        kind: "list",
        items: [
          "Travel notebooks stored on your device (no sign-in needed)",
          "Account backup of notebooks for members, and loading them on other devices",
          "Helpers such as exchange rates and reading text from receipts",
          "Place search and the plan map (Google Maps) for members",
          "Paid features (place suggestions, reading booking emails, asking AI to re-read, and so on). If we offer paid features, we show what they include and cost on the purchase screen.",
        ],
      },

      { kind: "heading", text: "5. Becoming a member" },
      {
        kind: "list",
        items: [
          "Anyone aged 14 or over becomes a member by agreeing to these terms, to the collection and use of personal data and to its transfer abroad, and then signing in.",
          "You must not sign up with someone else's email or account. If we find that you have, we may delete that account.",
        ],
      },

      { kind: "heading", text: "6. Leaving and restrictions" },
      {
        kind: "list",
        items: [
          "Members can delete their account at any time in Settings > Account, and we delete member data from our servers without delay. Notebooks on the device stay.",
          "If a member breaks the law or these terms in a way that seriously disrupts the Service, we may restrict their use after telling them why. Members may object, and we lift the restriction straight away if the objection is justified.",
        ],
      },

      { kind: "heading", text: "7. Your responsibilities" },
      {
        kind: "list",
        items: [
          "Follow the law and these terms.",
          "Enter other people's personal data, such as travel companions', only as far as they allow.",
          "We recommend not writing sensitive details such as booking codes, passport numbers, door codes or card numbers in your notebook. Whatever you write is included in your account backup.",
          "Do not disrupt the Service, access our servers by improper means, or use someone else's account.",
        ],
      },

      { kind: "heading", text: "8. Rights in notebooks and the App" },
      {
        kind: "list",
        items: [
          "Your notebook content belongs to you. We process it only as needed to provide the Service, such as backup and loading.",
          "The App's design, logo, software and other materials belong to us. Open-source software in the App follows its own licences (Settings > Privacy and terms > Open-source licences).",
        ],
      },

      { kind: "heading", text: "9. Reference information and AI features" },
      {
        kind: "list",
        items: [
          "Exchange rates are European Central Bank reference rates for information only and may differ from the rates you actually pay or exchange at.",
          "Receipt reading, AI judgements and place suggestions are produced automatically and can be wrong. Check them before you save.",
          "Bookings, transport and opening details can change, so confirm them with the original booking provider and the service concerned. Place information is provided by Google.",
        ],
      },

      { kind: "heading", text: "10. Changes to and interruption of the Service" },
      {
        kind: "list",
        items: [
          "We may change parts of the Service for operational or technical reasons and will announce important changes in advance.",
          "The Service may pause for maintenance, faults, network problems or outages at outside services.",
          "If we end the account backup service, we tell you 30 days ahead and let you download your notebooks as a backup file in the meantime.",
        ],
      },

      { kind: "heading", text: "11. Paid features" },
      {
        kind: "list",
        items: [
          "If we offer paid features, we sell them through App Store in-app purchase and show the price, period and whether it renews automatically before you buy.",
          "You can cancel subscriptions and ask for refunds in your Apple account settings, under Apple's policies and Korea's Act on Consumer Protection in Electronic Commerce and other applicable laws.",
          "Once digital content starts being provided, the right to withdraw may be limited; we will tell you clearly before you buy.",
        ],
      },

      { kind: "heading", text: "12. Limits of liability" },
      {
        kind: "list",
        items: [
          "We are not liable for loss caused by events we cannot prevent, such as natural disasters, war, or outages at network operators or outside services (Apple, Supabase, Vercel, Google, TypeSafe, Frankfurter and others).",
          "We are not liable for loss caused by the user's own fault, such as losing the device, deleting the App without a backup, or not looking after sign-in details.",
          "For features provided free of charge, we are not liable for damages unless we acted intentionally or with gross negligence.",
          "Nothing in this section limits liability for loss caused by our intent or gross negligence, or any liability that the law does not allow to be excluded.",
        ],
      },

      { kind: "heading", text: "13. Personal data" },
      { kind: "text", text: "We protect your personal data as described in our privacy policy." },

      { kind: "heading", text: "14. Notices and contact" },
      { kind: "text", text: `We send notices in the App or to members' email addresses. Questions about the Service can go to ${op.email}.` },

      { kind: "heading", text: "15. If you got the App from the App Store" },
      {
        kind: "list",
        items: [
          "These terms are between you and us, not Apple Inc. We, not Apple, are responsible for the App and its content.",
          "Your right to use the App is limited to Apple devices you own or control, as the Usage Rules in the App Store Terms of Service allow, and cannot be transferred.",
          "Apple has no obligation to provide maintenance or support for the App.",
          "If the App fails to meet an applicable warranty, you may notify Apple for a refund of the purchase price; to the extent the law allows, Apple has no other warranty obligation for the App.",
          "We, not Apple, handle claims about the App, including product liability, failure to meet legal or regulatory requirements, consumer protection claims, and claims that the App infringes someone's intellectual property.",
          "You confirm that you are not in a country under US government embargo or listed as a terrorist-supporting country, and not on any US government list of prohibited or restricted parties.",
          "Apple Inc. and its subsidiaries are third-party beneficiaries of these terms and, once you accept them, may enforce them against you.",
        ],
      },

      { kind: "heading", text: "16. Governing law and disputes" },
      {
        kind: "list",
        items: [
          "These terms are governed by the laws of the Republic of Korea.",
          "We will try in good faith to settle any dispute with you; if we can't, it goes to the court with jurisdiction under Korea's Civil Procedure Act.",
        ],
      },

      { kind: "heading", text: "Effective date" },
      { kind: "text", text: `These terms apply from ${legalDate("en", LEGAL_VERSION)}.` },
    ],
  };
}
