import { useState, type ChangeEvent, type ReactNode } from "react";
import { tripInfo } from "../../data/tripInfo";
import { PUBLIC_LEGAL_PATHS } from "../../domain/legal/legal";
import {
  createWorkspaceBackupFilename,
  downloadJsonFile,
  readTextFile,
} from "../../services/workspaceTransfer";

export interface InfoScreenDependencies {
  now(): Date;
  downloadJson(contents: string, filename: string): void;
  readFile(file: File): Promise<string>;
}

interface InfoScreenProps {
  exportWorkspace(): string;
  importWorkspace(json: string): unknown;
  resetWorkspace(): Promise<void>;
  /** 호텔·항공·현장 링크는 오사카 수첩 전용 정보라 다른 수첩에서는 숨긴다. */
  showTripDetails?: boolean;
  showReservationPlaceholder?: boolean;
  dependencies?: InfoScreenDependencies;
}

const defaultDependencies: InfoScreenDependencies = {
  now: () => new Date(),
  downloadJson: downloadJsonFile,
  readFile: readTextFile,
};

export function InfoScreen({
  exportWorkspace,
  importWorkspace,
  resetWorkspace,
  dependencies = defaultDependencies,
  showTripDetails = true,
  showReservationPlaceholder = true,
}: InfoScreenProps) {
  const [pendingImport, setPendingImport] = useState<{
    filename: string;
    contents: string;
  } | null>(null);
  const [isResetArmed, setIsResetArmed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const flightLinks = tripInfo.officialLinks.filter(
    (link) => link.category === "flight",
  );
  const transitLinks = tripInfo.officialLinks.filter(
    (link) => link.category === "transit",
  );
  const festivalLinks = tripInfo.officialLinks.filter(
    (link) => link.category === "festival",
  );

  function exportBackup() {
    try {
      const contents = exportWorkspace();
      dependencies.downloadJson(
        contents,
        createWorkspaceBackupFilename(dependencies.now()),
      );
      setError(null);
      setStatus("백업 파일을 만들었습니다.");
    } catch {
      setStatus(null);
      setError("백업 파일을 만들지 못했습니다.");
    }
  }

  async function selectImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;

    setIsBusy(true);
    setError(null);
    setStatus(null);
    setPendingImport(null);
    try {
      const contents = await dependencies.readFile(file);
      if (contents.trim().length === 0) {
        throw new Error("empty");
      }
      setPendingImport({ filename: file.name, contents });
    } catch {
      setError("백업 파일을 읽지 못했습니다.");
    } finally {
      setIsBusy(false);
    }
  }

  function confirmImport() {
    if (pendingImport === null) return;

    try {
      importWorkspace(pendingImport.contents);
      setPendingImport(null);
      setError(null);
      setStatus("여행 데이터를 가져왔습니다.");
    } catch {
      setStatus(null);
      setError("백업 파일 형식을 확인해주세요.");
    }
  }

  async function confirmReset() {
    setIsBusy(true);
    setError(null);
    setStatus(null);
    try {
      await resetWorkspace();
      setIsResetArmed(false);
      setStatus("여행 수첩을 모두 비웠습니다.");
    } catch {
      setError("여행 데이터를 초기화하지 못했습니다.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="info-screen">
      <header className="info-screen__header">
        <div>
          {showTripDetails ? <p>7월 20일–24일 · 모든 시각은 현지 기준</p> : null}
          <h1>여행 정보</h1>
        </div>
        <span>기기 저장</span>
      </header>

      <main>
        {showTripDetails ? (
          <>
        <section className="info-card hotel-card" aria-labelledby="hotel-title">
          <div className="info-card__heading">
            <div>
              <span>숙소</span>
              <h2 id="hotel-title">{tripInfo.hotel.nameKo}</h2>
            </div>
            <span>4박</span>
          </div>
          <p className="info-japanese-name" lang="ja">
            {tripInfo.hotel.nameJa}
          </p>
          <address>
            <span>{tripInfo.hotel.addressKo}</span>
            <span lang="ja">{tripInfo.hotel.addressJa}</span>
          </address>
          <p className="info-detail">{tripInfo.hotel.accessNote}</p>
          <dl className="hotel-times">
            <div>
              <dt>체크인</dt>
              <dd>{tripInfo.hotel.checkIn}</dd>
            </div>
            <div>
              <dt>체크아웃</dt>
              <dd>{tripInfo.hotel.checkOut}</dd>
            </div>
          </dl>
          <div className="info-actions">
            <a href={tripInfo.hotel.phoneHref}>호텔 전화</a>
            <ExternalLink href={tripInfo.hotel.mapsUrl}>Google Maps</ExternalLink>
            <ExternalLink href={tripInfo.hotel.officialUrl}>호텔 공식</ExternalLink>
          </div>
        </section>

        <section className="info-section" aria-labelledby="field-links-title">
          <div className="info-section__heading">
            <h2 id="field-links-title">현장 필수</h2>
            <span>공식 GPS 지도</span>
          </div>
          <div className="official-link-list">
            {festivalLinks.map((link) => (
              <OfficialLink key={link.id} link={link} />
            ))}
          </div>
        </section>

        <section className="info-section" aria-labelledby="flights-title">
          <div className="info-section__heading">
            <h2 id="flights-title">항공편</h2>
            <span>현지시각</span>
          </div>
          <div className="flight-list">
            {tripInfo.flights.map((flight) => (
              <article className="info-card flight-card" key={flight.id}>
                <header>
                  <span>{flight.directionLabel}</span>
                  <strong>{flight.flightNumber}</strong>
                  <time>{flight.dateLabel}</time>
                </header>
                <div className="flight-route">
                  <div>
                    <strong>{flight.departureTime}</strong>
                    <span>{flight.departureAirport}</span>
                  </div>
                  <span aria-hidden="true">→</span>
                  <div>
                    <strong>{flight.arrivalTime}</strong>
                    <span>{flight.arrivalAirport}</span>
                  </div>
                </div>
                <p>{flight.durationLabel}</p>
              </article>
            ))}
          </div>
          <div className="official-link-list">
            {flightLinks.map((link) => (
              <OfficialLink key={link.id} link={link} />
            ))}
          </div>
        </section>

        <section className="info-section" aria-labelledby="transit-status-title">
          <div className="info-section__heading">
            <h2 id="transit-status-title">공식 운행정보</h2>
            <span>웹 연결 필요</span>
          </div>
          <div className="official-link-list">
            {transitLinks.map((link) => (
              <OfficialLink key={link.id} link={link} />
            ))}
          </div>
        </section>

          </>
        ) : showReservationPlaceholder ? (
          <p className="info-detail">이 수첩의 항공·숙소·티켓을 적는 칸은 다음 업데이트에서 열려요.</p>
        ) : null}

        {showTripDetails ? <section className="info-section" aria-labelledby="emergency-title">
          <div className="info-section__heading is-emergency">
            <h2 id="emergency-title">긴급 연락처</h2>
            <span>전화 연결</span>
          </div>
          <div className="emergency-list">
            {tripInfo.emergencyContacts.map((contact) => (
              <article className="info-card emergency-card" key={contact.id}>
                <div>
                  <strong>{contact.name}</strong>
                  <span>{contact.detail}</span>
                </div>
                <a
                  href={contact.phoneHref}
                  aria-label={`${contact.name} ${contact.phone} 전화`}
                >
                  {contact.phone}
                </a>
                {contact.officialUrl === undefined ? null : (
                  <ExternalLink href={contact.officialUrl}>공식 안내</ExternalLink>
                )}
              </article>
            ))}
          </div>
        </section> : null}

        <section className="info-card backup-card" aria-labelledby="backup-title">
          <div className="info-card__heading">
            <div>
              <span>내 기기 저장</span>
              <h2 id="backup-title">백업 및 복구</h2>
            </div>
          </div>
          <p>
            일정·경비·예약 기본정보는 이 브라우저에만 저장됩니다. JSON 백업은 암호화되지 않으며 예약정보도 포함하므로 다른 사람에게 공유하지 마세요.
          </p>

          {error === null ? null : <p role="alert">{error}</p>}
          {status === null ? null : <p role="status">{status}</p>}

          <div className="backup-actions">
            <button type="button" onClick={exportBackup} disabled={isBusy}>
              백업 내보내기
            </button>
            <label>
              백업 파일 선택
              <input
                type="file"
                accept=".json,application/json"
                aria-label="백업 파일 선택"
                onChange={selectImportFile}
                disabled={isBusy}
              />
            </label>
          </div>

          {pendingImport === null ? null : (
            <div className="backup-confirm">
              <p>{pendingImport.filename}을 가져올까요?</p>
              <span>현재 수첩의 일정·예산·지출·예약정보가 백업 내용으로 교체됩니다.</span>
              <div>
                <button type="button" onClick={confirmImport} disabled={isBusy}>
                  가져오기 확인
                </button>
                <button
                  type="button"
                  onClick={() => setPendingImport(null)}
                  disabled={isBusy}
                >
                  취소
                </button>
              </div>
            </div>
          )}

          <div className="reset-zone">
            {isResetArmed ? (
              <>
                <p>이 기기의 모든 여행 수첩을 비울까요?</p>
                <span>추가한 일정·지출·예약 기록이 삭제됩니다.</span>
                <div>
                  <button type="button" onClick={confirmReset} disabled={isBusy}>
                    초기화 확인
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsResetArmed(false)}
                    disabled={isBusy}
                  >
                    취소
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStatus(null);
                  setIsResetArmed(true);
                }}
              >
                여행 데이터 초기화
              </button>
            )}
          </div>
        </section>

        <nav className="legal-links" aria-label="개인정보와 약관">
          <p>이 웹 수첩은 쿠키를 쓰지 않고, 수첩을 이 브라우저 저장소에만 둡니다.</p>
          <ul>
            <li><a href={PUBLIC_LEGAL_PATHS.privacy}>개인정보 처리방침</a></li>
            <li><a href={PUBLIC_LEGAL_PATHS.terms}>이용약관</a></li>
            <li><a href={PUBLIC_LEGAL_PATHS.accountDeletion}>계정·데이터 삭제</a></li>
          </ul>
        </nav>
      </main>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span aria-hidden="true">↗</span>
    </a>
  );
}

function OfficialLink({
  link,
}: {
  link: (typeof tripInfo.officialLinks)[number];
}) {
  return (
    <ExternalLink href={link.url}>
      <span>
        <strong>{link.title}</strong>
        <small>{link.detail}</small>
      </span>
    </ExternalLink>
  );
}
