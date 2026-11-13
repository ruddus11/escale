export interface HotelInformation {
  nameKo: string;
  nameJa: string;
  addressKo: string;
  addressJa: string;
  phone: string;
  phoneHref: string;
  checkIn: string;
  checkOut: string;
  accessNote: string;
  officialUrl: string;
  mapsUrl: string;
}

export interface FlightInformation {
  id: string;
  direction: "outbound" | "return";
  directionLabel: string;
  dateLabel: string;
  flightNumber: string;
  departureTime: string;
  departureAirport: string;
  arrivalTime: string;
  arrivalAirport: string;
  durationLabel: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  detail: string;
  phone: string;
  phoneHref: string;
  officialUrl?: string;
}

export interface OfficialInformationLink {
  id: string;
  category: "flight" | "transit" | "festival";
  title: string;
  detail: string;
  url: string;
}

const hotelMapQuery = new URLSearchParams({
  api: "1",
  query: "アートホテル大阪ベイタワー 大阪府大阪市港区弁天1-2-1",
});

export const tripInfo: {
  hotel: HotelInformation;
  flights: FlightInformation[];
  emergencyContacts: EmergencyContact[];
  officialLinks: OfficialInformationLink[];
} = {
  hotel: {
    nameKo: "아트 호텔 오사카 베이 타워",
    nameJa: "アートホテル大阪ベイタワー",
    addressKo: "오사카부 오사카시 미나토구 벤텐 1-2-1",
    addressJa: "〒552-0007 大阪府大阪市港区弁天1-2-1",
    phone: "+81-6-6577-1111",
    phoneHref: "tel:+81665771111",
    checkIn: "15:00",
    checkOut: "11:00",
    accessNote: "JR 오사카 순환선·Osaka Metro 주오선 벤텐초역 직결",
    officialUrl: "https://www.mystays.com/hotel-art-hotel-osaka/",
    mapsUrl: `https://www.google.com/maps/search/?${hotelMapQuery.toString()}`,
  },
  flights: [
    {
      id: "tw327-2026-07-20",
      direction: "outbound",
      directionLabel: "가는편",
      dateLabel: "7월 20일 월요일",
      flightNumber: "TW327",
      departureTime: "10:55",
      departureAirport: "CJJ 청주국제공항",
      arrivalTime: "12:40",
      arrivalAirport: "KIX 간사이국제공항 T1",
      durationLabel: "1시간 45분",
    },
    {
      id: "tw328-2026-07-24",
      direction: "return",
      directionLabel: "오는편",
      dateLabel: "7월 24일 금요일",
      flightNumber: "TW328",
      departureTime: "13:40",
      departureAirport: "KIX 간사이국제공항 T1",
      arrivalTime: "15:20",
      arrivalAirport: "CJJ 청주국제공항",
      durationLabel: "1시간 40분",
    },
  ],
  emergencyContacts: [
    {
      id: "police",
      name: "경찰",
      detail: "사건·사고 긴급 신고",
      phone: "110",
      phoneHref: "tel:110",
      officialUrl: "https://www.jnto.go.jp/emergency/eng/mi_guide.html",
    },
    {
      id: "fire-ambulance",
      name: "구급·소방",
      detail: "응급환자·화재",
      phone: "119",
      phoneHref: "tel:119",
      officialUrl: "https://www.jnto.go.jp/emergency/eng/mi_guide.html",
    },
    {
      id: "jnto-hotline",
      name: "Japan Visitor Hotline",
      detail: "JNTO 24시간 다국어 여행 지원",
      phone: "+81-50-3816-2787",
      phoneHref: "tel:+815038162787",
      officialUrl: "https://www.jnto.go.jp/emergency/eng/mi_guide.html",
    },
    {
      id: "consulate-business",
      name: "주오사카 대한민국 총영사관",
      detail: "근무시간 대표전화",
      phone: "+81-6-4256-2345",
      phoneHref: "tel:+81642562345",
      officialUrl: "https://overseas.mofa.go.kr/jp-osaka-ko/index.do",
    },
    {
      id: "consulate-emergency",
      name: "총영사관 긴급전화",
      detail: "근무시간 외 긴급 상황",
      phone: "+81-90-3050-0746",
      phoneHref: "tel:+819030500746",
      officialUrl: "https://overseas.mofa.go.kr/jp-osaka-ko/index.do",
    },
    {
      id: "consular-safety-center",
      name: "영사안전콜센터",
      detail: "한국 24시간·유료",
      phone: "+82-2-3210-0404",
      phoneHref: "tel:+82232100404",
      officialUrl: "https://overseas.mofa.go.kr/jp-osaka-ko/index.do",
    },
  ],
  officialLinks: [
    {
      id: "gion-ato-official-map",
      category: "festival",
      title: "기온마츠리 아토마츠리 공식 GPS 지도",
      detail: "7월 21~23일 · 현재 위치와 야마호코 확인",
      url: "https://gionmatsuri.stroly.com/ato/en",
    },
    {
      id: "tway-online-checkin",
      category: "flight",
      title: "티웨이 온라인 체크인",
      detail: "국제선 출발 24시간~1시간 전 · 위탁수하물은 카운터",
      url: "https://www.twayair.com/app/serviceInfo/contents/1121",
    },
    {
      id: "tway-airport-checkin-deadline",
      category: "flight",
      title: "티웨이 국제선 탑승수속 마감",
      detail: "출발 50분 전 마감 · TW327 기준 10:05",
      url: "https://www.twayair.com/app/customerCenter/faq?faqSeq=252",
    },
    {
      id: "tway-flight-status",
      category: "flight",
      title: "티웨이 출·도착 조회",
      detail: "TW327·TW328 당일 운항 확인",
      url: "https://www.twayair.com/app/serviceInfo/flightStatus",
    },
    {
      id: "kix-flight-status",
      category: "flight",
      title: "KIX 오늘의 항공편",
      detail: "터미널·게이트 현장 정보 확인",
      url: "https://www.kansai-airport.or.jp/en/search/flight",
    },
    {
      id: "osaka-metro-status",
      category: "transit",
      title: "Osaka Metro 운행정보",
      detail: "노선별 운전 중지·지연 확인",
      url: "https://subway.osakametro.co.jp/guide/subway_information.php",
    },
    {
      id: "jr-west-status",
      category: "transit",
      title: "JR West 운행정보",
      detail: "간사이권 JR 노선 상태 확인",
      url: "https://global.trafficinfo.westjr.co.jp/en/",
    },
    {
      id: "hankyu-status",
      category: "transit",
      title: "한큐 전철 운행정보",
      detail: "Day 4 오사카우메다↔교토선 지연 확인",
      url: "https://www.hankyu.co.jp/en/railinfo/index.html",
    },
  ],
};
