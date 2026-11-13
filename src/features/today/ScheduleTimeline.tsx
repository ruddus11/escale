import { deviceTimeZone, zonedTime } from "../../domain/time/zoned";
import { Heading } from "@astryxdesign/core/Heading";
import { List, ListItem } from "@astryxdesign/core/List";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";

export interface TimelineActivity {
  id: string;
  title: string;
  targetAt: string;
  detail: string;
}

interface ScheduleTimelineProps {
  timeZone?: string;
  activities: TimelineActivity[];
  goalActivityId?: string;
}

export function ScheduleTimeline({
  activities,
  timeZone = deviceTimeZone(),
  goalActivityId,
}: ScheduleTimelineProps) {
  if (activities.length === 0) {
    return null;
  }

  return (
    <VStack as="section" id="schedule" aria-labelledby="schedule-title" gap={2}>
      <HStack justify="between" align="center" gap={2}>
        <Heading level={2} id="schedule-title">
          이후 일정
        </Heading>
        <Text type="supporting" size="sm">
          도착 목표 우선
        </Text>
      </HStack>
      <List hasDividers>
        {activities.map((activity) => {
          const isGoal = activity.id === goalActivityId;
          return (
            <ListItem
              key={activity.id}
              label={activity.title}
              description={activity.detail}
              startContent={
                <Text weight="semibold" hasTabularNumbers color={isGoal ? "accent" : "secondary"}>
                  <time dateTime={activity.targetAt}>
                    {zonedTime(activity.targetAt, timeZone)}
                  </time>
                </Text>
              }
              endContent={
                <Token size="sm" color={isGoal ? "blue" : "default"} label={isGoal ? "고정" : "유동"} />
              }
            />
          );
        })}
      </List>
    </VStack>
  );
}
