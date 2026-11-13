export type ReservationKind = "stay" | "flight" | "transport" | "activity";

/** 기본 예약정보만 저장한다. 예약번호·티켓·인증용 링크는 이 모델에 포함하지 않는다. */
export interface Reservation {
  id: string;
  kind: ReservationKind;
  title: string;
  startDate: string;
  startTime?: string;
  timeZone: string;
  endDate?: string;
  endTime?: string;
  endTimeZone?: string;
  address?: string;
  departure?: string;
  arrival?: string;
  serviceNumber?: string;
  note?: string;
  /** 인증 경로·쿼리가 없는 예약 서비스의 HTTPS 홈페이지만 허용한다. */
  sourceUrl?: string;
  updatedAt: string;
  verifiedAt?: string;
}
