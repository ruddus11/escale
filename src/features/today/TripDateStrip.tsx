import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { zonedDate } from "../../domain/time/zoned";

interface TripDateStripProps {
  startAt: string;
  dayCount: number;
  now: Date;
  timeZone: string;
}

const dayMilliseconds = 86_400_000;

export function TripDateStrip({
  startAt,
  dayCount,
  now,
  timeZone,
}: TripDateStripProps) {
  const start = new Date(startAt);
  // 현지 달력 날짜끼리 더한다. DST 전환일에 24시간을 더하면 같은 날짜가 반복될 수 있다.
  const calendarStart = Date.parse(`${zonedDate(start, timeZone)}T00:00:00Z`);
  const selectedIndex = Math.min(
    dayCount - 1,
    Math.max(
      0,
      calendarDayNumber(now, timeZone) - calendarDayNumber(start, timeZone),
    ),
  );
  const weekdayFormatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "UTC",
    weekday: "short",
  });
  const dayFormatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "UTC",
    day: "numeric",
  });

  return (
    <nav aria-label="여행 날짜">
      <HStack as="ol" className="trip-date-strip__list" justify="between" gap={1}>
        {Array.from({ length: dayCount }, (_, index) => {
          const date = new Date(calendarStart + index * dayMilliseconds);
          const isSelected = index === selectedIndex;
          return (
            <VStack
              as="li"
              key={date.toISOString()}
              className="trip-date-strip__day"
              aria-current={isSelected ? "date" : undefined}
              align="center"
              gap={1}
            >
              <Text type="supporting" size="sm" color={isSelected ? "accent" : "secondary"}>
                {weekdayFormatter.format(date).replace("요일", "")}
              </Text>
              <Text
                size="lg"
                weight="bold"
                hasTabularNumbers
                color={isSelected ? "accent" : "primary"}
              >
                {dayFormatter.format(date).replace("일", "")}
              </Text>
            </VStack>
          );
        })}
      </HStack>
    </nav>
  );
}

function calendarDayNumber(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Date.UTC(read("year"), read("month") - 1, read("day")) / dayMilliseconds;
}
