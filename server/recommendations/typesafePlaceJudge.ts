import { TypeSafeClient, noul, score } from "@typesafe-ai/sdk";
import type { PlaceJudge } from "./recommendPlaces.js";

const REQUEST_TIMEOUT_MS = 8_000;

const IN_DESTINATION = noul(
  "Is `place` located in `trip.destination`, or close enough that a traveler visiting `trip.destination` would include it in this trip?",
  {
    true: "The place is inside the destination or a normal outing from it.",
    false:
      "The place is in a different city or region, or is not somewhere a traveler can visit.",
  },
);

const PREFERENCE_LEVELS = [
  "The place conflicts with what the traveler said they want.",
  "The place is unrelated to what the traveler said they want.",
  "The place partly matches what the traveler said they want.",
  "The place clearly matches what the traveler said they want.",
] as const;

const PREFERENCE_FIT = score(
  "How well does `place` match the traveler's stated preference in `trip.preference`, considering `place.category`, its name and its address?",
  PREFERENCE_LEVELS,
);

export function createTypeSafePlaceJudge(apiKey: string): PlaceJudge {
  const client = new TypeSafeClient({ apiKey, timeout: REQUEST_TIMEOUT_MS });
  return {
    async judge(trip, place, categoryLabel) {
      const hasPreference = trip.preference.length > 0;
      const state = {
        trip: {
          destination: trip.destination,
          dates: `${trip.startDate} to ${trip.endDate}`,
          travelers: trip.travelers,
          ...(hasPreference ? { preference: trip.preference } : {}),
        },
        place: {
          name: place.displayName,
          address: place.formattedAddress,
          category: categoryLabel,
        },
      };
      if (!hasPreference) {
        const { answers } = await client.systemOne({
          state,
          questions: { inDestination: IN_DESTINATION },
        });
        return { inDestination: answers.inDestination.noul, preferenceFit: null };
      }
      const { answers } = await client.systemOne({
        state,
        questions: { inDestination: IN_DESTINATION, preferenceFit: PREFERENCE_FIT },
      });
      return {
        inDestination: answers.inDestination.noul,
        preferenceFit:
          answers.preferenceFit.score / (PREFERENCE_LEVELS.length - 1),
      };
    },
  };
}
