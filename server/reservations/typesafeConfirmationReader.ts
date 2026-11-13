import { TypeSafeClient, choice } from "@typesafe-ai/sdk";
import type { Candidate, ConfirmationCandidates } from "../../src/domain/reservations/confirmation.js";
import type { ReservationKind } from "../../src/domain/reservations/types.js";

const REQUEST_TIMEOUT_MS = 10_000;
// 이보다 확신이 낮으면 칸을 비워 두고 사용자가 채우게 한다.
const MIN_CONFIDENCE = 0.5;

export type PickedFields = {
  kind?: ReservationKind;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  departure?: string;
  arrival?: string;
  service?: string;
};

export interface ConfirmationReader {
  read(text: string, candidates: ConfirmationCandidates): Promise<PickedFields>;
}

const NONE = "none";
const SEGMENT =
  "If the text has several trip segments (for example a round trip), use only the first outbound segment.";

function options(list: Candidate[], noneMeaning: string) {
  return {
    ...Object.fromEntries(list.map((c) => [c.id, `${c.value} — near: "${c.snippet}"`])),
    [NONE]: noneMeaning,
  };
}

export function createTypeSafeConfirmationReader(apiKey: string): ConfirmationReader {
  const client = new TypeSafeClient({ apiKey, timeout: REQUEST_TIMEOUT_MS });
  return {
    async read(text, c) {
      const questions: Record<string, ReturnType<typeof choice>> = {
        kind: choice("What kind of booking does `text` confirm?", {
          flight: "A flight ticket",
          transport: "A train, bus or ferry ticket",
          stay: "A hotel or other accommodation",
          activity: "An admission, tour or activity ticket",
          [NONE]: "Not a booking confirmation",
        }),
      };
      if (c.dates.length) {
        questions.startDate = choice(`Which candidate is the departure, check-in or start date in \`text\`? ${SEGMENT}`, options(c.dates, "The start date is not among the candidates"));
        questions.endDate = choice(`Which candidate is the arrival, check-out or end date of that same segment in \`text\`? Pick none if the segment ends on its start date or no end date is written. ${SEGMENT}`, options(c.dates, "No separate end date"));
      }
      if (c.times.length) {
        questions.startTime = choice(`Which candidate is the departure or start time in \`text\`? ${SEGMENT}`, options(c.times, "The start time is not among the candidates"));
        questions.endTime = choice(`Which candidate is the arrival or end time of that same segment in \`text\`? ${SEGMENT}`, options(c.times, "No arrival or end time is written"));
      }
      if (c.places.length) {
        questions.departure = choice(`Which candidate is the departure airport or station in \`text\`? ${SEGMENT}`, options(c.places, "No departure place is written"));
        questions.arrival = choice(`Which candidate is the arrival airport or station in \`text\`? ${SEGMENT}`, options(c.places, "No arrival place is written"));
      }
      if (c.services.length) {
        questions.service = choice(`Which candidate is the flight or train number in \`text\`? It is never a booking reference. ${SEGMENT}`, options(c.services, "No flight or train number is written"));
      }

      const { answers } = await client.systemOne({ state: { text }, questions });
      const picked: PickedFields = {};
      for (const [key, answer] of Object.entries(answers) as [string, { choice: string; confidence: number }][]) {
        if (answer.choice === NONE || answer.confidence < MIN_CONFIDENCE) continue;
        (picked as Record<string, string>)[key] = answer.choice;
      }
      return picked;
    },
  };
}
