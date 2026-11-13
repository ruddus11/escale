import { deviceTimeZone, zonedTime } from "../../domain/time/zoned";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { ArrowRight, MapPinned } from "lucide-react";
import { formatCountdown } from "../../domain/time/formatCountdown";
import type { Activity } from "../../domain/trip/types";
import { createGoogleMapsTransitUrl } from "../../services/maps";

interface NextMoveCardProps {
  timeZone?: string;
  activity: Activity;
  now: Date;
  onOpenTransit: () => void;
  routeTimingStale?: boolean;
  status?: "current" | "next";
}

export function NextMoveCard({
  activity,
  timeZone = deviceTimeZone(),
  now,
  onOpenTransit,
  routeTimingStale = false,
  status = "next",
}: NextMoveCardProps) {
  // 앱 안에서 실시간 경로를 조회하지 않으므로 항상 계획 경로를 보여 준다.
  const timingNeedsRecheck = routeTimingStale;
  const route = activity.plannedRoute;
  const departureAt = route.firstTransitDepartureAt;
  const leaveAt = route.leaveCurrentLocationAt;
  const departureTime = timingNeedsRecheck
    ? "--:--"
    : zonedTime(departureAt, timeZone);
  const arrivalTime = timingNeedsRecheck
    ? "--:--"
    : new Date(activity.targetAt).getTime() <= new Date(departureAt).getTime()
      ? "확인"
      : zonedTime(activity.targetAt, timeZone);
  const leaveTime = zonedTime(leaveAt, timeZone);
  const leaveCountdown =
    new Date(leaveAt).getTime() <= now.getTime()
      ? "지금 출발"
      : `${formatCountdown(leaveAt, now)} 남음`;
  const isFlight = activity.plannedRoute.modeLabel.startsWith("TW");
  const isFlightInProgress =
    isFlight &&
    now.getTime() >=
      new Date(activity.plannedRoute.firstTransitDepartureAt).getTime() &&
    now.getTime() < new Date(activity.targetAt).getTime();
  const actionLabel = isFlight ? "도착 후 교통편 보기" : "교통편 보기";
  const basisLabel = timingNeedsRecheck
    ? "일정 변경 · 교통편 재확인 필요"
    : "계획 기준";

  return (
    <Card variant="muted" padding={5}>
      <VStack as="section" aria-labelledby="next-move-title" gap={4}>
        <HStack justify="between" align="center" gap={2}>
          <Badge
            variant="blue"
            label={
              isFlightInProgress
                ? "비행 중"
                : status === "current"
                  ? "현재 이동"
                  : "다음 이동"
            }
          />
          <Text type="supporting" size="sm">
            {basisLabel}
          </Text>
        </HStack>
        <Heading level={2} id="next-move-title">
          {isFlight
            ? `${route.originLabel} → ${route.destinationLabel}`
            : activity.title}
        </Heading>
        <VStack className="next-move__timetable" gap={3}>
          <HStack justify="between" align="center" gap={2}>
            <Text weight="semibold">{route.modeLabel}</Text>
            <Token size="sm" color="default" label="PLAN" />
          </HStack>
          <HStack justify="between" align="center" gap={3}>
            <VStack gap={0.5}>
              <Text type="supporting" size="sm">
                출발
              </Text>
              <Text size="3xl" weight="bold" hasTabularNumbers>
                {departureTime}
              </Text>
              <Text type="supporting" size="sm">
                {route.originLabel}
              </Text>
            </VStack>
            <Icon icon={ArrowRight} color="secondary" />
            <VStack gap={0.5} align="end">
              <Text type="supporting" size="sm">
                도착
              </Text>
              <Text size="3xl" weight="bold" hasTabularNumbers>
                {arrivalTime}
              </Text>
              <Text type="supporting" size="sm">
                {route.destinationLabel}
              </Text>
            </VStack>
          </HStack>
          <Divider />
          <HStack justify="between" align="center" gap={2}>
            <Text type="supporting">
              {timingNeedsRecheck
                ? "일정 변경 시각"
                : isFlightInProgress
                  ? `${arrivalTime} 도착 예정`
                  : isFlight
                    ? `${leaveTime} 탑승 준비`
                    : `${leaveTime} 출발`}
            </Text>
            <Text color="accent" weight="bold" size="lg" hasTabularNumbers>
              {timingNeedsRecheck
                ? "교통편 재확인"
                : isFlightInProgress
                  ? `도착까지 ${formatCountdown(activity.targetAt, now)}`
                  : leaveCountdown}
            </Text>
          </HStack>
        </VStack>
        <HStack justify="between" align="center" gap={3} wrap="wrap">
          <Button
            variant="primary"
            size="lg"
            label={actionLabel}
            onClick={onOpenTransit}
            endContent={<Icon icon={ArrowRight} />}
          />
          <Link
            href={createGoogleMapsTransitUrl(activity.destination)}
            target="_blank"
            isStandalone
          >
            <HStack as="span" gap={1} align="center">
              <Icon icon={MapPinned} size="sm" />
              Google 지도에서 길 보기
            </HStack>
          </Link>
        </HStack>
      </VStack>
    </Card>
  );
}
