import { useRef, useState } from "react";
import type { AttachedPlace, PlaceSummary } from "../../domain/places/types";
import { readAccessToken } from "../../services/accessToken";
import {
  PlacesClientError,
  searchPlaces,
  usageLimitMessage,
  type PlacesClientErrorCode,
} from "../../services/placesClient";

interface PlaceSearchFieldProps {
  placeName: string;
  place?: AttachedPlace;
  error?: string;
  onPlaceNameChange: (placeName: string) => void;
  onPlaceSelect: (place: AttachedPlace) => void;
  onPlaceClear: () => void;
}

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "results"; places: PlaceSummary[] }
  | { kind: "no-token" }
  | { kind: "error"; code: PlacesClientErrorCode };

const errorMessages: Partial<Record<PlacesClientErrorCode, string>> = {
  NETWORK_ERROR: "오프라인이거나 서버에 연결할 수 없습니다.",
  SERVER_CONFIG_ERROR: "서버에 Google 키가 아직 설정되지 않았습니다.",
  UNAUTHORIZED: "접근 코드가 올바르지 않습니다. 교통편 탭에서 다시 입력해주세요.",
  OUTSIDE_TRIP_WINDOW: "여행 기간에만 검색할 수 있습니다.",
};

export function PlaceSearchField({
  placeName,
  place,
  error,
  onPlaceNameChange,
  onPlaceSelect,
  onPlaceClear,
}: PlaceSearchFieldProps) {
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  async function runSearch() {
    const query = placeName.trim();
    if (query.length === 0) return;

    const token = readAccessToken();
    if (token === null) {
      setSearch({ kind: "no-token" });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearch({ kind: "loading" });
    try {
      const response = await searchPlaces({ query }, token, controller.signal);
      setSearch({ kind: "results", places: response.places });
    } catch (searchError) {
      if (controller.signal.aborted) return;
      setSearch({
        kind: "error",
        code:
          searchError instanceof PlacesClientError
            ? searchError.code
            : "UNKNOWN",
      });
    }
  }

  function selectPlace(summary: PlaceSummary) {
    onPlaceSelect({ ...summary, attachedAt: new Date().toISOString() });
    setSearch({ kind: "idle" });
  }

  const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName.trim())}`;

  return (
    <div className="place-search">
      <label>
        장소
        <div className="place-search__row">
          <input
            value={placeName}
            maxLength={160}
            placeholder="장소 없음도 가능"
            onChange={(event) => {
              onPlaceNameChange(event.target.value);
              setSearch({ kind: "idle" });
            }}
            aria-invalid={error === undefined ? undefined : true}
          />
          <button type="button" onClick={runSearch}>
            장소 검색
          </button>
        </div>
        {error === undefined ? null : <small>{error}</small>}
      </label>

      {place === undefined ? null : (
        <div className="place-search__attached">
          <div>
            <strong>{place.displayName}</strong>
            <span>{place.formattedAddress}</span>
            <span className="place-search__attribution">Google Maps</span>
          </div>
          <button type="button" onClick={onPlaceClear}>
            장소 연결 해제
          </button>
        </div>
      )}

      {search.kind === "loading" ? <p role="status">장소를 찾는 중…</p> : null}

      {search.kind === "no-token" ? (
        <p role="alert">
          교통편 탭에서 개인 접근 코드를 먼저 입력해주세요.
        </p>
      ) : null}

      {search.kind === "error" ? (
        <div role="alert" className={`place-search__error${usageLimitMessage(search.code) ? " place-search__error--limit" : ""}`}>
          <p>{usageLimitMessage(search.code) ?? errorMessages[search.code] ?? "검색에 실패했습니다."}</p>
          <a href={mapsSearchUrl} target="_blank" rel="noreferrer">
            Google Maps에서 검색
          </a>
        </div>
      ) : null}

      {search.kind === "results" ? (
        search.places.length === 0 ? (
          <p role="status">검색 결과가 없습니다. 직접 입력한 이름을 그대로 쓸 수 있어요.</p>
        ) : (
          <ul className="place-search__results">
            {search.places.map((summary) => (
              <li key={summary.placeId}>
                <div>
                  <strong>{summary.displayName}</strong>
                  <span>{summary.formattedAddress}</span>
                  <span className="place-search__attribution">Google Maps</span>
                </div>
                <button type="button" onClick={() => selectPlace(summary)}>
                  {summary.displayName} 선택
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
