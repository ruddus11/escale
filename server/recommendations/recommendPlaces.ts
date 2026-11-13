import type { PlaceSummary } from "../../src/domain/places/types.js";
import type { GooglePlacesProvider } from "../places/googlePlacesClient.js";

export type RecommendCategory = "food" | "cafe" | "sight" | "shopping";

export const RECOMMEND_CATEGORIES: readonly {
  key: RecommendCategory;
  label: string;
}[] = [
  { key: "food", label: "맛집" },
  { key: "cafe", label: "카페" },
  { key: "sight", label: "관광지" },
  { key: "shopping", label: "쇼핑" },
];

const CANDIDATES_PER_CATEGORY = 8;
const PICKS_PER_CATEGORY = 3;
// 여행지 밖으로 판단된 후보는 점수와 무관하게 제외한다.
const MIN_IN_DESTINATION = 0.5;

export interface RecommendTrip {
  destination: string;
  preference: string;
  startDate: string;
  endDate: string;
  travelers: number;
}

export interface PlaceJudgement {
  /** 0~1: 후보가 여행지 안(또는 그 여행 동선)에 있을 확률. */
  inDestination: number;
  /** 0~1로 정규화한 취향 일치도. 취향을 적지 않았으면 null. */
  preferenceFit: number | null;
}

export interface PlaceJudge {
  judge(
    trip: RecommendTrip,
    place: PlaceSummary,
    categoryLabel: string,
  ): Promise<PlaceJudgement>;
}

export interface PlaceRecommendation extends PlaceSummary {
  category: RecommendCategory;
  preferenceFit: number | null;
}

export async function recommendPlaces(
  trip: RecommendTrip,
  places: Pick<GooglePlacesProvider, "searchText">,
  judge: PlaceJudge,
): Promise<PlaceRecommendation[]> {
  const searches = await Promise.all(
    RECOMMEND_CATEGORIES.map(async ({ key, label }) => ({
      key,
      label,
      places: await places.searchText({
        query: `${trip.destination} ${label}`,
        maxResults: CANDIDATES_PER_CATEGORY,
      }),
    })),
  );

  // 같은 장소가 여러 검색에 나오면 먼저 나온 분류 하나로만 판단한다.
  const seen = new Set<string>();
  const candidates = searches.flatMap(({ key, label, places: found }) =>
    found
      .filter((place) => !seen.has(place.placeId) && seen.add(place.placeId))
      .map((place, rank) => ({ place, category: key, label, rank })),
  );

  const judged = await Promise.allSettled(
    candidates.map((candidate) =>
      judge.judge(trip, candidate.place, candidate.label),
    ),
  );
  if (
    candidates.length > 0 &&
    judged.every((result) => result.status === "rejected")
  ) {
    throw (judged[0] as PromiseRejectedResult).reason;
  }

  return RECOMMEND_CATEGORIES.flatMap(({ key }) =>
    candidates
      .map((candidate, index) => ({ candidate, result: judged[index] }))
      .filter(
        ({ candidate, result }) =>
          candidate.category === key &&
          result.status === "fulfilled" &&
          result.value.inDestination >= MIN_IN_DESTINATION,
      )
      .map(({ candidate, result }) => ({
        ...candidate,
        fit: (result as PromiseFulfilledResult<PlaceJudgement>).value
          .preferenceFit,
      }))
      // 취향이 없으면 Google 검색 순서를 유지한다.
      .sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0) || a.rank - b.rank)
      .slice(0, PICKS_PER_CATEGORY)
      .map(({ place, category, fit }) => ({
        ...place,
        category,
        preferenceFit: fit,
      })),
  );
}
