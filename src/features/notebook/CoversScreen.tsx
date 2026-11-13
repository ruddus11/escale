import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Plus } from "lucide-react";
import { APP_COLUMN_MAX_WIDTH } from "../../app/frame";
import type { TripLibrary, TripWorkspace } from "../../domain/workspace/types";
import { formatTripDates } from "./formatTripDates";

interface CoversScreenProps {
  library: TripLibrary;
  onOpenTrip: (tripId: string) => void;
  onCreateTrip: () => void;
  canCreate?: boolean;
  onOpenBackup?: () => void;
}

/** 여행 목록을 책상 위 수첩 표지로 보여 준다. 다 쓴 수첩은 아래 줄. */
export function CoversScreen({ library, onOpenTrip, onCreateTrip, canCreate = true, onOpenBackup }: CoversScreenProps) {
  const writing = library.trips.filter((trip) => !trip.settings.archived);
  const finished = library.trips.filter((trip) => trip.settings.archived);

  return (
    <VStack className="covers-screen" gap={6} maxWidth={APP_COLUMN_MAX_WIDTH}>
      <VStack gap={1}>
        <Heading level={1} className="notebook-title">
          내 여행 수첩
        </Heading>
        <Text type="supporting">
          쓰는 중 {writing.length}권 · 다 쓴 수첩 {finished.length}권
        </Text>
      </VStack>

      <VStack as="section" aria-label="쓰는 중인 수첩" gap={4}>
        <HStack as="ul" className="covers-screen__shelf" gap={4} wrap="wrap">
          {writing.map((trip) => (
            <CoverButton
              key={trip.id}
              trip={trip}
              isOpen={trip.id === library.activeTripId}
              onOpen={() => onOpenTrip(trip.id)}
            />
          ))}
        </HStack>
        <Button
          label="새 수첩 만들기"
          variant="secondary"
          icon={<Icon icon={Plus} />}
          onClick={onCreateTrip}
          isDisabled={!canCreate}
        />
        {onOpenBackup === undefined ? null : (
          <Button label="백업 · 복구" variant="ghost" onClick={onOpenBackup} />
        )}
      </VStack>

      {finished.length === 0 ? null : (
        <VStack as="section" aria-labelledby="finished-notebooks" gap={3}>
          <Heading level={2} id="finished-notebooks" className="notebook-title">
            다 쓴 수첩
          </Heading>
          <HStack as="ul" className="covers-screen__shelf" gap={4} wrap="wrap">
            {finished.map((trip) => (
              <CoverButton
                key={trip.id}
                trip={trip}
                isOpen={trip.id === library.activeTripId}
                onOpen={() => onOpenTrip(trip.id)}
              />
            ))}
          </HStack>
        </VStack>
      )}
    </VStack>
  );
}

function CoverButton({
  trip,
  isOpen,
  onOpen,
}: {
  trip: TripWorkspace;
  isOpen: boolean;
  onOpen: () => void;
}) {
  const { settings } = trip;
  const dates = formatTripDates(settings.startDate, settings.endDate);
  return (
    <li className="covers-screen__item">
      <button
        type="button"
        className="notebook-cover"
        data-cover={settings.coverColor ?? "cobalt"}
        aria-current={isOpen ? "true" : undefined}
        aria-label={`${settings.title} 수첩 열기, ${dates}, ${settings.members.length}명`}
        onClick={onOpen}
      >
        <VStack as="span" className="notebook-cover__label" gap={1}>
          <Text as="span" className="notebook-cover__title" weight="bold">
            {settings.title}
          </Text>
          <Text as="span" size="sm" type="supporting" hasTabularNumbers>
            {dates}
          </Text>
          <Text as="span" size="sm" type="supporting">
            {settings.members.map((member) => member.name).join(" · ")}
          </Text>
        </VStack>
        {isOpen ? (
          <Text as="span" className="notebook-cover__status" size="sm" weight="semibold">
            펼친 수첩
          </Text>
        ) : null}
      </button>
    </li>
  );
}
