import { useState } from "react";
import { localDateTime } from "../../domain/time/zoned";
import { reservationKinds } from "../../domain/reservations/reservations";
import type { Reservation } from "../../domain/reservations/types";

interface Props {
  item: Reservation;
  now: Date;
  onBack: () => void;
  onEdit: () => void;
  onVerify: () => void;
  onRemove: () => void;
}

export function ReservationDetail({ item, onBack, onEdit, onVerify, onRemove }: Props) {
  const [copyStatus, setCopyStatus] = useState("");
  const [removing, setRemoving] = useState(false);
  const stay = item.kind === "stay";
  async function copyAddress() {
    try { await navigator.clipboard.writeText(item.address ?? ""); setCopyStatus("주소를 복사했어요."); }
    catch { setCopyStatus("복사하지 못했어요. 아래 주소를 길게 눌러 복사해 주세요."); }
  }
  return <section className="reservation-detail" aria-label={`${item.title} 예약 상세`}>
    <div className="reservation-section-heading"><button type="button" onClick={onBack}>‹ 예약 목록</button><button type="button" onClick={onEdit}>수정</button></div>
    <p className="reservation-eyebrow">{reservationKinds[item.kind]}</p><h2>{item.title}</h2>
    {item.serviceNumber ? <p>{item.serviceNumber}</p> : null}
    <dl className="reservation-times"><div><dt>{stay ? "체크인" : "이용·출발"}</dt><dd><strong>{item.startDate}</strong><span>{item.startTime ?? "시각 미정"}</span><small>{item.timeZone}</small>{item.departure ? <span>{item.departure}</span> : null}</dd></div>
    {item.endDate ? <div><dt>{stay ? "체크아웃" : "종료·도착"}</dt><dd><strong>{item.endDate}</strong><span>{item.endTime ?? "시각 미정"}</span><small>{item.endTimeZone ?? item.timeZone}</small>{item.arrival ? <span>{item.arrival}</span> : null}</dd></div> : null}</dl>
    {!item.endDate && item.arrival ? <p>도착 장소 · {item.arrival}</p> : null}
    {item.address ? <section><h3>{stay ? "숙소 주소" : "주소·집합 장소"}</h3><address>{item.address}</address><div className="reservation-actions"><button type="button" onClick={copyAddress}>주소 복사</button><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`} target="_blank" rel="noopener noreferrer">지도 열기 ↗</a></div><p role="status" className="reservation-caption">{copyStatus}</p></section> : null}
    {item.note ? <section><h3>이용 안내</h3><p className="reservation-note">{item.note}</p></section> : null}
    <section className="reservation-source"><h3>예약 원본 확인</h3>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">예약 서비스 열기 ↗</a> : <p className="reservation-caption">예약한 앱이나 메일에서 원본을 확인하세요.</p>}
    <p className="reservation-caption">서비스·지도 링크에는 인터넷 연결이 필요합니다.</p>
    <button type="button" onClick={onVerify}>원본과 대조했어요</button>
    <p className="reservation-caption" role="status">{item.verifiedAt ? `직접 확인 · ${localDateTime(item.verifiedAt, item.timeZone).slice(0, 16).replace("T", " ")} (${item.timeZone})` : "아직 원본과 대조하지 않은 정보예요."}<br />변경·취소 정보는 자동으로 갱신되지 않습니다.</p></section>
    <div className="reservation-remove">{removing ? <><p>이 예약 기본정보를 수첩에서 지울까요? 실제 예약은 취소되지 않습니다.</p><button type="button" onClick={onRemove}>수첩에서 지우기</button><button type="button" onClick={() => setRemoving(false)}>유지하기</button></> : <button type="button" onClick={() => setRemoving(true)}>예약 정보 지우기</button>}</div>
  </section>;
}
