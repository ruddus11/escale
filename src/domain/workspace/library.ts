import type { TripLibrary, TripWorkspace } from "./types";

export function createTripLibrary(trip: TripWorkspace): TripLibrary {
  return {
    schemaVersion: 3,
    activeTripId: trip.id,
    trips: [trip],
    updatedAt: trip.updatedAt,
  };
}

/** 지금 펼친 수첩. 저장소 검사를 거친 목록이면 항상 있다. */
export function getActiveTrip(library: TripLibrary): TripWorkspace {
  const trip = library.trips.find((candidate) => candidate.id === library.activeTripId);
  if (trip === undefined) {
    throw new RangeError(`Active trip ${library.activeTripId} is missing`);
  }
  return trip;
}

/** 같은 id의 수첩을 바꾼다. 목록의 갱신 시각은 바꾼 수첩의 시각을 따른다. */
export function replaceTrip(library: TripLibrary, trip: TripWorkspace): TripLibrary {
  if (!library.trips.some((candidate) => candidate.id === trip.id)) {
    throw new RangeError(`Trip ${trip.id} is not in the library`);
  }
  return {
    ...library,
    trips: library.trips.map((candidate) => (candidate.id === trip.id ? trip : candidate)),
    updatedAt: trip.updatedAt,
  };
}

export function selectTrip(
  library: TripLibrary,
  tripId: string,
  updatedAt: string,
): TripLibrary {
  if (!library.trips.some((candidate) => candidate.id === tripId)) {
    throw new RangeError(`Trip ${tripId} is not in the library`);
  }
  return { ...library, activeTripId: tripId, updatedAt };
}

/** 새 수첩은 표지 맨 뒤에 꽂고 바로 펼친다. */
export function addTrip(library: TripLibrary, trip: TripWorkspace): TripLibrary {
  if (library.trips.some((candidate) => candidate.id === trip.id)) {
    throw new RangeError(`Trip ${trip.id} already exists`);
  }
  return {
    ...library,
    activeTripId: trip.id,
    trips: [...library.trips, trip],
    updatedAt: trip.updatedAt,
  };
}

/** 다 쓴 수첩으로 옮기거나 되돌린다. 되돌리면 archived 키를 지워 저장값을 줄인다. */
export function setTripArchived(
  library: TripLibrary,
  tripId: string,
  archived: boolean,
  updatedAt: string,
): TripLibrary {
  const trip = library.trips.find((candidate) => candidate.id === tripId);
  if (trip === undefined) throw new RangeError(`Trip ${tripId} is not in the library`);
  const { archived: _previous, ...settings } = trip.settings;
  return {
    ...replaceTrip(library, {
      ...trip,
      settings: archived ? { ...settings, archived: true } : settings,
      updatedAt,
    }),
    updatedAt,
  };
}

/** 수첩을 지운다. 마지막 한 권은 지울 수 없고, 펼친 수첩을 지우면 남은 첫 수첩을 펼친다. */
export function removeTrip(
  library: TripLibrary,
  tripId: string,
  updatedAt: string,
): TripLibrary {
  if (!library.trips.some((candidate) => candidate.id === tripId)) {
    throw new RangeError(`Trip ${tripId} is not in the library`);
  }

  const trips = library.trips.filter((candidate) => candidate.id !== tripId);
  return {
    ...library,
    trips,
    activeTripId:
      library.activeTripId === tripId ? (trips[0]?.id ?? "") : library.activeTripId,
    updatedAt,
  };
}

export function emptyTripLibrary(): TripLibrary {
  return { schemaVersion: 3, activeTripId: "", trips: [], updatedAt: new Date().toISOString() };
}
