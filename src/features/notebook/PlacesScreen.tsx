import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { MapPin } from "lucide-react";
import { APP_COLUMN_MAX_WIDTH } from "../../app/frame";
import type { AttachedPlace } from "../../domain/places/types";
import type { SchedulePlan } from "../../domain/schedule/types";

interface PlacesScreenProps {
  schedule: SchedulePlan;
}

/** 일정에 붙인 장소를 한곳에 모은다. 따로 저장하는 장소 목록은 장소 화면 단계에서 더한다. */
export function PlacesScreen({ schedule }: PlacesScreenProps) {
  const places = uniquePlaces(schedule);

  return (
    <VStack className="places-screen" gap={4} maxWidth={APP_COLUMN_MAX_WIDTH}>
      <VStack gap={1}>
        <Heading level={1} className="notebook-title">
          장소
        </Heading>
        <Text type="supporting">일정에 붙인 장소 {places.length}곳</Text>
      </VStack>
      {places.length === 0 ? (
        <Text>일정에 장소를 붙이면 여기에 모여요. 일정 탭의 '전체 일정'에서 장소를 찾아 붙일 수 있어요.</Text>
      ) : (
        <List hasDividers>
          {places.map((place) => (
            <ListItem
              key={place.placeId}
              label={place.displayName}
              description={place.formattedAddress}
              startContent={<Icon icon={MapPin} />}
              endContent={
                <Link href={place.googleMapsUri} target="_blank" isStandalone>
                  지도
                </Link>
              }
            />
          ))}
        </List>
      )}
    </VStack>
  );
}

function uniquePlaces(schedule: SchedulePlan): AttachedPlace[] {
  const byId = new Map<string, AttachedPlace>();
  for (const activity of schedule.activities) {
    if (activity.place !== undefined && !byId.has(activity.place.placeId)) {
      byId.set(activity.place.placeId, activity.place);
    }
  }
  return [...byId.values()];
}
