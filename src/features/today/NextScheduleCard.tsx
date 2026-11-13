import { deviceTimeZone, zonedTime } from "../../domain/time/zoned";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { MapPinned } from "lucide-react";
import { formatCountdown } from "../../domain/time/formatCountdown";
import { isScheduleActivityActive } from "../../domain/schedule/selectors";
import type { ScheduleActivity } from "../../domain/schedule/types";
import {
  createScheduleCurrentLocationDirectionsUrl,
  getScheduleMapTarget,
} from "../../data/scheduleMapTargets";

interface NextScheduleCardProps {
  timeZone?: string;
  activity: ScheduleActivity;
  now: Date;
  isFixed?: boolean;
  showMapLink?: boolean;
  headingId?: string;
}

export function NextScheduleCard({
  activity,
  timeZone = deviceTimeZone(),
  now,
  isFixed = false,
  showMapLink = true,
  headingId = "next-schedule-title",
}: NextScheduleCardProps) {
  const targetTime = zonedTime(activity.targetAt, timeZone);
  const hasPlace = activity.placeName.trim().length > 0;
  const mapTarget = getScheduleMapTarget(activity);
  const isActive = isScheduleActivityActive(activity, now);
  const mapUrl =
    activity.kind === "transport"
      ? createScheduleCurrentLocationDirectionsUrl(activity)
      : mapTarget?.placeUrl;
  const endsAt = new Date(
    new Date(activity.targetAt).getTime() + activity.durationMinutes * 60_000,
  );
  const statusLabel = `${isActive ? "진행 중" : "예정"}${
    isFixed ? " · 고정" : ""
  }`;

  return (
    <Card variant="muted" padding={5}>
      <VStack as="section" aria-labelledby={headingId} gap={2}>
        <HStack justify="between" align="center" gap={2}>
          <Token size="sm" color={isActive ? "green" : "default"} label={statusLabel} />
          <Text weight="semibold" hasTabularNumbers>
            <time dateTime={activity.targetAt}>{targetTime}</time>
          </Text>
        </HStack>
        <Heading level={2} id={headingId}>
          {activity.title}
        </Heading>
        <Text type="supporting" as="p">
          {hasPlace ? activity.placeName : "장소 없음"}
        </Text>
        <Text color="accent" weight="bold" size="lg" hasTabularNumbers>
          {isActive
            ? `${zonedTime(endsAt, timeZone)} 종료 예정`
            : `${formatCountdown(activity.targetAt, now)} 남음`}
        </Text>
        {!showMapLink || mapUrl === null || mapUrl === undefined ? null : (
          <Link href={mapUrl} target="_blank" isStandalone>
            <HStack as="span" gap={1} align="center">
              <Icon icon={MapPinned} size="sm" />
              Google Maps
            </HStack>
          </Link>
        )}
      </VStack>
    </Card>
  );
}
