import { deviceTimeZone, zonedIso } from "../../domain/time/zoned";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { RestaurantCandidate } from "../../domain/places/types";
import type { ScheduleActivity } from "../../domain/schedule/types";
import { readAccessToken } from "../../services/accessToken";
import {
  PlacesClientError,
  fetchRestaurants,
  usageLimitMessage,
} from "../../services/placesClient";

interface RestaurantSheetProps {
  timeZone?: string;
  anchor: ScheduleActivity;
  idFactory?: () => string;
  onAdd: (activity: ScheduleActivity) => void;
  onClose: () => void;
}

type SheetState =
  | { kind: "loading" }
  | { kind: "results"; restaurants: RestaurantCandidate[]; radius: "near" | "wide" }
  | { kind: "no-token" }
  | { kind: "error"; message: string; limited: boolean };

const MEAL_OFFSET_MINUTES = 30;
const MEAL_DURATION_MINUTES = 60;

function addMinutesLocalIso(targetAt: string, minutes: number, timeZone: string): string {
 return zonedIso(new Date(new Date(targetAt).getTime() + minutes * 60000), timeZone);
}

function priceLabel(priceLevel: RestaurantCandidate["priceLevel"]): string {
  return priceLevel === undefined ? "" : `가격대 ${priceLevel}/4`;
}

export function RestaurantSheet({
  timeZone = deviceTimeZone(),
  anchor,
  idFactory = () => crypto.randomUUID(),
  onAdd,
  onClose,
}: RestaurantSheetProps) {
  const [state, setState] = useState<SheetState>({ kind: "loading" });
  const [confirming, setConfirming] = useState<RestaurantCandidate | null>(
    null,
  );
  const closeRef = useRef<HTMLButtonElement>(null);
  const anchorPlace = anchor.place;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => previous?.focus();
  }, []);

  function onSheetKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
  }

  async function load(radius: "near" | "wide") {
    if (anchorPlace === undefined) return;
    const token = readAccessToken();
    if (token === null) {
      setState({ kind: "no-token" });
      return;
    }
    setState({ kind: "loading" });
    try {
      const response = await fetchRestaurants(
        { center: anchorPlace.location, radius },
        token,
        new AbortController().signal,
      );
      setState({ kind: "results", restaurants: response.restaurants, radius });
    } catch (error) {
      setState({
        kind: "error",
        limited: error instanceof PlacesClientError && usageLimitMessage(error.code) !== null,
        message:
          error instanceof PlacesClientError &&
          error.code === "SERVER_CONFIG_ERROR"
            ? "서버에 Google 키가 아직 설정되지 않았습니다."
            : (error instanceof PlacesClientError && usageLimitMessage(error.code)) ||
              "주변 맛집을 불러오지 못했습니다.",
      });
    }
  }

  useEffect(() => {
    void load("near");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (anchorPlace === undefined) return null;

  const mapsSearchUrl = `https://www.google.com/maps/search/restaurants/@${anchorPlace.location.latitude},${anchorPlace.location.longitude},17z`;

  function confirmAdd(candidate: RestaurantCandidate) {
    onAdd({
      id: `user-${idFactory()}`,
      routeTimingStale: false,
      title: candidate.displayName,
      targetAt: addMinutesLocalIso(anchor.targetAt, MEAL_OFFSET_MINUTES, timeZone),
      placeName: candidate.displayName,
      kind: "meal",
      durationMinutes: MEAL_DURATION_MINUTES,
      priority: "flexible",
      timeKind: "estimate",
      place: {
        placeId: candidate.placeId,
        displayName: candidate.displayName,
        formattedAddress: candidate.formattedAddress,
        location: candidate.location,
        googleMapsUri: candidate.googleMapsUri,
        attachedAt: new Date().toISOString(),
      },
    });
    onClose();
  }

  return (
    <section
      className="restaurant-sheet"
      role="dialog"
      aria-labelledby="restaurant-sheet-title"
      onKeyDown={onSheetKeyDown}
    >
      <header>
        <h2 id="restaurant-sheet-title">
          {anchorPlace.displayName} 주변 맛집
        </h2>
        <button ref={closeRef} type="button" onClick={onClose}>
          닫기
        </button>
      </header>

      {state.kind === "loading" ? <p role="status">주변 식당을 찾는 중…</p> : null}

      {state.kind === "no-token" ? (
        <p role="alert">교통편 탭에서 개인 접근 코드를 먼저 입력해주세요.</p>
      ) : null}

      {state.kind === "error" ? (
        <div role="alert" className={state.limited ? "restaurant-sheet__limit" : undefined}>
          <p>{state.message}</p>
          <a href={mapsSearchUrl} target="_blank" rel="noreferrer">
            Google Maps에서 직접 검색
          </a>
        </div>
      ) : null}

      {state.kind === "results" ? (
        state.restaurants.length === 0 ? (
          <div>
            <p>주변에서 영업 중인 식당을 찾지 못했습니다.</p>
            {state.radius === "near" ? (
              <button type="button" onClick={() => load("wide")}>
                1.5km로 넓혀 다시 찾기
              </button>
            ) : (
              <a href={mapsSearchUrl} target="_blank" rel="noreferrer">
                Google Maps에서 직접 검색
              </a>
            )}
          </div>
        ) : (
          <ul>
            {state.restaurants.map((candidate) => (
              <li key={candidate.placeId}>
                <div>
                  <strong>{candidate.displayName}</strong>
                  <span>
                    {candidate.rating === undefined
                      ? "평점 정보 없음"
                      : `★ ${candidate.rating} (${candidate.userRatingCount ?? 0})`}
                    {priceLabel(candidate.priceLevel) === ""
                      ? ""
                      : ` · ${priceLabel(candidate.priceLevel)}`}
                    {` · ${candidate.distanceMeters}m`}
                  </span>
                  {candidate.openNow === true ? (
                    <span className="restaurant-sheet__open">현재 영업</span>
                  ) : null}
                  <span className="restaurant-sheet__attribution">
                    Google Maps
                  </span>
                </div>
                <a
                  href={candidate.googleMapsUri}
                  target="_blank"
                  rel="noreferrer"
                >
                  지도 보기
                </a>
                {confirming?.placeId === candidate.placeId ? (
                  <div className="restaurant-sheet__confirm">
                    <p>
                      {candidate.displayName}을(를){" "}
                      {addMinutesLocalIso(
                        anchor.targetAt,
                        MEAL_OFFSET_MINUTES,
                        timeZone,
                      ).slice(11, 16)}{" "}
                      식사로 추가할까요?
                    </p>
                    <button type="button" onClick={() => confirmAdd(candidate)}>
                      추가 확정
                    </button>
                    <button type="button" onClick={() => setConfirming(null)}>
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(candidate)}
                  >
                    일정에 추가
                  </button>
                )}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
