import { useId, useState } from "react";
import { reservationKinds, reservationServiceUrl, validateReservation } from "../../domain/reservations/reservations";
import type { Reservation, ReservationKind } from "../../domain/reservations/types";

interface Props {
  initial: Reservation;
  now: Date;
  onSave: (value: Reservation) => void;
  onCancel: () => void;
}

/** 수첩 생성 양식 안에서도 쓸 수 있도록 별도 form을 중첩하지 않는다. */
export function ReservationEditor({ initial, now, onSave, onCancel }: Props) {
  const [value, setValue] = useState(initial);
  const [issues, setIssues] = useState<string[]>([]);
  const zoneList = useId();
  const stay = value.kind === "stay";
  const transport = value.kind === "flight" || value.kind === "transport";
  function field(key: keyof Reservation, text: string) {
    setValue(current => ({ ...current, [key]: text || undefined }));
  }
  function save() {
    const normalized = { ...value, title: value.title?.trim() ?? "", updatedAt: now.toISOString(), verifiedAt: undefined };
    const errors = validateReservation(normalized);
    setIssues(errors);
    if (!errors.length) onSave({ ...normalized, sourceUrl: normalized.sourceUrl ? reservationServiceUrl(normalized.sourceUrl) : undefined });
  }
  return <section className="reservation-editor" aria-label="예약 입력">
    <header className="reservation-section-heading"><h2>{initial.title ? "예약 수정" : "예약 적어두기"}</h2><button type="button" onClick={onCancel}>취소</button></header>
    <fieldset className="reservation-kind"><legend>예약 종류</legend>{Object.entries(reservationKinds).map(([kind, label]) => <label key={kind}><input type="radio" name={`reservation-kind-${zoneList}`} value={kind} checked={value.kind === kind} onChange={() => setValue(current => ({ ...current, kind: kind as ReservationKind }))} /><span>{label}</span></label>)}</fieldset>
    <label>예약 이름<input autoFocus autoComplete="off" value={value.title ?? ""} maxLength={120} onChange={e => field("title", e.target.value)} placeholder={stay ? "숙소 이름" : "항공사, 열차 또는 이용할 곳"} /></label>
    <div className="reservation-fields"><label>{stay ? "체크인 날짜" : "이용·출발 날짜"}<input type="date" value={value.startDate ?? ""} onInput={e => field("startDate", e.currentTarget.value)} onChange={e => field("startDate", e.target.value)} /></label><label>{stay ? "체크인 시각 (선택)" : "이용·출발 시각 (선택)"}<input type="time" value={value.startTime ?? ""} onInput={e => field("startTime", e.currentTarget.value)} onChange={e => field("startTime", e.target.value)} /></label></div>
    <label>{transport ? "출발 시간대" : "현지 시간대"}<input list={zoneList} value={value.timeZone ?? ""} maxLength={64} onChange={e => field("timeZone", e.target.value)} /></label>
    <datalist id={zoneList}>{["UTC", ...Intl.supportedValuesOf("timeZone")].map(zone => <option value={zone} key={zone} />)}</datalist>
    <details open={stay || transport} className="reservation-extra"><summary>{stay ? "체크아웃" : transport ? "도착 정보" : "종료 정보 (선택)"}</summary>
      <div className="reservation-fields"><label>{stay ? "체크아웃 날짜 (선택)" : "종료·도착 날짜 (선택)"}<input type="date" value={value.endDate ?? ""} onInput={e => field("endDate", e.currentTarget.value)} onChange={e => field("endDate", e.target.value)} /></label><label>{stay ? "체크아웃 시각 (선택)" : "종료·도착 시각 (선택)"}<input type="time" value={value.endTime ?? ""} onInput={e => field("endTime", e.currentTarget.value)} onChange={e => field("endTime", e.target.value)} /></label></div>
      {transport ? <label>도착 시간대<input list={zoneList} maxLength={64} value={value.endTimeZone ?? value.timeZone ?? ""} onChange={e => field("endTimeZone", e.target.value)} /></label> : null}
    </details>
    {transport ? <><div className="reservation-fields"><label>출발 장소 (선택)<input value={value.departure ?? ""} maxLength={120} onChange={e => field("departure", e.target.value)} /></label><label>도착 장소 (선택)<input value={value.arrival ?? ""} maxLength={120} onChange={e => field("arrival", e.target.value)} /></label></div><label>편명·열차번호 (선택)<input value={value.serviceNumber ?? ""} maxLength={40} onChange={e => field("serviceNumber", e.target.value)} placeholder="예약번호가 아닌 편명" /></label></> : <label>{stay ? "숙소 주소 (선택)" : "주소·집합 장소 (선택)"}<input value={value.address ?? ""} maxLength={300} onChange={e => field("address", e.target.value)} /></label>}
    <details className="reservation-extra"><summary>안내와 서비스 링크 더하기</summary>
      <label>이용 안내 (선택)<textarea value={value.note ?? ""} maxLength={400} rows={3} onChange={e => field("note", e.target.value)} placeholder="입실 방법, 집합 위치 등 · 출입 비밀번호와 예약번호는 제외" /></label>
      <label>예약 서비스 홈페이지 (선택)<input type="url" inputMode="url" autoComplete="off" value={value.sourceUrl ?? ""} maxLength={500} onChange={e => field("sourceUrl", e.target.value)} placeholder="https://example.com" /></label>
      <p className="reservation-caption">예약번호나 인증값이 든 개별 예약 링크는 저장하지 않습니다. 원본은 예약 서비스에서 확인하세요.</p>
    </details>
    <p className="reservation-caption">기본정보만 이 브라우저에 저장합니다. 예약번호·QR·여권·출입 비밀번호는 입력하지 마세요.</p>
    {issues.length ? <ul role="alert" className="reservation-errors">{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul> : null}
    <div className="reservation-actions"><button type="button" className="reservation-primary" onClick={save}>예약 저장</button><button type="button" onClick={onCancel}>취소하고 돌아가기</button></div>
  </section>;
}
